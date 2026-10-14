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

Resident detach leaves an inactive script/Frida engine in the target until the game exits; reattaching can accumulate inactive scripts. Module code must register its owned resources and stop its own in-flight asynchronous operations in cleanup. A timeout/missing acknowledgement is reported as unconfirmed cleanup. The explicit policy setup has system-wide live effects until reboot, and detachment does not revert them. Details and the original-app comparison are in `../analysis/selinux-comparison.md` and the [project README](../README.md).

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

## Repository structure cleanup — 2026-10-13

Promoted the active project from `framework/` to the repository root and moved
feature guides and this validation history into `docs/`. Commands and artifact
paths in these guides are relative to the repository root unless stated otherwise.
All 65 tracked historical files under `analysis/` are unchanged. Local inputs,
build evidence and the debug signing key were preserved; pre-build outputs are
also retained in ignored `build/pre-structure-build/`.

All eleven Node suites and the native JSON parser check with address and
undefined-behavior sanitizers passed from the new layout. The APK was rebuilt
and its signature verified using the relocated dependencies and original key.
Output: `build/pgql-debug.apk`, SHA-256 `65c76041d5473255da73341099e5109a5ddf614746898c2a024840e568fcd8f0`.
Build log: `build/structure-build.log`; cleanup checks:
`build/structure-validation.json`. No APK installation or phone operation was
performed; these checks establish local build compatibility, not live injection.

## Virtual GO Plus dedicated session — October 13, 2026

`build/pgql-debug.apk`: 45638171 bytes, SHA-256
`1fdf67814998ff77564003fe9ccdbaa01eb74fc2870b3e7715975965c31310b3`; the installed
controller APK has the same digest. All eleven Node suites and
`git diff --check` pass.

Device results, GO 0.431.0, game PID 28385 and accessory PID 28846 after a clean
restart of both processes:

- **Automatic reconnect:** a forced disconnect at 07:19:37.341 was followed by
  a reconnect request at 07:19:38.392 and pairing at 07:19:38.848 with no tap
  (`disconnects:1`, `reconnectAttempts:1`, `pairings:2`).
- **Saved settings:** Auto reconnect off was persisted, survived a controller
  force-stop/relaunch, and was applied to the next dedicated session before the
  module was enabled; it was then restored to on.
- **Detach:** both dedicated-session detaches acknowledged shutdown, eternalized
  the script and reported `crashed:false`; the runner exited and both game
  processes kept running. The session was left detached with all three settings
  on.
- An earlier reconnect attempt failed on a native argument type mismatch and
  disabled the module without taking the game down; the connection flag is now
  passed as `uint8` and covered by a regression check.

Not established: prolonged stability, the one-hour accessory timeout, and
normal main-process Attach, which crashed twice with native SIGSEGVs earlier in
the day (`build/go-plus-crash.log`). After the reconnect, only one catch request
and no spin requests were observed. Evidence: `build/go-plus-controller.log`,
`build/go-plus-detach.log`, `build/go-plus-settings-restart.log`,
`build/go-plus-controller-connected.png`, `build/go-plus-settings-restored.png`.

## Main menu entry validation

`agent/adapters/game-main-menu.js` adds a **PGQL** row to the game's own main
menu, directly below In-Person Event Tickets, and the settings panel opens from
it instead of the floating button. Local: `npm test` (twelve suites) pass,
including `tests/main-menu.test.cjs`.

Device results, GO 0.431.0 / Unity 6000.3.21f1, game PID 28385. The adapter
source was loaded by a separate validation runner beside an attached controller
session, with a logging callback in place of the settings panel:

- The live hierarchy matched the contract: `TopMenu` holds `ButtonSettings` and
  `ButtonEvents`, each a `Button` with a `TextLabel` `HoloText`.
- Start reported `installed:1`; the row rendered as PGQL under In-Person Event
  Tickets (`build/main-menu-entry.png`).
- One tap produced exactly one callback, closed the game's menu and did not open
  the game's Settings (`build/main-menu-entry-clicked.png`).
- Reopening the menu showed a single row (`build/main-menu-entry-reopened.png`).
- Resident detach acknowledged shutdown, reported `crashed:false`, and the row
  was gone on the next frame (`build/main-menu-entry-removed.png`). The game
  kept running.
- A first run failed its contract check (`ExecuteTasks` is static) before
  touching the scene; the binding was corrected.

