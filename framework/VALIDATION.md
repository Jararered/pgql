# Validation — October 12, 2026

## Earlier injector artifact

`build/qol-lab-debug.apk`: 45,490,715 bytes, SHA-256 `cc6ca5bc6edc12ccda7831263abfc3af42cd52662768a9dd8fe31d75bdb680f4`.

Built from this project's original Java/C/JavaScript source with Android platform 35/build-tools 35.0.0, NDK r27c and the checksum-verified Frida core 17.23.3 Android arm64 devkit. The APK signature was verified by `apksigner`; installation and activity launch succeeded on the connected phone. `build/build.log` records the final cross-build/signature check. Only arm64 is packaged. The manual build path is tested; the optional Gradle configuration is not.

## Local checks

- Native runner compiled for Android arm64 API 28 with `-Wall -Wextra -Werror`, PIE, and 16 KiB ELF segment alignment.
- Native JSON input validation cases passed under host AddressSanitizer and UndefinedBehaviorSanitizer, including malformed/truncated input, embedded NUL and nesting bounds.
- Original module-runtime tests passed: registry/command responses, diagnostics invocation, observer enable/disable, repeated disable, rollback after failed initialization, disabled action rejection, bulk shutdown and tracked-resource disposal.
- Python build scripts passed syntax compilation.
- These tests parse/execute our own framework code. They do not execute the recovered Pokemod agents.

## Observed phone results

Phone: Pixel 9a, arm64-v8a, Android 17, 4 KiB memory pages. Root returned UID 0 under the Magisk domain. Installed Pokémon GO version: 0.431.0. Device identification/serial is not needed in the report.

The Android app installed, rendered its controls and notification permission request, and launched its root helper. Initial failures were investigated rather than treated as successful injection:

1. A cached/frozen target caused a stop-wait timeout. Attach now foregrounds the game and resolves its PID after launch.
2. The initial helper omitted Frida's SELinux policy initialization. A concrete audit denial on `/memfd:frida-agent-64.so` explained the closed agent connection; attachment to our own app also failed before setup. After the user explicitly authorized setup, the upstream helper was enabled. Enforcement remained `Enforcing` when checked after setup.
3. Successful injected diagnostics reported the actual game PID, arm64 architecture and loaded Unity, IL2CPP and Niantic native libraries. This was a target-process message from our script, not a host mock.
4. The library observer module enabled and disabled through app commands, returning matching successful command responses. A diagnostics action returned a fresh snapshot.
5. Full native-agent unload was followed by a game SIGSEGV recorded in Android exit information/tombstone data. The exact cause was not proven; unknown program counters after unload make a stale-code/unload compatibility issue a candidate. The final app therefore uses resident-agent detach instead.
6. In resident mode, shutdown acknowledged all modules disabled (including an active library observer), `eternalized=true` was reported, the native controller detached, and no helper process remained. The same game PID **15146** was still running afterwards. A subsequent attach to that same process loaded a fresh diagnostics module and completed the registry handshake.

The final state and second detach result are recorded in `build/device-validation.json`; relevant app-only runtime logs are in `build/device-session.log`. Initial failures and the earlier full-unload crash remain material evidence, not successful test cases.

## PGQL settings menu validation

The current build is `build/pgql-debug.apk`, branded PGQL 0.1 / Pokemon Go QoL. The injected Android button and dialog rendered inside Pokémon GO’s `UnityMainActivity`; the dialog displayed the name and version, two module enable switches, and both declared boolean settings. Screenshots are in `build/pgql-settings.png`.

The phone emitted configuration events for `diagnostics.includeAddresses=false` and `library-watch.logUnloads=false`, and an enabled event for the library observer after its switch was tapped. Only the framework’s configuration JSON was inspected in the game-private `pgql_settings` preferences; it contained these values and module enable states. The final installed APK is 45584923 bytes, SHA-256 `72e602c4317f71974f45f359a7a4c6013dfa498274a4d03c8137871f736b8628`. After reattachment to PID 19992, the same toggles and module states were restored. After detach, Android UI inspection found no PGQL button/dialog, and PID 19992 remained alive. The controller now synchronizes module change events from the injected menu. Runtime schema/configuration, subscriptions, rollback and lifecycle tests passed.

