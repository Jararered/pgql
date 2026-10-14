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

## Shiny Scanner validation

Implemented as `agent/core/scanner-policy.js`, `agent/adapters/game-shiny-scanner.js`
and `agent/modules/shiny-scanner.js`, plus `ctx.notify` in the runtime and an
alert channel in `SessionService`; see [SHINY-SCANNER.md](SHINY-SCANNER.md).
Local: `npm test` (twenty-one suites) passes, including the new
`tests/scanner-policy.test.cjs`, `tests/shiny-scanner.test.cjs` and the
notification case in `tests/runtime.test.cjs`.

Discovery (one probe session, GO 0.431.0, PID 10588; log
`build/shiny-discovery-probe.jsonl`):

- All six spawn classes share `MapPokemon.SendEncounterRequest()` →
  `Promise<PokemonEncounterResponse>`, `get_Location()` (`Niantic.LatLng`) and
  `get_HoloCharacter()`. `PokemonEncounterResponse` has no Pokémon, and
  `get_Pokemon()` still has zero IVs after the answer; the result sits in one
  obfuscated field per class whose type is the encounter result proto.
- One live request on a wild Murkrow 40 m away returned `EncounterSuccess`,
  9/14/12, CPM 0.612, size M.
- On that Murkrow, `LoadPokemon(198, clone with Shiny=true, true, LOAD_ALWAYS,
  M, false)` completed, `set_IsShiny`, `TryShowShinySparkles` and
  `set_ScaleFactor(1.5)` ran, and `ParticleSystem.set_startColor` tinted its
  ripple red (`build/shiny-probe-model.png`). The scale and the red ring are
  visible; whether the shiny colouring rendered could not be told from the
  screenshot.
- `IPlayerProximityService.DistanceM`, `IPlayerService.get_PlayerId/MaxPokemon`
  and `IPokemonBag.get_Count` resolve from the map container (bag 555/625).

`build/pgql-debug.apk`: 45670939 bytes; SHA-256
`cbfe401b14fb12452b96fbc32646757a1d1b59985b7014bc8e68732da6ad3317`. Installed
and attached from the controller (logs `build/shiny-scanner-session-1.log` for
the first build, `build/shiny-scanner-session-2.log` for this one):

- `Shiny Scanner ready` with all six spawn kinds and all optional parts bound
  (toast, model, ripple, names).
- Wild spawns were scanned one by one and read correctly, e.g. Murkrow 9/14/12
  again, Cacnea 8/13/4, Duskull 13/13/6.
- The in-game settings page shows every row with its description
  (`build/shiny-scanner-settings.png`); Minimum IV was set to 50 through its
  dialog. After the module was switched off and on (fresh cache), four alerts
  fired with names from the game: `69% Ponyta`, `71% Duskull`, `78% Murkrow`,
  `56% Cacnea`. Lower-IV spawns produced no alert.
- Four Android notifications were posted on the `alerts` channel with
  coordinates (`build/shiny-scanner-notifications.png`); tapping one opened the
  `geo:` chooser offering Maps and GPS JoyStick
  (`build/shiny-scanner-geo-chooser.png`). It was dismissed without choosing.
- A scanned Murkrow shows the green "scanned" ripple on the map
  (`build/shiny-scanner-map.png`).
- Minimum IV was set back to 100 and the module switched off; `disabled` was
  logged with no cleanup error.

Defect found on the device and fixed: the first build bound the abstract
`II18n.PokemonName` and calling it raised an access violation (caught; alerts
would have shown `#198`). It now calls the resolved service's implementation;
the second build logged no name error and showed localised names.

Attach reliability during this work: of six attaches (two probe, four
controller), four ended in the documented `libNianticLabsPlugin.so + 0x254328`
SIGSEGV about a second after attaching (`build/shiny-probe-crash-1.log`,
`build/shiny-attach-crash.log`, `build/shiny-attach-crash-2.log`), including
one with the game already in the background for 8 s. Attaching after the game
had been in the background for about 10 s, and the controller attach after the
game had sat on the map for 60 s, succeeded.

Not established: a toast on screen (alerts were logged with Show Toast on, but
no screenshot caught one); shiny, shundo, Ditto, legendary, badge, background
and XXL/XXS results on live spawns; the module's own shiny/Ditto/size redraw (only
the probe exercised the calls); lure, incense, route, photobomb and station
spawns (their contracts bound but none were scanned); the far-spawn retry,
hundo pause and storage-full pause on the device (unit tests only); the 15 s
timeout; how the server treats repeated scan requests; and prolonged use.

