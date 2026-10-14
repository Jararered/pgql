# Gym Feeder

Original implementation in `agent/core/gym-feed-policy.js` (rules),
`agent/adapters/game-gym-feeder.js` (game access) and
`agent/modules/gym-feeder.js`. Pokemod 13.8.0 has no equivalent; nothing
under `analysis/` is used.

Requirements: game 0.433.0, main game process. Default off.

## Behaviour

- **When.** Opening a gym of your own team while in range starts a visit. Rival
  and neutral gyms, gyms out of range (for example opened from far away) and the
  Off setting feed nothing; each skip is counted in the status.
- **Who.** Every defender, whether the gym holds one Pokémon or six, including
  your own. Each defender gets a berry before any defender gets a second, lowest
  motivation first. Defenders that are already full are skipped.
- **How long.** Feeding continues until the game refuses each defender (full,
  fed too often, or no longer in the gym), the bag runs out, or the per-visit cap
  is reached. A gym-level refusal (wrong team, out of range, raid, gym busy or
  closed) ends the visit at once.
- **Pacing.** One request at a time, at least 1.5 s apart. If the server says
  "too fast", feeding waits 4 s and tries again, at most three times in a row.
- **One visit per gym entry.** A visit lasts from entering the gym to leaving it.
  Coming back from a defender's details page does not start another one. Leaving
  the gym stops feeding after the answer already on its way.
- **Feedback.** Each answer redraws the gym with the server's new motivation and
  CP, just like the game's own periodic gym update. A toast at the end of the
  visit says what was fed, for example
  `Gym Feeder: 6 berries to 6 Pokémon, +180 stardust`, or that the berry ran out.
- **Settings.**
  - **Berry** (default `razz`): `pinap`, `razz`, `nanab`, `golden-razz`,
    `silver-pinap` or `off`; the same names as Pinap Master.
  - **Berries per Visit** (default `20`): 1 to 100.
  - **Show Toast** (default on).

The status action reports the berry and cap, visits, berries fed with the
stardust, candy and XP they earned, refusals and skips by reason, how visits
ended, and any unavailable part.

## Game contract (0.433.0)

| Purpose | Binding |
| --- | --- |
| Visit start | Listener on `GymApproachGuiController.HandleOpenComplete` |
| Visit bounds | Listeners on `GymState.EnterState` / `ExitState` |
| Gym | The controller's only `IMapGymController` field → `get_MapGym`; `AbstractMapPlace.get_Id`, `get_FortData` (`PokemonFortProto.Team`), `get_IsPlayerInRange` |
| Player team | The controller's only `IPlayerService` field → `GetPlayerTeam()` |
| Defenders | The controller's only `GymState` field → `get_GymDefenders`; `GymDefenderProto.MotivatedPokemon` → `MotivationNow`, `Pokemon.get_Id()` |
| Feeding | `IItemBag` from the map scene container: `GetItemCount(Item)`, `UseItemOnGymDefender(Item, UInt64 pokemonId, String gymId)` |
| Answer | `Then`/`Error` on the returned promise; `GymFeedPokemonOutProto.Result` (names read from the enum), `StardustAwarded`, `XpAwarded`, `NumCandyAwarded`, `NumXlCandyAwarded`, `GymStatusAndDefenders` |
| Screen refresh (optional) | `GymState`'s only instance method taking `GymStatusAndDefendersProto` |
| Toast (optional) | `IToastService.OneLine` with `ToastService.ToastParams` |

`UseItemOnGymDefender` is the call the game's own feed dialog makes (seen with a
manual Razz feed). The berry item numbers are checked against
`Holoholo.Rpc.Item` at start, as in Pinap Master.

## Failure behaviour

- Unsupported game version or changed core metadata: the module turns itself off
  and installs nothing.
- If the screen refresh or the toast cannot be bound, or fails once, only that
  part stops and the status says so.
- A failed or unanswered request (20 s) ends that visit; the module stays on.
- An unexpected error while reading the gym turns the module off.

## Validation

See the Gym Feeder section of [VALIDATION.md](VALIDATION.md). Rival and
out-of-range skips, the per-defender refusals (`ErrorPokemonFull`,
`ErrorTooFrequent`), "too fast" back-off and the empty-bag path are covered by
tests but have not been seen on a device yet.
