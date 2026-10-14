# Feature framework

All 32 requested features have stable IDs in `agent/core/feature-catalog.js`.
`Qol.describe()` exposes their category, required adapter domains, implementation
availability, settings, actions and enable state. `modules/zz-feature-catalog.js`
reserves missing features after real modules are registered. Planned features
cannot be enabled through either the command protocol or either UI. Adding a
real module with the same ID replaces that slot at the next build.

**Availability describes code, not device validation.** Existing modules retain
their prior behavior and validation limits. Tamagotchi is experimental and its
feeding, play and souvenir bindings target 0.431.0; automatic snapshots and
battles remain unsupported. The rest of the newly reserved slots are
planned. Requirements are architecture metadata, not an automatic dependency
resolver; existing adapters have not been migrated to the new factory registry.

## Shared layers

- `runtime.js`: lifecycle, cleanup, boolean and validated text configuration, persistence through the
  settings menu, actions and availability enforcement. Existing IDs and protocol
  commands remain compatible.
- `core/feature-catalog.js`: complete feature inventory and adapter boundaries.
- `core/game-adapters.js`: factories keyed by capability and exact game version;
  duplicate registration and unsupported versions fail. Factories take the
  owning module context and register all cleanup there. Registration happens at
  bundle load, not after modules have started.
- `core/automation.js`: asynchronous resource leases and bounded waits. Timeout
  releases the caller but retains the lease until the underlying request settles.
  Cancellation prevents dispatch but cannot undo an already submitted request.
  This is available to new automation modules; existing queues remain intact.
- `core/buddy-care.js`: first consumer of these new interfaces. Game-independent
  eligibility, sequencing, receipt journal, cancellation and uncertain outcomes.
- `adapters/game-buddy.js`: boundary between the care engine and an exact-version
  buddy implementation. The 0.431.0 profile is in `game-buddy-profile.js`;
  `core/buddy-policy.js` derives eligibility from server progress.

Future adapters should return plain snapshots and confirmed results, own their
thread scheduling, validate method signatures, and recheck identity/configuration
at dispatch. Shared inventory operations must use a common resource lease when
Magic Bag, gifting, berries and incubators are integrated. Account switches must
invalidate all account-scoped snapshots and outstanding work. Hook-based modules
must coordinate ownership of methods shared with existing encounter adapters.
Do not treat catalog `requires` as proof that these integrations already exist.

## Implementation map

“Existing” means a module was already present; it does not claim every requested
subfeature is implemented. Detailed boundaries are in ENCOUNTERS.md, MASS-GIFT.md
and GOPLUS.md. This table preserves the requested scope for subsequent work.