## Tap to Teleport validation

Original implementation: `agent/adapters/game-tap-to-teleport.js`,
`agent/adapters/mock-location.js`, `agent/modules/tap-to-teleport.js`,
`ctx.teleport` in the runtime and `teleport()` plus alert taps in
`SessionService`; see [TAP-TO-TELEPORT.md](TAP-TO-TELEPORT.md). Local:
`npm test` (twenty-two suites) passes, including the new
`tests/tap-to-teleport.test.cjs`.

Discovery (three read-only probe sessions, GO 0.431.0; logs
`build/teleport-discovery-probe.jsonl`, `-2.jsonl`, `-3.jsonl`):

- `GroundTapHandler.OnTap(Object, EventArgs)`. In Pokemod's agent it was a
  single tap-event argument. The `TapGesture` sender holds `startPosition`
  (`Vector2`), and the handler keeps one `IMapController` field, which has
  `GetGroundLocation(Vector2, LatLng&)`.
- The Nearby icons, `IMapEntityService.GetMapPoi`, `IPlace.get_Location`,
  `PokemonFortProto.Latitude/Longitude` and
  `NearbyPokemonGuiController.DismissWithPermissions` match Pokemod's use.
  The stamp controllers live in `Niantic.Holoholo.Collections`; the detail page
  keeps its location in one obfuscated `LatLng` field, and `backButtonAction` is
  on `GuiController`.
- GPS Joystick 5.3.3 exports `.service.OverlayService` for
  `theappninjas.gpsjoystick.TELEPORT` with no permission.

Device session (GO 0.431.0, PID 22730; APK 45675035 bytes, SHA-256
`4b353ad9badc252f476d5b7aad12884099b22e9523ad019e419d5e6ce7a3da26`; logs
`build/teleport-session-2.log`, summary `build/teleport-validation.json`):

- Enabling the module logged `Mock location hidden` (2 checks) and
  `Tap to Teleport ready` with the Nearby and stamp parts bound.
- **Double tap with GPS Joystick stopped:**
  - The explicit `startService` was refused ("app is in background").
  - The root `am start-foreground-service` fallback started GPS Joystick at its
    saved location and brought its main screen, with an ad, to the front.
  - The repeat 2 s later moved the mock location to the tapped
    38.900837,-76.997702. Before this repeat was added, a cold start stayed at
    GPS Joystick's saved location in New York.
- **Double tap with GPS Joystick running:** the jump went straight to
  `OverlayService`. The game stayed in front and the mock location became
  38.901235,-76.997861 (`build/teleport-after.png`).
- **Single tap:** no teleport.
- **Nearby Pokémon at a stop:** jumped to 38.900345,-76.998057 and the menu closed
  (`build/teleport-nearby.png`, `build/teleport-nearby-after.png`).
- The game showed no mock-location warning during the session.

Attach reliability:
- The first probe attach ended in the documented `libNianticLabsPlugin.so`
  SIGSEGV (`build/teleport-probe-crash-1.log`).
- A controller attach to the same PID after three probe sessions crashed the same
  way (`build/teleport-attach-crash-1.log`).
- One controller attach to a fresh game crashed in ART's GC root walk
  (`VisitShadowFrame` on `HeapTaskDaemon`, `build/teleport-attach-crash-2.log`).
  This was before Tap to Teleport was enabled, with the saved module set loading.
- The next attach was stable.

The final APK only differs by the Shiny Scanner setting description; it was not
reinstalled for a second session.

Not established on the device:
- the raid, showcase, Power Spot and stamp teleports (bound, not tapped);
- tapping a real module alert (the same `TELEPORT` service action was started
  directly and moved the location);
- turning `nearbyMenu`/`hideMock` off live;
- whether the server reacts to the jumps;
- prolonged use.

## Pokémon GO 0.433.0 upgrade — October 14, 2026

The phone auto-updated Pokémon GO to **0.433.0** (Unity 6000.3.22f1). Every
adapter was gated to 0.431.0, so the in-game PGQL row fell back to the floating
button and every game module refused to start. The gate is now one constant,
`agent/core/game-version.js`, set to 0.433.0. Each adapter was re-checked on
the new build rather than just ungated.

Final APK `build/pgql-debug.apk`: 45,683,227 bytes, SHA-256
`0821b06c1ea942403b22d286f9d552940bfbbbe55d4c6fc0db14868862fbb384`. All local
suites and the native JSON host check pass. The live sessions below ran on the
two preceding builds, which differ only in the encounter fix and a comment.