Initial Java-menu tests stalled during script startup. Deferring initialization and excluding the menu’s own registry notification fixed the handshake dependency. A subsequent ART abort (`method_index=65535`, `num_methods=127`) occurred during optional JVMTI plugin setup. Avoiding JVMTI completely encountered a separate unsupported class-layout path. The final bundle instead applies upstream Java bridge PR #400 to a build copy; menu creation and interaction succeeded with this patch. One earlier startup test also produced a native crash with a Niantic-library stack; its cause was not established. These failed tests are not evidence of menu stability.

## Practical limits

This is a developer foundation with two diagnostic modules, injected settings and an original Mass Gift module. See `MASS-GIFT.md` for the current live preview validation and the untested send/open boundary. It includes a first game-gifting service adapter and Unity-frame scheduler. It does not yet supply hot reload, spawn gating, Unity prefab integration, non-boolean settings controls or an unattended daily task engine. Native method addresses/signatures and managed services need separate version-aware work before implementing game QoL behavior.

Resident detach leaves an inactive script/Frida engine in the target until the game exits; reattaching can accumulate inactive scripts. Module code must register its owned resources and stop its own in-flight asynchronous operations in cleanup. A timeout/missing acknowledgement is reported as unconfirmed cleanup. The explicit policy setup has system-wide live effects until reboot, and detachment does not revert them. Details and the original-app comparison are in `../analysis/selinux-comparison.md` and the project README.

The observed attach/command/shutdown cycles establish this foundation on the connected phone/game version. They do not establish prolonged stability, compatibility with other devices/game versions, or successful server-side gameplay actions.

## Current Mass Gift artifact

`build/pgql-debug.apk`: 45617691 bytes; SHA-256 `e30dde317f345c98d960d2f8d0a7e5e806140e8d401f6b3d8e8e41be69fd478b`. Built/signature-verified, installed, and exercised through the injected menu. The current read-only opening preview reports 82 friends, 33 inventory gifts and 56 friends with incoming gifts. Send/open confirmation Cancel paths were exercised. Native handle target verification and deferred cleanup completed without the prior cleanup error. The same PID 27645 survived repeated previews/reattachments in the final checks. Actual send/open requests and prolonged stability remain untested; see `MASS-GIFT.md`.


## Encounter module implementation — October 12, 2026

Added independent Instant Catch, Perfect Throw, and Headshot toggles; see [ENCOUNTERS.md](ENCOUNTERS.md). Five Node suites pass and the APK is signed and installed. SHA-256: `4552f90f19a2d4f13c51b70df7d18f1a385619a197c3299c6bf140ab368fe74d`. The initial device build displayed the switches and reported metadata mismatches safely; these were corrected. After earlier native crashes, the final app-driven session on PID 5639 installed all three hooks and reported ready. Entered one encounter, verified independent disable and returned to the map without hook or cleanup errors; all three new toggles were left off. No balls were thrown, so catch/throw/recovery/XP outcomes remain untested. See `build/encounter-final-session.log` and `build/encounter-validation.json`.

## Virtual GO Plus implementation — October 12, 2026

Added the original **Virtual GO Plus** module (`virtual-go-plus`, see [GOPLUS.md](GOPLUS.md)) emulating a GO Plus accessory: device advertisement through raw JNI, instant pairing, native autocatch/autospin, forced sfida `HandleUpdate`, capture timestamp refresh, distance floor, and automatic reconnect, with three live boolean toggles and a status action. It is the framework's first native-lib adapter; libholoholo exports and the small struct-offset contract are pinned to GO 0.431.0 and fail cleanly otherwise (no recovered bricking logic).