| Feature ID | Requested behavior / next adapter work | State |
| --- | --- | --- |
| `shiny-scanner` | Encounter-request scan of nearby wild, lure, incense, route, photobomb and station spawns; toast and Android alerts with coordinates, shiny/Ditto/size redraw and ripple tint; see [SHINY-SCANNER.md](SHINY-SCANNER.md); tapping an alert teleports there with GPS Joystick | Implemented (0.431.0) |
| `virtual-go-plus` | Device emulation, auto-catch, auto-spin, reconnect in the accessory process | Existing |
| `quest-tweaks` | Auto-claim, hidden reward presentation, individual queued encounters | Planned |
| `magic-bag` | Per-item target quantities, protected stock, excess deletion | Planned |
| `tamagotchi` | Feeding, souvenirs, play, snapshots and eligible buddy battles | Feed/play/souvenir bound; camera/battle pending |
| `cooldown-tracker` | Last cooldown action (catch, spin, gym, GO Plus, manual) with four previous records, throw guard with toast, main-menu Poké Ball tint, "Cooldown is over" modal and Rocket Teleport to the origin for Shadows; see [COOLDOWN-TRACKER.md](COOLDOWN-TRACKER.md) | Implemented (0.431.0) |
| `raid-pack` | Raid attack/dodge scheduling and animation handling | Planned |
| `tap-to-teleport` | Double tap the map, a Nearby icon or a stamp's See in Map to move there through GPS Joystick, with an optional mock-location bypass; see [TAP-TO-TELEPORT.md](TAP-TO-TELEPORT.md) | Implemented (0.431.0) |
| `instant-loading` | Shortens the game's own map refresh throttle; see [PERFORMANCE.md](PERFORMANCE.md) | Implemented (0.431.0) |
| `transfer-on-catch` | Post-catch transfer with keep rules, toast and per-encounter bypass, including main-process accessory catches; see [TRANSFER-ON-CATCH.md](TRANSFER-ON-CATCH.md). PvP rank rule pending `pvp-metrics` | Implemented (0.431.0) |
| `mass-gift` | Batch send/open, friends, exact friendship, postcards and animations | Existing batch send/open; remaining scope pending |
| `eggspresso` | Infinite-incubator selection, incubation and hatch flow | Planned |
| `pinap-master` | Encounter berry selection, inventory check and acknowledged feeding | Planned |
| `performance-mode` | Four reversible visual reductions; see [PERFORMANCE.md](PERFORMANCE.md) | Implemented (0.431.0) |
| `headshot` | Encounter throw targeting | Existing |
| `pvp-metrics` | Versioned stat/ranking data, encounter and details presentation | Planned |
| `incognito-mode` | Display-name substitution without changing account identity | Planned |
| `account-manager` | Secure account storage/switching and session teardown | Planned |
| `perfect-throw` | Throw quality, movement suppression, missed-ball handling and AR+ behavior | Existing; see encounter limits |
| `instant-catch` | Exit after a confirmed successful catch | Existing |
| `inventory-tweaks` | Transfer/evolve/purify batches, healing, buddy map visibility | Planned |
| `swift-gift` | Single-gift actions and bag-full behavior, sharing the gifting backend | Planned |
| `speed-mode` | Dialog/animation handling, quantity shortcuts, Kecleon and Zygarde cells | Planned |
| `block-non-shiny-encounters` | Authoritative shiny check before encounter dismissal | Planned |
| `instant-spin` | Tap-triggered PokéStop spin and result handling | Planned |
| `boss-movesets` | Available raid metadata and early notifications; timing requires verification | Planned |
| `encounter-iv-names` | Encounter name formatting from authoritative IVs | Planned |
| `show-encounter-iv` | Encounter IV toast | Planned |
| `inventory-ivs` | Shows Attack/Defense/HP IVs in place of names in the inventory grid (`agent/adapters/game-inventory-ivs.js`) | Implemented (0.431.0) |
| `skip-encounter-intro` | Zeroes the encounter camera intro; see [ENCOUNTERS.md](ENCOUNTERS.md) | Implemented (0.431.0) |
| `mock-locations-patch` | Version-specific location handling and joystick integration | Planned |
| `spawn-booster` | Map query radius/loading; server-visible limits require verification | Planned |

New configuration types (quantities, item maps, coordinates, thresholds) need
schema validation, persistence and UI controls together. The settings API has
two types: `boolean`, and `text` (a bounded string with a module-supplied
validator, added for Transfer on Catch's minimum IV and ignore list). Give every
text setting a `validate` that rejects anything the module cannot use; do not
encode quantities as switches or silently accept arbitrary values through
`config`.

## Adding the next implementation

1. Select the catalog ID and document exact supported behavior and game version.
2. Add a small original adapter in `agent/adapters/`, with verified metadata and
   explicit outcomes. Keep offsets and managed objects out of core logic.
3. Add pure orchestration in `agent/core/`, then a module with that catalog ID.
   Keep experimental availability until its integration is validated.
4. Exercise real sources with VM mocks, particularly cancellation, stale
   snapshots, account changes, conflicting actions and timeouts.
5. Build and verify the APK; document device observations separately. No-op
   adapters must never report a game action as successful.