**Managed (il2cpp) adapters** — the real bundle was attached to a backgrounded,
freshly started game and each module enabled over the runner's command pipe
(`build/433-session-1.jsonl`, `build/433-session-2.jsonl`):

| Module | 0.433.0 result |
|---|---|
| Main menu row + native settings pages | Bound; PGQL row and settings rendered (`build/433-main-menu.png`, `build/433-settings.png`) |
| Instant Loading, Performance Mode, IVs in Inventory | Bound, ready |
| Transfer on Catch, Shiny Scanner, Tap to Teleport, Cooldown Tracker | Bound, ready |
| Tamagotchi (buddy profile) | Bound; a care pass fed the buddy 3 times |
| Mass Gift | Enabled; no batch was run |
| Instant Catch, Perfect Throw, Headshot, Skip Encounter Intro | **Failed** first: the obfuscated encounter-state, Pokemon and reticle field names were renamed. Now bound by unique declared type; all four ready on the next build |

A live encounter with the four encounter modules on opened without errors. One
throw caught the Pokémon, Instant Catch closed the encounter, and Cooldown
Tracker recorded the catch (`build/433-encounter.png`,
`build/433-after-throw.png`). Transfer on Catch was switched off first. The
field layout came from a throwaway metadata probe (`build/433-probe.jsonl`).

**Virtual GO Plus** — all 17 `libholoholo.so` exports exist in 0.433.0. Every
function that touches the pinned offsets is identical to 0.431.0 apart from
addresses (`build/go-plus-433-offsets.txt`; see GOPLUS.md). A dedicated
controller GO Plus session armed on 0.433.0, advertised, paired on the first
connect tap, and dispatched 1 catch and 7 spin requests within about 12 s. It
then detached with the shutdown acknowledged; both game processes stayed alive
(`build/433-goplus-logcat.log`).

Session hygiene: the enables used for testing were persisted to the game's PGQL
settings. They were turned back off afterwards, so the saved set is again Library
watch, Mass Gift and Tamagotchi. No attach crashed during this upgrade.

Not established on 0.433.0: Mass Gift send/open, Shiny Scanner alerts, Tap to
Teleport jumps, Transfer on Catch transfers, Performance Mode visual effects,
GO Plus reconnect, and prolonged use.

## Pinap Master validation — October 14, 2026

Final APK `build/pgql-debug.apk`: 45,691,419 bytes, SHA-256
`2ae6f755a2d87bb57bf8503600f13a93e30e056715b148d82795a49be865a19b`. Its
`agent.js` (SHA-256 `80732196…755182d`) is byte-identical to the bundle used in
the second live session. All twenty-six suites and the native JSON host check
pass. Summary: `build/pinap-master-validation.json`.

Discovery (two probe sessions, GO 0.433.0; `build/pinap-probe-details.json`,
`build/pinap-probe2-dump.json`): `EncounterInteractionState` exposes
`get/set_ActiveBerry`, `get_CanUseBerry`, `SelectBerry` and a typed `IItemBag`
field. `IItemBag.UseItemForEncounter(Item, IMapPokemon)` exists, and the berry
selector's ⓘ button sits in `TopInfo`, anchored top-right at (−60.35, 40.35). A
live call showed that `SelectBerry(Pinap)` only puts the berry in hand. The
game's own tap-to-feed set `ActiveBerry`, cleared `CanUseBerry` and used one
Pinap; that is the state the module reproduces.

Live sessions (the real bundle attached to a backgrounded, freshly started game,
then driven over the command pipe; `build/pinap-session-1.saved.jsonl`,
`build/pinap-session-2.jsonl`):

- Bound with button, picker and confirmation. Entering a wild Blitzle fed a
  Pinap at once. The server confirmed it, the bag went 66 → 65, and the game
  showed its berry badge (`build/pinap-fed.png`).
- The button appeared opposite the ⓘ (`build/pinap-slider-button.png`). The
  first build still showed the ⓘ icon because the list fills after `Initialize`;
  the final build repaints on `HandleOpenComplete` (Razz icon,
  `build/pinap-slider3.png`).
- The picker opened as the game's dialog (`build/pinap-picker.png`). Choosing
  Razz saved the setting and showed `Razz Berry selected`
  (`build/pinap-picked.png`). The choice survived a game restart and reattach.
  The next wild encounter (Electrike) got a Razz (17 → 16).
