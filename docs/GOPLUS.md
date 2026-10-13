# Virtual GO Plus

PGQL **Virtual GO Plus** emulates a genuine Pokemon GO Plus accessory inside the
game, so the game pairs with a virtual device and acts on nearby content
instantly — no physical accessory, no Unity throw animation. Behavior is an
original re-implementation of the recovered `vpgp_agent.js` (Pokemod's GO Plus
bot), using the same libholoholo exports and struct layout but **no recovered
code**. It is a separate module (`virtual-go-plus`) from the encounter toggles.

## Recommended app flow

Open the game fully, then choose **Start GO Plus session** in PGQL. The
controller attaches only to `:pgp`, enables the module after the runner is ready,
and displays connection status, request counts and all three settings. These
settings persist in PGQL's `lab` preferences with `goplus.` keys. This mode does
not inject the Unity process or restore unrelated game modules. Normal **Attach**
still supports the companion/front arrangement below, but main-process native
attachment currently crashes on this phone; use the dedicated session.

Start the session before connecting the GO Plus icon in the game. For first
pairing, open game Settings → Connected Devices and Services → Accessory Devices,
select the virtual Pokémon GO Plus and complete the game's setup. Reconnection
parameters become available after that initial connection. A device that was
already connected before attachment must be disconnected/reconnected once.

## Module behavior

The module is default-off. Once enabled it presents three boolean settings, all
defaulting to **on**:

| Setting | Default | Effect |
|---|---|---|
| `auto-catch` | on | On `Module::ProcessPokemonNearby`, reads the encounter and calls native `Module::CatchPokemon` immediately (server-side catch without the encounter UI). |
| `auto-spin` | on | On `Module::ProcessPokestopNearby`, calls `Module::SearchPokestop` directly and flushes the sfida module state. |
| `auto-reconnect` | on | Completes native disconnect teardown, then restarts the captured accessory session on its main thread. Retries back off from 1 to 30 seconds until paired; switching off cancels retries. |

A **Feature status** action reports `phase` (`initializing`/`ready`/`failed`),
connection state, request counters, and the three toggles. Request counters
measure dispatched native requests; they do not claim server-confirmed catches
or item awards. The main-process status retains the companion snapshot across
log messages that have no status fields. Settings change live through the
injected menu; toggling a setting only changes that behavior, it never
re-installs or re-arms the other hooks.

### Process model

The game hosts its accessory (sfida) stack in a separate service process,
`com.nianticlabs.pokemongo:pgp`, not in the main Unity process. `libholoholo.so`
is loaded in both, so exports resolve in either, but the scan/pairing/catch
functions only ever run in `:pgp`. PGQL therefore runs this module in two
halves:

- **Main process (front)** — the module shown in the settings menu. It installs
  no hooks; its phase is `companion`.
- **`:pgp` process (companion)** — when the front is enabled, `SessionService`
  attaches a second runner to the `:pgp` pid with the same bundle prefixed by
  `globalThis.PgqlRole='pgp'` (`files/agent-pgp.js`). That agent skips the
  settings menu and installs the real adapter.

The controller mirrors the front's `enabled`/`disabled`/`config` events to the
companion, relays the companion's log lines back (shown under `companion` in
**Feature status**), and disables the front if the companion disables itself,
its runner exits, or `:pgp` is not running. Companion log lines are prefixed
`GO Plus:` in the session log. The companion uses `--resident-agent` detach
like the main session.

How the session works while enabled:

1. **Device advertisement** — when the game calls
   `AndroidBluetoothDriver::StartScanningWithFilter`, the adapter fabricates a
   `SfidaScanCallback` and a `ScanResult`/`ScanRecord`/`BluetoothDevice`
   advertising "Pokemon GO Plus" (MAC `98:B6:E9:11:E1:46`) over raw JNI and
   fires `onScanResult(1, result)`, so the game believes a real accessory is
   present. Fabricated objects are held as global refs and released on the next
   scan cycle or on disable.
2. **Instant pairing** — `Device::Connect` and `AndroidPeripheral::Connect` are
   replaced so connection completes immediately (device state → 8,
   `ConnectionComplete(success)`). `Device::ConnectionComplete` is invoked
   directly.
