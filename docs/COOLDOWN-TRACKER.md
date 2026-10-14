# Cooldown Tracker

Original implementation in `agent/core/cooldown-policy.js` (rules),
`agent/adapters/game-cooldown.js` (game access) and
`agent/modules/cooldown-tracker.js`. It reproduces the behaviour of Pokemod
13.8.0's Cooldown Tracker, recovered under `analysis/`; no recovered code is used.

Requirements: game 0.433.0, main game process. Rocket Teleport and Teleport to
Origin go through `ctx.teleport`, so they need GPS Joystick as described in
[TAP-TO-TELEPORT.md](TAP-TO-TELEPORT.md).

## Behaviour

- **What starts a cooldown.** The tracker records the player's location and the
  time whenever one of these responses arrives:

  | Type | Recorded when | Not recorded when |
  | --- | --- | --- |
  | Catch Attempt | A catch result arrives | The catch failed with no capture scores (already on a cooldown), or the encounter is exempt |
  | Pokéstop | A spin result arrives, titled with the stop's name | Success with no XP (already on a cooldown), or Out of Range |
  | Gym Healing | A gym feed result arrives | The feed was remote |
  | Gym Battle | A gym battle starts or attacks | — |
  | Gym Allocation | A Pokémon is deployed to a gym | — |
  | Go Plus | The game handles a GO Plus action log entry | — |
  | Manual | You press **Manual Save** | — |

  A new record pushes the old one into a history of four.
- **Exempt encounters.** Quest, daily, Pokéstop-spawn, photobomb, Power Spot and
  route encounters neither record nor block, from approach to exit.
- **Prevent Throws** (default on). Each Poké Ball drag is ended while a cooldown
  is running. A game toast shows `Cooldown: 3m 26s` and `(Distance: 5km)`, at
  most once every 2 s. Spins, gyms and teleports are recorded, never blocked.
- **Rocket Teleport** (default on). For a Shadow (Team GO Rocket) encounter
  with at least 10 s of cooldown left, you jump to the cooldown origin. You come
  back after a catch result that ends the encounter (caught, fled or error) or
  when you leave the encounter.
- **Poké Ball indicator.** While a cooldown is running, the main-menu Poké Ball
  turns orange (`1, 0.3, 0`). Its original colour and alpha come back when the
  cooldown ends or the module stops.
- **"Cooldown is over".** If an encounter starts with at least 30 s left, the
  game's own modal ("Cooldown is over" / "Maybe") pops up 0.5 s after the
  cooldown ends. A catch result, leaving the encounter or a new approach cancels
  it.
- **Buttons on the settings card:**
  - **Show Cooldown**: the time left, plus the current and four previous records.
    Each record reads as `<type> <name> — <elapsed> ago · <distance> · lat,lon`.
  - **Manual Save**: makes your current position the cooldown origin.
  - **Teleport to Origin**: jumps to the current record.
- **Persistence.** The current record and history are saved in the game's
  SharedPreferences file `pgql_cooldown`, key `history`, 250 ms after each
  change. They are loaded on start.

## Cooldown curve

The input is the distance in metres (haversine, R = 6 371 km) from the origin to
your current location. The output is the cooldown in seconds:

| Distance | Seconds |
| --- | --- |
| < 50 m | 0 |
| < 30 km | `ceil(d / asinh(20d) / 2) + 1` |
| < 300 km | `ceil(5 · sqrt(16000 + d)) + 5` |
| < 1 350 km | `min(7200, ceil(d / 500 + sqrt(16d)) + 15)` |
| beyond | 7200 |

Sample values:

| Distance | Cooldown |
| --- | --- |
| 1 km | 49 s |
| 5 km | 3 m 26 s |
| 10 km | 6 m 29 s |
| 100 km | 28 m 28 s |
| 1 000 km | 1 h 40 m |
| about 1 307 km and beyond | 2 h |

The time left is `record time + cooldown − now`, and is never negative.

## How it works

Everything below is version-gated to 0.433.0 and checked up front. Required
parts fail the module; optional parts are listed in Show Cooldown when missing.

1. **Location** (required). `Niantic.Platform.Ditto.Device.DeviceManager` has
   exactly one compiler-generated nested closure method whose name contains
   `NotifyLocationUpdate`. On leave, the tracker reads
   `location.data.LatitudeDeg/LongitudeDeg` (doubles) from the closure.
2. **Catch** (required). The `ParseContext` parser of
   `Holoholo.Rpc.CatchPokemonOutProto` is observed with a listener, never
   replaced, because Instant Catch and Transfer on Catch use it too. The tracker
   reads `Status` and `Scores`.
3. **Encounter** (required). `EncounterState.ApproachComplete` reads
   `get_MapPokemon()` and compares its class name with the exempt list and
   `IncidentMapPokemon`. `EncounterState.ExitState` ends the exemption.
4. **Throw guard** (required). On enter of `Niantic.Holoholo.Encounter.Pokeball.Drag`,
   the tracker calls the ball's `EndDrag()`.
5. **Spins** (optional): the `FortSearchOutProto` parser (`Result`, `XpAwarded`).
   The name comes from `PokestopSpinnerInteractionGuiController.Initialize`
   (`titleText.get_text()`).
6. **Gyms** (optional): the parsers of `GymFeedPokemonOutProto`,
   `GymStartSessionOutProto`, `GymBattleAttackOutProto` and `GymDeployOutProto`.
   The remote flag is the single `System.Boolean` argument of
   `MapExploreState.GymSelected`. The name comes from
   `GymApproachGuiController.Init` (`gymNameText`).
7. **GO Plus** (optional): the `PgpActivityMonitor` handler that takes one
   `ActionLogEntry` and returns `Boolean` (obfuscated name); a handled entry records.
   Pokemod's `HandleNewActivities` does not exist in 0.431.0.
8. **Toast** (optional): `IToastService.OneLine` with `ToastParams`.
9. **Indicator** (optional): `MainMenuGuiController.fullPokeballCanvasGroup` on
   scene instances. The tracker sets the `Image` colour and the `CanvasGroup`
   alpha on the game thread.
10. **Modal** (optional): `IUserPromptsService.ShowModal` with
    `ModalButton.OkButton`.

The response codes are protocol enum values:
- catch: `1` success, `0`/`3` error/flee;
- spin: `1` success, `2` out of range.

## Limits

- **One store per device, not per account.** Pokemod keyed the record by
  account and kept history in memory only.
- **No separate cooldown menu.** Pokemod's history menu is replaced by the
  **Show Cooldown** text. Its tap-a-record teleport is reduced to **Teleport to
  Origin** for the current record.
- **The origin is your location when the response is parsed**, not the
  Pokémon's or stop's location, as in Pokemod. Actions taken before the first
  location update after attach are not recorded.
- **Rocket Teleport waits for a final catch result.** Pokemod returned after
  any catch result, including an escape. Its threshold is 10 s, as its tip says;
  its code compared against 10 ms.
- **The module is default-off**, like every PGQL module; Pokemod enabled it by
  default.
- **Metadata verified on the device** (read-only probe, `build/cooldown-discovery-probe.jsonl`);
  the module itself has not yet run in a live session.