- A spawn the server already had a Pinap on was not fed again.
- Disabling logged no errors. The next encounter had no button and no feed
  (`build/pinap-disabled-slider.png`).

Session hygiene: the game restored its saved PGQL settings on foreground, which
include Perfect Throw, Headshot, Instant Catch and others. Those three were
turned off for one throw and back on afterwards. Pinap Master is left enabled
with Pinap selected. Both throws caught the Pokémon (2 catches). No attach
crashed. Before probing, three runners were attached (an old command-line session and a controller main + GO Plus session); they were
stopped and the game restarted before probing.

Not established on a device: re-feeding after a breakout, the raid/Rocket skip,
the out-of-stock path, the picker's cycling fallback, and prolonged use.

## Gym Feeder validation — October 14, 2026

Final APK `build/pgql-debug.apk`: 45,695,515 bytes, SHA-256
`489d2de99b4bcf23cd770e622d52d027f4a0e6b33708d0ac35a521bde92bfb40`. Its
`agent.js` (SHA-256 `fc795454…5d16818`) is byte-identical to the bundle used in
the live session. All twenty-eight suites and the native JSON host check pass.
Summary: `build/gym-feeder-validation.json`.

Discovery (three probe sessions on one game process, GO 0.433.0;
`build/gym-probe-meta.json`, `build/gym-probe-{1,2,3}.jsonl`):
`IItemBag.UseItemOnGymDefender(Item, UInt64, String)` is implemented by
`Niantic.Holoholo.Internal.ItemBagImpl`, and the game's own feed dialog called it with a
Razz (701), the defender's `PokemonProto.Id` and the gym id
`3a95…cb21e2f.16`. The answer was `Success` with +30 stardust and +50 XP and
the updated `GymStatusAndDefenders`. The result enum has `Unset`, `Success` and
twelve `Error…` names (`ErrorPokemonFull=5`, `ErrorTooFast=9`,
`ErrorTooFrequent=10`, …). The defenders' `PokemonProto.deployedFortId_` is
empty here, so the gym id comes from `MapGym.get_Id()` (`AbstractMapPlace`).
Leaving a gym fires `GymState.ExitState`; entering fires `EnterState`, then
the gym data, then `HandleOpenComplete`. Returning from a defender's details
fires `HandleOpenComplete` again. A probe-driven call with the same arguments
also returned `Success` (Snorlax 0 → 0.15 motivation). A second Razz right away
was accepted with a smaller gain (+0.06), so there is no fixed per-feed
cooldown. A direct call does not redraw the gym screen on its own.

Live session (the real bundle attached to a backgrounded, freshly started game,
then driven over the command pipe; `build/gym-feeder-session-1.jsonl`):

- Bound with the screen refresh and the toast. The cap was set to 6 for the run.
- Opening the in-range Valor gym (player team Red, six defenders at about zero
  motivation) started a visit. Six Razz Berries were fed, one per defender, all
  `Success`; the visit ended at the cap with +180 stardust and +300 XP. The
  toast appeared, and the gym redrew at once with higher CP (for example
  Rhyperior 664 → 955, Slaking 1005 → 1448; `build/gym-feeder-after-visit.png`).

Session hygiene: the controller session (main and GO Plus runners) was detached
from its UI before probing and the game restarted. After two of the probe
shutdowns the runner kept running and was stopped with SIGINT; the game was not
affected, and no attach crashed. The cap was put back to 20, the test runner
shut down, and the controller attached again with Gym Feeder enabled.

Not established on a device: rival, neutral and out-of-range skips, the
per-defender refusals, "too fast" back-off, the empty-bag path, leaving
mid-visit, and prolonged use.

## Auto Gym Battle validation and Raid Pack fix — October 14, 2026

Final APK `build/pgql-debug.apk`: 45,720,091 bytes, SHA-256
`238bbae06886179b2d847c0d7f977b9b572137161004766335d8477de355e08d`. Its
`agent.js` (SHA-256 `891041be7a164db3e451826921ce98978d0966ffcb1710cfa0894055f363a1ac`)
was attached in the last session. All thirty-three suites and the native JSON host check pass
(`build/auto-gym-tests.log`).

Discovery (probes on GO 0.433.0; `build/auto-gym-metadata.json`,
`build/auto-gym-probe-{1,2}.jsonl`, `build/auto-gym-session-{2,3}.jsonl`):