3. **Autocatch / autospin** — `ProcessPokemonNearby`/`ProcessPokestopNearby`
   are observed and answered with native catch/spin, then `Module::HandleUpdate`
   is forced (writing flags at module+268/+270) after 1500 ms so the sfida
   module processes the new state.
4. **Session feedback** — encounter IDs are reported to the native
   `PgpManagerAndroid` (`SendEncounterIdMessage`); on a capture response the
   accessory timestamp is refreshed (`SendUpdateTimestampMessage`) and the
   module state is flushed. XP-gained messaging is **not** sent: the recovered
   0.431.0 agent only ever wired the encounter-ID message, and without a
   verified XP source we do not fabricate XP values.
5. **Range** — the game keeps its normal accessory distance checks. The old
   integer-register distance override was removed; it did not establish the
   native return ABI and is unnecessary for virtual device discovery.

## Native contract (pinned to game 0.431.0)

The adapter is gated to GO **0.431.0** (installed package `versionName` via
the Java bridge, `agent/core/package-version.js`; the `:pgp` process has no
Unity/il2cpp) and fails cleanly on any other build — no anti-version bricking. All
symbols are resolved by mangled name from `libholoholo.so` at runtime; missing
exports disable the module. The struct field offsets below are
version-pinned to 0.431.0, match the recovered agent, and are documented here so
a game update can be reviewed against them before re-enabling.

Exports resolved (mangled, abbreviated):

- `_ZN3pgp5sfida6Module12CatchPokemonE…basic_string…El13EncounterType`
- `_ZN3pgp5sfida6Module14SearchPokestopERK19SfidaUpdateResponse`
- `_ZN3pgp5sfida6Module12HandleUpdateEv`
- `_ZN3pgp5sfida6Module20ProcessPokemonNearbyERK19SfidaUpdateResponse`
- `_ZN3pgp5sfida6Module21ProcessPokestopNearbyERK19SfidaUpdateResponse`
- `_ZN3pgp5sfida6Module22ProcessCaptureResponseERK20SfidaCaptureResponse`
- `_ZN3pgp7android22AndroidBluetoothDriver23StartScanningWithFilterE…`
- `_ZN3pgp7android17AndroidPeripheral7ConnectE…`
- `_ZN3pgp5sfida6Device7ConnectE…` / `…18ConnectionCompleteE…` /
  `…10DisconnectE…` / `…22FinishDeviceDisconnectE…`
- `_ZN3pgp7android17PgpManagerAndroid19SendXpGainedMessageEi` /
  `…26SendUpdateTimestampMessageEl` / `…22SendEncounterIdMessageEl`
- `_ZN3pgp7android3jni6GetEnvEPKc` (JNIEnv accessor)
- `_ZN3pgp5sfida6Module12StartSessionERK…basic_string…ESA_bSA_li`
- `_ZN3pgp5sfida6ModuleD2Ev` (module lifetime invalidation)

Struct layout used on 0.431.0:

| Object | Offset | Field |
|---|---|---|
| `SfidaUpdateResponse` | +16 | spawn point `std::string` data pointer (read, then `.sub(2)`) |
| `SfidaUpdateResponse` | +40 | encounter id (u64) |
| `SfidaUpdateResponse` | +48 | encounter type (u32) |
| `Module` | +16 | `PgpManagerAndroid*` |
| `Module` | +268 / +270 | forced `HandleUpdate` flags |
| `Device` | +528 | connection state (write 8 = connected) |
| `AndroidBluetoothDriver` | +176 | `SfidaBluetoothDriver` jobject |

Catch, spin and capture hooks retain arguments on Frida's per-invocation
object, so nested or concurrent callbacks do not overwrite another request.
Disconnect cancels pending state-update timers and a reentrancy guard prevents
recursive disconnect routing. The `Module::StartSession` const-reference overload
with a boolean connection flag supplies the parameters for future reconnects.
Three libc++ strings are copied into private Frida allocations (24-byte arm64
layout; long length +8 and payload pointer +16; short length in byte 0). Payloads
are bounded to 4096 bytes and never logged or persisted. A queued reconnect checks
its module generation and setting again on the accessory main thread. Pairing,
disable, disposal and `Module::~Module` cancel retries and invalidate saved handles.