`build/pgql-debug.apk`: 45642267 bytes; SHA-256
`ca31241446613957e225db7c4f1cdc8f7229cda60b9c48f7919dcdb928a0982a`. Built and
signature-verified but **not installed**. Not established: the row opening the
real settings panel from the installed APK, the floating-button fallback on
device, a menu rebuilt after a scene change, and prolonged stability. Evidence:
`build/main-menu-metadata-probe.jsonl`, `build/main-menu-probe.jsonl`,
`build/main-menu-build.log`.

## Native settings pages validation

The PGQL row now opens settings pages built from the game's own Notifications
settings prefab (`agent/adapters/game-settings-screen.js`), with developer
modules behind **Advanced Settings** and action confirmations/results in the
game's modal dialogs. Local: `npm test` (fourteen suites) pass, including
`tests/settings-layout.test.cjs` and `tests/settings-screen.test.cjs`.

`build/pgql-debug.apk`: 45646363 bytes; SHA-256
`b3313ed5034c56e0554e9794e757f670a32fb83e0eb823bb7cf9101abe59b88a`. Installed,
then attached from the controller to a freshly started game (GO 0.431.0 /
Unity 6000.3.21f1, PID 5788) that had never opened the game's Settings:

- The PGQL row opened the native main page (`Native settings page shown`,
  43 rows) with saved module states restored; no floating button was shown
  (`build/native-settings-main.png`, `build/native-settings-main-2.png`).
- Module rows carry descriptions, their settings render as indented sub-toggles,
  planned features are greyed-out rows, and the page scrolls.
- Headshot **Feature status** returned `phase: ready` in a native OK dialog
  (`build/native-settings-status-prompt.png`).
- Toggling Tamagotchi **Take buddy snapshots** off and on emitted both `config`
  events and the game-private `pgql_settings` preferences followed each change.
- Mass Gift **Send gifts** ran the read-only preview (82 friends, 32 gifts) and
  showed a native Continue/Cancel dialog; **Cancel was chosen** and no batch
  progress was logged (`build/native-settings-gift-prompt.png`).
- **Advanced Settings** showed only Target diagnostics and Library load observer
  (`build/native-settings-advanced.png`); the back button returned to the main
  page.
- Detaching from the controller with the page open acknowledged shutdown,
  reported `crashed:false`, removed the page and left the game running
  (`build/native-settings-detached.png`).

Earlier in the same work, a harness run of the adapter also exercised a refresh
of rows changed outside the page and the Continue answer of the confirm dialog
(`build/settings-harness.jsonl`). The prefab discovery log is
`build/settings-discovery-probe.jsonl`.

Two game exits occurred during this work, both when a validation runner
attached while the controller app was also being used on the phone: a native
SIGSEGV (`build/settings-attach-crash.log`, PID 32546) and a system kill during
script load (PID 3748). Single attaches to a fresh process succeeded.