- Gym battles do not use the VNext battle director that raids use.
  `Gym.GymBattleState` (subclass of `Gym.BattleState`) runs the legacy
  client-driven system. Its frame service
  `BattleFrameObservableService` exposes `TryOrQueueAttack`,
  `TryOrQueueSpecialAttack(move3)`, `TryDodge` and `TrySwap(PokemonProto)`.
  The planned shared VNext layer was therefore not built; the gym adapter is
  separate and Raid Pack was left as it was, apart from the fix below.
- In a live battle, frames showed the roster, the active index, the swap flag,
  and enemy actions with start time, duration and damage window.
  `BattleTimingService.TimeUntilAttackLands` counted down from about 1.1 s
  through 0 for each enemy attack.
- Between defenders the frame stays at status 2 for about 19.5 s with the
  server clock frozen. The screen shows "Next up" with a counting-down Battle
  button: `Gym.Battle.GymBattleContinueGuiController`, whose public
  `ContinueToNextBattle()` is what the button calls.

Live battles against the Instinct gym "Lest We Forget" (player Valor):

1. Controller session, first build (`build/auto-gym-controller-logcat.log`):
   the rival gate read gym team 3 and player team 2. The battle was won with
   136 fast and 22 charged attacks, 0 dodges and 24 refusals. Three swaps:
   - Ho-Oh → Solgaleo against Dragonite (1.98×);
   - Ho-Oh → Typhlosion against Wailord (1.62×);
   - Typhlosion → Reshiram against Magnezone (1.85×).
2. Probe session (`build/auto-gym-session-2.jsonl`,
   `build/auto-gym-shots/`): 71 fast and 14 charged attacks, 3 swaps, 12
   refusals. The defenders used only fast attacks, so no dodge was attempted.
3. Countdown build (`build/auto-gym-session-4.jsonl`): every part bound,
   including `countdown`. Five "Next up" countdowns were skipped (6
   defenders). 52 fast and 5 charged attacks, 1 swap (Solgaleo → Reshiram
   against Magnezone, 1.85×), 16 refusals.

After these battles the gym fell to neutral and an egg appeared, so the
refusal breakdown build (per-kind counts and a refusal log) was attached and
bound but not battled.

Raid Pack, shadow Gible raid (`build/auto-gym-probe-2.jsonl`,
`build/raid-live-*.png`, `build/raid-pack-moveset-toast-live.png`):

- The moveset toast showed "Gible · Take Down / Body Slam" on the raid, and the
  raid result screen was skipped after the win.
- Auto-attack failed on every step with `expected a pointer` and stopped after
  five. The cause was plain numbers written to enum fields; it is fixed and
  covered by the test (see [RAID-PACK.md](RAID-PACK.md)). The fix has not yet
  been seen in a raid. The raid was won with manual taps. Background taps
  continued past the end of the raid, and the outcome of its catch encounter
  is unknown.

Session hygiene: one runner at a time; the controller session was detached
from its UI before each probe, and the game was force-stopped before each
attach. Every probe runner shut down with its script eternalized. One probe
session ended when the game was restarted from the controller. The controller
session was restarted at the end and restored the saved modules.

Not established on a device: an Auto Gym Battle dodge, the manual-tap pause, a
friendly-gym skip, what each refusal was, and Raid Pack auto-attack and dodging
after the enum fix.

## Raid Pack validation — October 14, 2026

Final APK `build/pgql-debug.apk`: 45,711,899 bytes, SHA-256
`e9a9ecbad67c2e139a9b07177a2e35b3ba051aeb730c416ee788a657b0077062`. Its
`agent.js` (SHA-256 `6bfbae43…7d49f60`) is byte-identical to the bundle used in
the live session. All thirty-one suites and the native JSON host check pass
(`build/raid-pack-tests.log`). Summary: `build/raid-pack-validation.json`.

Discovery (probe sessions on GO 0.433.0, each on a freshly started game;
`build/raid-pack-metadata*.json`, `build/raid-probe-{1,2,3}.jsonl`):

- Every class Pokemod's Raid Pack names exists. However,
  `BattleDirector.NewTurn` / `ProcessBattleUpdate` and
  `RaidBattleVNextState.PlayRaidBattleMusic` are obfuscated, and the approach
  camera coroutine's progress field is one of three unnamed floats. The adapter
  uses public members instead: `BattleDirector.get_CurrentState`,
  `TrySubmitPlayerAction`, `BattleState.CurrentTurnSyncInfo`, actor and Pokémon
  states, `BattleTurnAction`, `AnimationDefinition.duration`, and the named
  sequencer and `RaidState` timings (contract in
  [RAID-PACK.md](RAID-PACK.md)).
