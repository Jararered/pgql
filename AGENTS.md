# AGENTS.md

## Repo map

- The repository root is the active project: **PGQL**, an original rooted Android injection app + Frida module framework with a single Gradle app module. `app/` contains the controller, `agent/` the injected runtime, and `native/` the runner. Feature guides and validation history live in `docs/`.
- `analysis/` is historical reverse-engineering evidence from the Pokemod 13.8.0 APK (RE reports, decoded agents, JSON dumps). **Read-only reference.** The framework is original code and must never import/link recovered Pokemod code; `THIRD_PARTY.md` confirms nothing is packaged.
- `com.pokemod.app.public/` is extracted phone data; root `.gitignore` ignores it plus `*.so`/`*.apk`.

## Build (from the repository root)

Exact order, macOS:

```sh
python3 scripts/bootstrap.py   # one-time; downloads pinned toolchains + Frida devkit
npm ci                          # esbuild/bridges are build-time deps
python3 scripts/build.py        # bundles agent, builds native runner, signs APK
```

Output: `build/pgql-debug.apk`. Build fails with "Missing toolchain" if bootstrap was skipped. Build artifacts, device logs (`build/*.log`, `build/*-validation.json`, screenshots) all live in gitignored `build/` — keep evidence there.

- Env overrides: `JAVA_HOME` (defaults to Homebrew `openjdk@21`), `ANDROID_NDK_HOME` (defaults to `toolchains/ndk/android-ndk-r27c`). `native/build.sh` requires `ANDROID_NDK_HOME` if invoked standalone.
- Pins: Frida core **17.23.3**, NDK r27c, platform 35, build-tools 35.0.0, `frida-java-bridge` 7.0.13, `frida-il2cpp-bridge` 0.14.0, esbuild 0.28.2.

## Generated files — never edit by hand

- `app/src/main/assets/agent.js`: esbuild bundle produced by `scripts/bundle-agent.py` from `agent/**` (concatenation order: `runtime.js`, `core/`, `adapters/`, `modules/`, `ui/settings-menu.js`, `entry.js`). Edit `agent/` sources and rebuild.
- `app/src/main/jniLibs/`: native output from `native/build.sh` (packaged as `libqolrunner.so`; actually a PIE executable).

## Tests

All thirty-six suites: `npm test` (plain Node, no harness). Single suite: `node tests/<file>.test.cjs`.

Tests execute the **real `agent/**` sources** in a `vm` sandbox with mocked Frida globals — they never touch recovered Pokemod code. Native JSON parser host check (from `native/`):

```sh
cc -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined json_protocol.c test_json_protocol.c -o /tmp/framework-json-test && /tmp/framework-json-test
```

## Architecture facts that change how you work