Not established: that the game's own notification settings are untouched was
not checked on their screen (the copied screen is never opened through the
game's GUI stack or initialized, and every cloned control gets a fresh event);
the Android system back button is not handled by the page; the Android-dialog
fallback and a real gift send from the native page were not exercised; behavior
of the page across a scene change and prolonged stability are untested.

## Instant Loading, Performance Mode and Skip Encounter Intro validation

Three former "Planned" slots are implemented (`agent/adapters/game-map-refresh.js`,
`agent/adapters/game-performance.js`, `skipIntro()` in
`agent/adapters/game-encounters.js`). Local: `npm test` (sixteen suites) pass,
including `tests/map-refresh.test.cjs`, `tests/performance-mode.test.cjs` and the
extended `tests/encounter-adapter.test.cjs`.

Discovery (one probe session, GO 0.431.0, PID 9928; log
`build/features-discovery-probe.jsonl`):

- Map refresh: live `SpaceTimeThrottle` on `MapContentHandler` was 10 s / 30 s /
  10 m, matching `MapSettingsProto`.
- Encounter timeline for a wild Pokémon, tap to `IntroCompleted`: 1713 ms on the
  first entry; with the camera's tween/intro durations zeroed, 766–798 ms over
  four later entries (scene assets were cached by then). The intro itself went
  from 775 ms to about 63 ms. Replacing the GUI `ShowIntro` changed nothing
  measurable, and zeroing the approach state's turn/fade timings did not shorten
  the ~335 ms approach phase, so neither is part of the feature.
- Performance: each reduction was applied and reverted by hand with screenshots
  (`build/performance-baseline.png`, `build/performance-all-on.png`,
  `build/performance-quality-low.png`, `build/performance-restored.png`).
  Resolution scale 0.6 rendered 463x1039 instead of 771x1731. No event map theme
  was active, so theme switching could not be verified and is not implemented.

`build/pgql-debug.apk`: 45650459 bytes; SHA-256
`079e333bae4b9f69eac2eab30364b8f48b581924cbe56eb3520864350e079799`. Installed
and attached from the controller to the same game process:

- All three appear as working rows with descriptions in the native settings
  page; Performance Mode's four options are indented sub-toggles.
- **Instant Loading**: enabling logged original 10/30/10 and applied 3/5/10; the
  status dialog showed both (`build/features-instant-loading-status.png`);
  disabling logged `Map refresh restored` with 10/30/10.
- **Performance Mode**: with all four on, status reported each as on
  (`build/features-performance-status.png`) and the map showed no clouds or
  roads at reduced resolution (`build/features-performance-map.png`). Switching
  Remove roads off and then the module off logged `Performance Mode restored`
  and the map returned to normal (`build/features-performance-restored.png`).
- **Skip Encounter Intro**: status `ready`; a wild encounter opened with the
  ball and GUI ready in the first screenshot about 1.4 s after the tap and was
  left with the run button (`build/features-skip-intro-encounter-early.png`,
  `build/features-skip-intro-encounter.png`). The three modules were switched
  off again afterwards; saved preferences show all three disabled.

Attach reliability during this work: three consecutive probe attaches to freshly
started, foreground game processes ended in the documented
`libNianticLabsPlugin.so` SIGSEGV (`build/features-attach-crash.log`, PIDs 7877,
8562, 9359). Attaching with the game in the background, as the controller does,
succeeded for both the probe and the controller session. This is an observation
from few samples, not an established cause.

Not established: the actual map request cadence and any change in how quickly
Pokémon appear with Instant Loading (only the throttle values were verified);
frame rate, battery or temperature effect of Performance Mode; weather hiding
with active rain/snow (the weather was clear); the 30-second re-assertion; Skip
Encounter Intro in raid, Team GO Rocket, quest or AR+ encounters, and together
with an actual catch; behavior across a settings re-download; prolonged
stability.

## Shows IVs in Inventory validation and settings page scroll fix

`agent/adapters/game-inventory-ivs.js` replaces the name label of each Pokémon
inventory cell with its `Attack/Defense/HP` IVs after the game fills the cell.
Local: `npm test` (seventeen suites) pass, including
`tests/inventory-ivs.test.cjs`.

`build/pgql-debug.apk`: 45650459 bytes; SHA-256
`3f7d92808ba750085bcf754c2ee8658bb95ab5c7d93ca707fb7e3488073fee6f`. Installed
and attached from the controller (GO 0.431.0, PID 14960):

- A probe run of the same label change first showed IVs on all visible cells
  (`build/inventory-ivs-probe.png`).
- With the module enabled from the native settings page, the inventory grid
  showed IVs instead of names, including after scrolling
  (`build/inventory-ivs-enabled.png`, `build/inventory-ivs-scrolled.png`);
  status reported `ready` (`build/inventory-ivs-status.png`).
- After disabling, the inventory showed names again
  (`build/inventory-ivs-disabled.png`). The inventory was closed at that moment,
  so the in-place restore of visible cells reported `cells: 0` and is covered
  only by the unit test.

Settings page fix found during this work: pulling the list down past its top is
the game's close gesture, and on the copied screen it called the game's own
dismiss handler, which failed and left scrolling locked until the close button
was used. The gesture now runs the page's back handler; pulling down closed the
page and returned to the map (`build/native-settings-pull-close.png`).

One more attach-time `libNianticLabsPlugin.so` crash occurred (PID 9928, probe
attached with the game in the background, crash a few seconds after it was
brought forward), so background attaching does not prevent it.

Not established: IV labels in other screens that reuse the cell (trade, battle
party and transfer pickers were not opened), behavior with name sorting or
search, and in-place restore on visible cells.

## Transfer on Catch validation and text settings

`agent/adapters/game-transfer-on-catch.js` releases a just-caught Pokémon through
the game's bag service unless `agent/core/transfer-policy.js` keeps it; see
[TRANSFER-ON-CATCH.md](TRANSFER-ON-CATCH.md). The runtime gained a `text` setting
type for its minimum IV and ignore list. Local: `npm test` (nineteen suites)
pass, including `tests/transfer-policy.test.cjs` and
`tests/transfer-on-catch.test.cjs`.

Discovery (one probe session, GO 0.431.0, PID 29227; log
`build/transfer-discovery-probe.jsonl`), read-only apart from one test toast:

- Names and signatures for the catch result, `IPokemonBag`, `PokemonProto`,
  Pokémon settings, the origin detail, the toast service, the accessory action
  log handler and the item selector were read from live metadata.
- The adapter's own contract check bound every part, and its snapshot plus the
  policy were run over the 561 Pokémon already in the bag without releasing
  anything: 170 would be transferred with default settings; the rest were kept
  as non-wild (233), special ball (55), shiny (32), 100%-IV preference (26),
  background (21), legendary/mythical (9), shadow (3), ignore list (2) and 0% IV
  (1).
- A two-line toast with the green background rendered
  (`build/transfer-toast-probe.png`).

`build/pgql-debug.apk`: 45658651 bytes; SHA-256
`6bef0dca80f3d4c60132b160e3073b7c9be1279e5b9fcecab6f88871783d1a94`. Installed
and attached from the controller to a freshly started game (PID 3281). Three
builds were attached to that process in turn while fixing the settings dialog;
logs are `build/transfer-on-catch-session-1.log` to `-3.log`.

- The module appears under INVENTORY with its description, five indented
  switches, two value buttons and a status button
  (`build/transfer-settings-rows.png`). It logged
  `Transfer on Catch ready {toast, accessory, bypass: true}`, and its enabled
  state and settings were restored on each re-attach.
- **Transfer**: with Headshot, Perfect Throw, Instant Catch and Skip Encounter
  Intro also on, a wild Electrike (13/5/15) was caught and released; the toast
  read `Successful Capture! [Transferred] +1 XL Candy`
  (`build/transfer-catch-1.png`). On that first build the release answer could
  not be read (`RpcPromise` inherits its callbacks); this was fixed afterwards.
- **Text setting**: tapping `MIN. IV: 100` opened the input dialog; `abc` was
  rejected with `Invalid IV…` in a game prompt and nothing was stored; `1` was
  saved and the button changed to `MIN. IV: 1` in place
  (`build/transfer-min-iv-saved.png`). It was set back to `100` afterwards and
  the saved preferences show `"minIv":"100"`.
- **Kept by preference**: with Min. IV 1, a wild Blitzle (9/3/9) was kept with
  `[Meets Preference, Not Transferred]` (`build/transfer-kept-1.png`).
- **Kept by protection**: a wild shiny Electrike (14/6/15) was kept with
  `[Not Transferred]`, reason `shiny` (`build/transfer-bypass-kept.png`).
- **Bypass**: in that encounter the ball selector's info button closed the
  selector and showed `Transfer On Catch was disabled for this encounter.`
  instead of the info panel (`build/transfer-bypass-slider.png`,
  `build/transfer-bypass-toast.png`).
- **Status** showed the counts and the last decision
  (`build/transfer-on-catch-status.png`).

Two defects found on the device and fixed: the input dialog could not set or
read its text through `EditText` (it now uses the `TextView`/`CharSequence`
members and turns keyboard suggestions off), and value buttons overflowed the
indented group (they now span the card).

The module was switched off again at the end; saved preferences show it
disabled with default settings. The game process survived the probe, three
attaches and the catches without a crash.

Not established: a release answer read on the final build (the one live
transfer ran on the first build, where the answer could not be read; the fix is
covered by the unit test only, and that Electrike was not looked up in the bag
afterwards); the bypass keeping a Pokémon that no other rule protects (the
bypassed catch happened to be shiny, so the shiny rule answered first); accessory
catches (the trigger bound, but no GO Plus catch reached the action log during
the session); shadow, background, XXS/XXL, special-ball and ignore-list catches
on live encounters (covered by the dry run over the bag and the unit tests); the
600-frame give-up; incense and lure catches, which are kept if the game reports
those origins; the Android fallback dialog's text controls; and prolonged use.