- On the game thread, the generic
  `IGameMasterData.MaybeGetByKey<MoveSettingsProto>(Enum)` (implemented by
  `GameMasterData`), inflated at runtime, returned Wrap (13): −33 energy,
  damage window 2150–2800 ms. `Get_TypeEffectiveness(Water, Fire, None)` = 1.6
  and the reverse = 0.625. `I18n.PokemonMoveName(13)` = "Wrap" and
  `PokemonName(150)` = "Mewtwo".
- The first broad probe enumerated every method of every class on the agent
  thread and did not finish. Its runner was killed and the game restarted. The
  later probes look up named types only.

Live session (the real bundle attached to a backgrounded, freshly started game,
then driven over the command pipe; `build/raid-pack-session-2.jsonl`):

- All ten parts bound: skips, results, maxResults, battle, dodge, manual,
  movesets, stations, toast and names. The first attempt
  (`build/raid-pack-session-1.jsonl`) showed that nested types (`Outer.Inner`)
  are not found by the shared top-level lookup. The adapter now resolves them
  through the declaring type.
- Opening the nearby raid gym (still an egg) ran the approach camera skip once.
  The definition-class check confirmed the argument register. No moveset toast
  was shown for the egg.
- Shutting down restored the shortened timings on the game thread ("Raid Pack
  timings restored"). The runner detached without a crash.

Session hygiene: the controller session was detached from its UI first, and the
game was force-stopped before each probe and session. The first probe runner
was blocked by its metadata walk and was killed. The others shut down with their
scripts eternalized (resident-agent mode), and each was followed by a game
restart. No attach crashed the game.

Not established on a device: raid battles (auto-attack, charged move choice,
dodge timing, manual tap pause), the raid intro and result skips, Max Battles,
the moveset toast on a hatched raid or Power Spot, and prolonged use. No raid
was available when this was written.

## One-button Start, early attach and attach lag

The controller's **Launch game** and **Attach** buttons became one **Start**:
`SessionService` root-force-stops the game, launches it, waits until
`libil2cpp.so` is mapped in the new process (the loading screen), waits 1.5 s
and attaches. A game that dies before, or within 30 s of, the agent's `ready` is
relaunched, up to three attempts; the tombstone's signal and top frames are
copied into the session log. On the agent side, every adapter now shares one
`ExecuteTasks` hook and type cache with a ~6 ms per-frame budget, binds
metadata on the agent thread (`game.metadata`), waits for `il2cpp_init` itself,
and `pgql-menu` re-enables saved modules only once the map scene exists, one
every 300 ms. Modules that turn themselves off after an error no longer change
the saved settings. Local: `npm test` (twenty-nine suites, new
`tests/game-scheduler.test.cjs`) passes.

`build/pgql-debug.apk`: 45699611 bytes; SHA-256
`32aeca29386043cfe30907f2714ac1b6c0305cf9abb8b9b61f6bc6dba1a62955`. GO 0.433.0,
Pixel 9a (Android 17), 15 saved modules enabled. Logs: `build/start-run-*.log`,
summary `build/start-validation.json`.

- 16 Start sessions (game closed, or running after a Detach): 15 reached the map
  with saved modules restored, 15–16 s after the tap; the agent was ready
  3.8–4.9 s after the restart. 6 of 21 attempts crashed; retries recovered two
  sessions and one session crashed three times and stopped with an error.
- Every crash was the known `libNianticLabsPlugin.so` SIGSEGV (`SEGV_ACCERR`
  into an `anon:libwebview reservation` page, same caller frames), 1–2 s after
  injection. A script containing only one `send()` crashes the same way
  (18 trials: 1/6 at +1.5 s, 5/6 at +0 s, 6/6 at +7 s), so it is a reaction to
  the injection itself, not to anything the agent does, and attach timing does
  not avoid it. The rate varied a lot between batches.
- Lag: game-thread jobs over 16 ms are now logged. In runs 11–16, module startup
  produced 35 such jobs (median 24 ms, max 66 ms, Instant Loading), each in its
  own frame, spread over ~5 s. Before this change all of them, plus every
  module's metadata binding and the encounter modules' full class scans, ran
  in the same frame; that baseline was not measured. Tamagotchi's buddy-care
  passes take 18–47 ms per frame while running.
- Saved preferences were unchanged after runs 11–16. Before the final fix, a
  Gym Feeder start failure was saved as "off" by a later save; failed modules
  now stay saved as on until the user changes them.
- Detach during "Waiting for the game to load" left the session idle with no
  runner. The GO Plus session button attached and armed Virtual GO Plus.
- Gym Feeder and the Pinap Master button each once failed with Frida's
  `unable to intercept function … please file a bug` (run 10). It also occurred
  in an older probe log (`build/gym-probe-3.jsonl`), so it predates this change.
- Detaching from a game that is in the background hung (no shutdown ack from
  the frozen process); force-stopping the game ended the runners.

Not established: the old flow's frame-time baseline, and whether the crash rate
differs from attaching on the map (earlier notes recorded 4 of 6 and 3 of 3).

## Attach-time Frida names (2026-10-14)

Implemented the checksum-bound `names-v1` devkit build copy and changed the
Java bridge's generated DEX prefix in its build copy. PokeMod's packaged
injector was inspected read-only: its native engine uses Floyd names and
lacks the corresponding stock Frida literals. This establishes static
renaming evidence, not equivalence to all of PokeMod's hiding behavior.
The REA target identity was confirmed; its native string/decompiler query
timed out after 300 s. Bounded filesystem literal evidence is retained in
`build/pokemod-frida-names-evidence.json`. Details: `docs/FRIDA-HIDING.md`.

Local: all 29 Node suites and four Python hiding checks passed through
`npm test`; the native JSON parser passed with address/undefined-behavior
sanitizers. The signed APK built and verified. Vendor and npm inputs were
left untouched.

Final APK: 45,703,707 bytes, SHA-256
`26ba61b4af1c6cc7661c1c19b501381fb3741eb0562eebff42bcbc107e74b11e`.
Installed on the connected Pixel 9a, Android 17 / GO 0.433.0 after gracefully
detaching the existing main and companion runners. The normal controller
Start flow restarted the game; the main process PID 30169 and GO Plus
companion PID 30512 both reported `ready` with `frida_hiding:"names-v1"`.
Saved modules restored and the companion reported Virtual GO Plus ready.

External root inspection of both processes confirmed
`/memfd:pgql-worker-64.so` mappings and `pwork`/`pcomm` threads. Main-process
proxy DEX mappings used `cache/pgql*.dex`. The captured maps had no `frida`
names, and the task-name snapshots contained none of `gmain`, `gdbus`,
`gum-js-loop`, `frida` or `pool-frida`. These snapshots prove the observed
names changed; they do not prove absence of other fingerprints. Evidence:
`build/frida-hiding-validation.json`, `build/frida-hiding-device.log`,
`build/frida-hiding-tests.log`, `build/frida-hiding-build.log`, and
`build/frida-core-names/names.json`. The final session was left attached.

Not established: long-term stability, a change in the intermittent Niantic
plugin crash rate, or complete detection resistance. Exported entry points,
Frida protocol names and SELinux labels remain upstream.

## Tap to Catch validation — October 14, 2026

Final APK `build/pgql-debug.apk`: 45,724,187 bytes, SHA-256
`527d2a508d93813ea7c5faa3bf1d3ec7241505f925aa9367417b98f2dcfe3a29`. Its
`agent.js` (SHA-256 `ac584779…fee72ceb`) is byte-identical to the bundle used in
live session 4. All thirty-five Node suites and the Python check pass. Summary:
`build/tap-to-catch-validation.json`.

Setup. The controller's main and companion runners from the earlier session were
stopped with the `STOP` intent, after saving logcat to
`build/tap-to-catch-pre-restart-logcat.log`. For each session the game was
force-stopped and relaunched, then the real bundle was attached over the
command pipe to the backgrounded game (`build/tap-session.sh`,
`build/tap-restart.sh`). The game restored its saved PGQL modules, including
Perfect Throw, Headshot, Instant Catch, Pinap Master (Pinap), Cooldown Tracker
and Transfer on Catch (min IV 90).

Results:

- Every session bound all parts: hold, memory, remove and toast.
- **Sessions 1–2 found a bug.** Calling `get_EncounterId` through the
  `MapPokemon` base declaration raised an access violation. The fallback worked:
  the normal encounter opened, and Pinap Master fed it. The fix resolves
  `MapPokemon` methods on the tapped object's own class.
- **Session 3.**
  - **Cacnea.** A tap fed a Pinap, then threw an Ultra Ball (the ball the game
    had pre-selected, remembered in session 1) as an Excellent curveball.
    - Result: `CatchSuccess`.
    - Cooldown Tracker recorded the catch, and Transfer on Catch transferred the
      Pokémon.
    - The Cacnea disappeared from the map (`build/tap-to-catch-after-tap-3.png`).
  - **Hold to open.** A 1.3 s press on a Fletchling opened its normal
    encounter (`build/tap-to-catch-hold.png`).
  - **Ball memory.** Picking a Great Ball there saved `ball=great`.
  - **Headshot only.** With Perfect Throw off, a tap on the Fletchling threw a
    Great Ball inside the ring with no curve. Result: `CatchSuccess`.
    Perfect Throw was then turned back on.
- **Session 4.**
  - `ball=great` was restored from saved settings.
  - **Stantler.** Pinap fed, then a Great Ball as an Excellent curveball.
    - The server's awards: activities `[1, 12, 13, 9, 32]` with XP
      `[100, 1000, 20, 50, 300]`. These include Excellent (12) and Curveball
      (13). The game showed +1,470 XP (`build/tap-to-catch-toast-1.png`).
    - The status action read `Last: Great Ball, Excellent curveball (caught)`.
  - Disabling logged no errors.
  - The runner acknowledged shutdown but did not exit, so it was terminated.
    The game kept running.

Session 3 also logged `unable to intercept function` for three hooks of other
modules: Auto Gym Battle, Gym Feeder, and the Pinap Master button. The error did
not recur in session 4 with the same hooks, so it looks intermittent and was
not investigated further.

Not established on a device:
- the out-of-stock fallback and the empty bag;
- flee, breakout and miss handling;
- the cooldown block;
- a tap after disabling;
- Tap to Catch's own toast (Transfer on Catch's toast was visible instead);
- prolonged use.

