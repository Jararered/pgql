# Virtual GO Plus

PGQL **Virtual GO Plus** emulates a genuine Pokemon GO Plus accessory inside the
game, so the game pairs with a virtual device and acts on nearby content
instantly — no physical accessory, no Unity throw animation. Behavior is an
original re-implementation of the recovered `vpgp_agent.js` (Pokemod's GO Plus
bot), using the same libholoholo exports and struct layout but **no recovered
code**. It is a separate module (`virtual-go-plus`) from the encounter toggles.

## Module behavior

The module is default-off. Once enabled it presents three boolean settings, all
defaulting to **on**:

| Setting | Default | Effect |
|---|---|---|
| `auto-catch` | on | On `Module::ProcessPokemonNearby`, reads the encounter and calls native `Module::CatchPokemon` immediately (server-side catch without the encounter UI). |
| `auto-spin` | on | On `Module::ProcessPokestopNearby`, calls `Module::SearchPokestop` directly and flushes the sfida module state. |
| `auto-reconnect` | on | Routes a finished device disconnect through `Device::Disconnect` so the next scan re-pairs the virtual device automatically. When off, the game's own disconnect path is used. |

A **Feature status** action reports `phase` (`initializing`/`ready`/`failed`),
connection state, and the three toggles. Settings change live through the
injected menu; toggling a setting only changes that behavior, it never
re-installs or re-arms the other hooks.

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
5. **Range** — `util::location::Location::DistanceTo` results ≤ 20 m are raised
   to 20.1 m so nearby objects stay within the GO Plus actionable band.

## Native contract (pinned to game 0.431.0)

The adapter is gated to GO **0.431.0** (`Il2Cpp.application.version`, lazy
loader) and fails cleanly on any other build — no anti-version bricking. All
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
- `_ZN4util8location8Location10DistanceToERS1_`

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

No recovered Pokemod code is loaded into PGQL. See `THIRD_PARTY.md`.

## Validation boundaries

- Local Node suites (`tests/go-plus-adapter.test.cjs`,
  `tests/virtual-go-plus.test.cjs`) execute the real adapter and module sources
  against mocked Frida/JNI globals: hook installation, advertisement JNI call
  sequencing, pairing writes, catch/spin reads and native calls, capture flush,
  distance floor, reconnect routing, per-setting toggles, and full cleanup.
- These prove wiring and ABI math, **not** live injection. A device session on
  GO 0.431.0 is required to confirm the sfida module actually accepts the
  fabricated device, that `CatchPokemon`/`SearchPokestop` calls are accepted by
  the server, and that pairing state reads/writes are stable. Results are
  recorded in `VALIDATION.md`.
- Known limits: version-locked to 0.431.0; struct offsets are documented but
  not independently re-derived; a mismatched build disables the module cleanly.
- Explicitly **not** included: the recovered agent's mock-location bypass
  (`isFromMockProvider` → false) and its anti-version "zero memcpy" brick. The
  former belongs to location spoofing, the latter conflicts with PGQL's clean
  version gating.