The two new local suites (`go-plus-adapter`, `virtual-go-plus`) run the real adapter/module sources against mocked Frida/JNI globals and all seven suites pass: hook installation, JNIEnv table slot resolution, advertisement JNI call sequencing and global-ref retention/release, pairing state write (`Device`+528→8) and `ConnectionComplete`, catch/spin offset reads and native calls, capture flush + timestamp, distance floor, reconnect routing, per-setting toggles, config rollback, stale-generation cancellation, and full revert/release on disable. `scripts/bundle-agent.py` produces the agent bundle including all new core/adapter/module files.

**No live device session has run yet.** Whether the game's sfida module accepts the fabricated device, pairs cleanly, and accepts `CatchPokemon`/`SearchPokestop` server requests on this phone's GO 0.431.0 remains untested and is recorded as a validation boundary in `GOPLUS.md`.

### Virtual GO Plus follow-up — October 12, 2026

First device session showed the module reaching `armed`/`ready` in the main game process with no advertisement and no hook failure: the accessory stack runs in `com.nianticlabs.pokemongo:pgp`, which PGQL was not attached to. Fixed by attaching a second runner to `:pgp` on enable (see GOPLUS.md "Process model") and gating on package `versionName` there. Also fixed two JNI helper defects the mocks had hidden: untyped variadic `NativeFunction` signatures and a call to the non-existent `Memory.free`; the adapter suite's mocks now reject both. All seven local suites pass and the APK builds. **The two-process attach, device advertisement, pairing, catch and spin remain unvalidated on a device.**

## Feature framework and Tamagotchi foundation — October 12, 2026

All 32 requested features are cataloged with stable IDs, categories, adapter
domains and explicit implementation availability. Planned entries cannot be
enabled. Both menus expose availability, and the controller module list now
scrolls independently. See [FEATURES.md](FEATURES.md).

Tamagotchi includes persistent switches, preview/status/pause/resume, a bounded
sequential care engine, duplicate-action receipts, cancellation and resource
leases that survive request timeouts. Its game adapter is intentionally unbound:
**no live feeding, souvenirs, play, snapshots or battles are implemented yet.**
The attempted read-only metadata probe ended with target detachment before
returning buddy signatures; no care actions were sent. Cause of the game exit
is unknown. See [TAMAGOTCHI.md](TAMAGOTCHI.md) for the exact boundary and raw-log
locations. Further device probing stopped.

All ten Node suites passed. The Android APK built and its v3 signature verified;
`git diff --check` passed. Build output: `build/pgql-debug.apk`, SHA-256
`8c4990d3e16ae95583f5b15fcfc6117966aa190713db054d92e7b3bff4f2509d`.
Build log: `build/tamagotchi-build.log`. This APK includes the pre-existing working
tree changes to Virtual GO Plus and SessionService; they were preserved. The new
APK was not installed, and its menu layout and new module have not been visually
or behaviorally validated on-device.

## Live buddy bindings — October 13, 2026

Added the original exact-version 0.431.0 buddy profile for feeding, play and
souvenirs. Manual feed/pet/snapshot calls were observed with server progress;
new-profile preview and stale-request refusal passed, and a direct petting
dispatch returned success with communication increasing 11 → 12. Souvenir
claims and the eligible automatic care loop remain unvalidated; automatic
snapshots and battles remain unsupported. See [TAMAGOTCHI.md](TAMAGOTCHI.md).

An earlier diagnostic read aborted PID 25735 with `Il2CppExceptionWrapper`;
precise cause remains unproven. The user reopened the game. Final PID 9885
session shut down with acknowledgment and resident-agent detachment, and the
game remained alive. Log: `build/buddy-observe-9885.jsonl`.

All eleven Node suites passed, and the APK built with signature verification.
SHA-256: `28f1e72d70aecdc49e1fbb0757638ba2a004ef3f7e4f29c4d20a7519a9f9489d`. Build log: `build/buddy-live-build.log`.
The APK was not installed; production module-menu integration remains untested.