Tap to Catch is left disabled.

## Top toasts and Tap to Catch halo — October 14, 2026

Final APK `build/pgql-debug.apk`, SHA-256
`24b8d5aaf96d2b9f7050828cb4bf5b71d1db45c9350331c48e8dca8c7524214c`; its
`agent.js` has SHA-256 `aaebade1…0e372cef`. All thirty-six Node suites and the
Python check pass.

Setup. The controller session was stopped with the `STOP` intent after logcat
was saved to `build/toast-halo-pre-restart-logcat.log`. Each session then
force-stopped and relaunched the game and attached the bundle over the command
pipe (`build/tap-session.sh`). Probe modules appended to the bundle, kept outside
the repository, dumped metadata and showed test toasts. Logs are
`build/toast-halo-session*.log` and `build/toast-probe*.log`.

Toast metadata (0.433.0). `ToastParams` has `Single PivotY` (default 0.5),
`Nullable<Single> VerticalScreenPosition`, `Nullable<ToastZone> ZoneOverride`
and the fields the modules already set. `Screen.safeArea` reports the whole
render surface (771×1731), with no status-bar inset.

Toast results:

- `OneLine` follows both `PivotY` and `VerticalScreenPosition`. `TwoLine`, which
  Transfer on Catch and Raid Pack use, ignores `VerticalScreenPosition` and
  follows `PivotY`. PGQL therefore sets `PivotY`.
