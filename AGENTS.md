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

All eleven suites: `npm test` (plain Node, no harness). Single suite: `node tests/<file>.test.cjs`.

Tests execute the **real `agent/**` sources** in a `vm` sandbox with mocked Frida globals — they never touch recovered Pokemod code. Native JSON parser host check (from `native/`):

```sh
cc -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined json_protocol.c test_json_protocol.c -o /tmp/framework-json-test && /tmp/framework-json-test
```

## Architecture facts that change how you work

- `agent/runtime.js` defines the `Qol` runtime (`Qol.register()` module API, boolean-only settings, `ctx.hook/interval/observeModules/cleanup`). New module = file in `agent/modules/`; game logic lives in `agent/core/`; version-specific hooks in `agent/adapters/`.
- Both il2cpp game adapters are **gated to Pokémon GO 0.431.0** (`Il2Cpp.application.version` check, throws otherwise) and resolve managed types/methods at runtime — there are no copied native game offsets. Ambiguous bindings fail rather than guess.
- **Virtual GO Plus runs in a second process**: the game's accessory stack lives in `com.nianticlabs.pokemongo:pgp` (no Unity/il2cpp there). `SessionService` attaches a second runner to it on enable, loading the same bundle with `globalThis.PgqlRole='pgp'`; the main-process module is only a front that the controller mirrors. Its version gate uses the package `versionName` (`agent/core/package-version.js`), not `Il2Cpp.application.version`.
- **Virtual GO Plus is the one native-lib adapter**: it resolves `libholoholo.so` exports by mangled name and uses a small set of **version-pinned struct offsets** (documented in `docs/GOPLUS.md`), gated to 0.431.0 with clean failure. Its raw JNIEnv access uses the published JNI/ART function-table slot numbers (a public ABI, not game offsets). Keep any future native offsets in that same contract, never in module code.
- App is **attach-only**: launch the game fully, then Attach. No spawn/resume support in v0.1.
- **Resident-agent detach** (`--resident-agent`): module shutdown is acknowledged, the script is eternalized, and the controller detaches — but Frida + the inactive script stay in the game until it exits. Reattaching to the same PID accumulates inactive scripts. A missing shutdown ack is a logged error, not proof resources were released. Never kill/restart the target.
- `--prepare-selinux` (opt-in, default off) rewrites live system SELinux policy until reboot; detach does not revert it.
- Keep `patches/frida-java-bridge-android17.patch` applied to a **build copy** only; npm inputs stay untouched.

## Canonical docs

`README.md` (architecture + how to add a module), `docs/VALIDATION.md` (device results/APK digests), `docs/MASS-GIFT.md` and `docs/ENCOUNTERS.md` (module behavior + live-validation limits). Local tests passing ≠ live injection proof; device sessions are reported separately in `docs/VALIDATION.md` and the `build/` artifacts.