- `agent/runtime.js` defines the `Qol` runtime (`Qol.register()` module API, settings that are `boolean` or validated bounded `text`, `ctx.hook/interval/observeModules/cleanup/notify`; `notify` events become Android notifications in `SessionService`). New module = file in `agent/modules/`; game logic lives in `agent/core/`; version-specific hooks in `agent/adapters/`.
- All game adapters are **gated to Pokémon GO 0.433.0** through the single constant in `agent/core/game-version.js` (`PgqlGameVersion.require`, throws otherwise; bump it only after re-validating every adapter on the new build) and resolve managed types/methods at runtime — there are no copied native game offsets. Ambiguous bindings fail rather than guess.
- **Dedicated GO Plus session**: `Start GO Plus session` in the controller attaches only to `com.nianticlabs.pokemongo:pgp`, applies controller-private persisted settings and enables the module after the runner reports ready. This is the preferred mode for this feature because main-process native attachment is unstable on the connected build. The controller displays connection/request counters and the three boolean settings.
- **Virtual GO Plus also supports a companion process**: the game's accessory stack lives in `com.nianticlabs.pokemongo:pgp` (no Unity/il2cpp there). `SessionService` attaches a second runner to it on enable, loading the same bundle with `globalThis.PgqlRole='pgp'`; the main-process module is only a front that the controller mirrors. Its version gate uses the package `versionName` (`agent/core/package-version.js`), not `Il2Cpp.application.version`.
- **Virtual GO Plus is the one native-lib adapter**: it resolves `libholoholo.so` exports by mangled name and uses a small set of **version-pinned struct offsets** (documented in `docs/GOPLUS.md`), gated to 0.433.0 with clean failure. Its raw JNIEnv access uses the published JNI/ART function-table slot numbers (a public ABI, not game offsets). Keep any future native offsets in that same contract, never in module code.
- **In-game UI is cloned from the game's own prefabs**: `agent/adapters/game-main-menu.js` adds the PGQL row to the main menu and `agent/adapters/game-settings-screen.js` builds the settings pages from the Notifications settings prefab and shows prompts through the game's modal service. Both are gated to 0.433.0 with an up-front contract check; `agent/core/settings-layout.js` decides what goes on the main page versus Advanced Settings (category `Developer`). Give new modules and settings a `description`; it becomes the grey text under the row. The Android dialog/floating button in `agent/ui/settings-menu.js` are fallbacks only.
- **Teleport goes through the controller**: `ctx.teleport` sends a `teleport` event and `SessionService` starts GPS Joystick's exported `theappninjas.gpsjoystick.TELEPORT` service (float `lat`/`lng`), falling back to root `am start-foreground-service`. Alert notifications with coordinates use the same path. Nothing in the game process sends Intents.
- Attaching a second runner to a game process that is already attached (or being attached from the controller) has crashed the game; use one runner at a time and restart the game for a clean process when in doubt. Probe attaches to a foreground game crashed three times in a row with the documented `libNianticLabsPlugin.so` SIGSEGV, while attaching with the game in the background (as the controller app does) succeeded; it later also crashed once after a background attach, so treat the crash as intermittent either way.
- App is **attach-only** (no spawn), but **Start** does the launch: `SessionService` root-force-stops the game (clean process, no resident agents), launches it, waits until `libil2cpp.so` is mapped in the new PID (loading screen), waits `ATTACH_GRACE_MS`, then attaches. If the game dies before or within 30 s of `ready`, it logs the crash-buffer lines and relaunches, up to 3 attempts. The agent waits for `il2cpp_init` itself and `pgql-menu` re-enables saved modules only after the map scene exists, one every 300 ms.
- **Game-thread work goes through the shared scheduler** in `agent/adapters/game-gifts.js`: one `ExecuteTasks` hook and type cache for all adapters, a ~6 ms per-frame budget, `game.metadata(fn)` for type/method/field binding on the agent thread (keep scene objects out of it), a map-scene gate `game.mapReady()`. Jobs over 16 ms log `Slow game-thread job`. Modules that turn themselves off after an error call `Qol.disable(id,{failed:true})` so saved settings stay on.
- Detaching from a game that is in the background can hang: the frozen process cannot acknowledge shutdown. Detach foregrounds the game for that reason.
- **Resident-agent detach** (`--resident-agent`): module shutdown is acknowledged, the script is eternalized, and the controller detaches — but Frida + the inactive script stay in the game until it exits. Reattaching to the same PID accumulates inactive scripts. A missing shutdown ack is a logged error, not proof resources were released.
- **Device control**: the agent has full control of the connected test phone. Without asking first, it may end controller sessions, install updated `build/pgql-debug.apk` builds whenever it wants, attach probes, drive the UI over `adb`, and kill/restart the Pokémon GO target when needed. Detach active runners gracefully first and preserve relevant logs before restarting; do not kill unrelated apps.
- `--prepare-selinux` (opt-in, default off) rewrites live system SELinux policy until reboot; detach does not revert it.
- Keep `patches/frida-java-bridge-android17.patch` applied to a **build copy** only; npm inputs stay untouched.

## Canonical docs

`README.md` (architecture + how to add a module), `docs/VALIDATION.md` (device results/APK digests), `docs/MASS-GIFT.md`, `docs/ENCOUNTERS.md`, `docs/TRANSFER-ON-CATCH.md`, `docs/SHINY-SCANNER.md`, `docs/TAP-TO-TELEPORT.md`, `docs/COOLDOWN-TRACKER.md`, `docs/PINAP-MASTER.md`, `docs/TAP-TO-CATCH.md`, `docs/GYM-FEEDER.md`, `docs/RAID-PACK.md` and `docs/AUTO-GYM-BATTLE.md` (module behavior + live-validation limits). Local tests passing ≠ live injection proof; device sessions are reported separately in `docs/VALIDATION.md` and the `build/` artifacts.