The JNI helper uses `NewObjectA` / `Call*MethodA` with explicit `jvalue[]`
arguments and a local reference frame for each advertisement. Cleanup obtains
a fresh environment for its current native thread before deleting global refs.

The JNI helper (`agent/core/jni-helper.js`) reads the JNIEnv function table from
the fixed, published JNI/ART slot numbers — those are a public ABI, not game
offsets — and obtains its JNIEnv through libholoholo's own
`pgp::android::jni::GetEnv` export.

## Implementation

- `agent/core/jni-helper.js` — JNIEnv table wrapper (`PgqlJniHelper`), slot
  resolution, exception handling, global-ref lifecycle.
- `agent/core/device-simulator.js` — fake accessory advertisement
  (`PgqlDeviceSimulator`), scan record bytes, MAC, RSSI, timestamp; retains and
  releases fabricated global refs.
- `agent/core/pgp-manager.js` — `PgpManagerAndroid` bridge (`PgqlPgpManager`).
- `agent/adapters/game-go-plus.js` — native adapter (`PgqlGameGoPlus`): version
  gate, export resolution, all hooks/replacements, live `setAuto*` toggles,
  `status()`, full revert/release on dispose.
- `agent/core/go-plus-module.js` + `agent/modules/virtual-go-plus.js` — module
  registration, settings, deferred/async installation with generation scoping
  (mirrors the encounter modules), `onConfigChanged`.

No recovered Pokemod code is loaded into PGQL. See [THIRD_PARTY.md](../THIRD_PARTY.md).

## Validation boundaries

- Local Node suites (`tests/go-plus-adapter.test.cjs`,
  `tests/virtual-go-plus.test.cjs`) execute the real adapter and module sources
  against mocked Frida/JNI globals: hook installation, advertisement JNI call
  sequencing, pairing writes, catch/spin reads and native calls, capture flush,
  interleaved callback isolation, reconnect routing, per-setting toggles, JNI
  argument slots/reference cleanup, and full cleanup.
- These prove wiring and ABI math, **not** live injection. A device session on
  GO 0.431.0 is required to confirm the sfida module actually accepts the
  fabricated device, that `CatchPokemon`/`SearchPokestop` calls are accepted by
  the server, and that pairing state reads/writes are stable. Results are
  recorded in `VALIDATION.md`.
- October 13 device validation established virtual discovery, game-visible
  pairing, native automatic catch requests and journal-confirmed item awards
  from five automatic spins. Google Fit setup was completed by the user.
- The dedicated controller session was exercised against freshly restarted
  game PID 28385 and accessory PID 28846. A forced UI disconnect at 07:19:37.341
  was followed by an automatic native session restart at 07:19:38.392 and pairing
  at 07:19:38.848, with no reconnect tap. The controller showed Connected and
  live request counters. Both processes remained alive.
- Normal main-process attachment failed twice with native SIGSEGVs before the
  companion became active; the dedicated mode avoids that attachment. This
  remains a limitation of normal Attach, not evidence of its stability.
- Earlier reconnect validation found a native argument type mismatch; the flag
  is now passed as integer `uint8`, and the regression suite checks native
  integer argument types. The corrected clean-process reconnect succeeded.
- Saved settings: turning Auto reconnect off wrote the controller-private
  preference; after a graceful detach and a controller force-stop/relaunch
  (new controller PID 29984), a new dedicated session applied
  `auto-reconnect=false` to the accessory before enabling the module. The
  toggle was then restored to on.
- Both dedicated-session detaches (07:23:39 and 07:25) reported
  `shutdown_acknowledged:true`, `eternalized:true` and `crashed:false`; the
  runner exited and both game PIDs stayed alive. Accessory PID 28846 therefore
  holds two inactive resident scripts until the game exits.
- These are short sessions, not prolonged stability or one-hour timeout tests.
  See `VALIDATION.md` and the local `build/go-plus-*.log/jsonl/png` evidence.
- Known limits: version-locked to 0.431.0; struct offsets are documented but
  not independently re-derived; a mismatched build disables the module cleanly.
- Explicitly **not** included: the recovered agent's mock-location bypass
  (`isFromMockProvider` → false) and its anti-version "zero memcpy" brick. The
  former belongs to location spoofing, the latter conflicts with PGQL's clean
  version gating.