- `PivotY` 0.86, 0.90 and 0.93 all place the toast fully below the status bar
  (`build/probe-b*.png`). 0.90 is used.
- With the module code, Tap to Catch's own toast "Caught with your Poké Ball"
  showed at the top (`build/s7-seq3.png`). Transfer on Catch's toast arrives at
  the same moment and replaces it, so Transfer on Catch was disabled for that
  catch and turned back on afterwards.

Halo results:

- Each wild spawn's `normalRippleFx` is a `Ripple` GameObject. It holds one
  `ParticleSystem` (local space, loop, 5 s lifetime, a single particle) drawn
  with `Mobile/Particles/Alpha Blended`. That shader has no colour property.
- The first build only changed `startColor`. Its ring scaled up, but kept the
  old colour, because the live particle keeps its colour. Emitting a new
  particle gave a ring that started too small to see during a catch of about
  1 s.
- The final build clears the ripple and holds it with `Simulate(1.5, false, true)`.
  During a tap catch of a Stantler, a bright blue ring showed around it
  (`build/s7-seq1.png`, compared with `build/s7-map.png`). The catch succeeded,
  and no halo errors were logged.

Not established on a device: the restore after a breakout or miss, a disable
while a halo is up, and photobomb spawns. These are covered by tests only.

The game was left running with no runner attached. The last runner acknowledged
shutdown but did not exit, so it was terminated.
