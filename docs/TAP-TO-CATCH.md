# Tap to Catch

Original implementation in `agent/core/catch-policy.js` (rules),
`agent/adapters/game-tap-to-catch.js` (game access) and
`agent/modules/tap-to-catch.js`. It reproduces the behaviour of Pokemod
13.8.0's Tap to Catch, recovered under `analysis/`; no recovered code is used.

Requirements: game 0.433.0, main game process. Default off.

## Behaviour

- **Tap to catch.** Tapping a Pokémon on the map does not open the encounter.
  The module sends the game's own encounter request for that spawn, then calls
  `MapPokemon.TryCapture` with a throw it builds. A successful catch or a flee
  removes the Pokémon from the map. A breakout or a miss leaves it there to tap
  again. A second tap on a spawn whose catch is still running is ignored.
- **Ball.** It uses the last ordinary ball (Poké, Great or Ultra) you picked in a
  regular encounter. This includes the ball the game picks for you when the
  encounter opens. The choice is saved as the **Ball** setting. If you have none
  of that ball, it uses the cheapest ball you do have. Master Ball and premium
  balls are never used. With no balls, it shows a toast and sends nothing.
- **Berry.** When Pinap Master is on, its selected berry is fed first through the
  same `IItemBag.UseItemForEncounter` call. The throw waits for the answer. A
  failed berry request is logged, and the ball is thrown anyway.
- **Throw bonuses.** These mirror the throw modules:

  | Perfect Throw | Headshot | Throw |
  | --- | --- | --- |
  | on | either | Excellent (reticle 0.05), inside the ring, curveball, AR+ values 0.475/0/false |
  | off | on | inside the ring, largest reticle (no Nice/Great/Excellent), no curve |
  | off | off | outside the ring, no curve |

  A tapped throw never misses. Perfect Throw's own request hook also sets the
  spin modifier and AR+ values on the outgoing `CatchPokemonProto`.
- **Other modules.** The catch result is parsed by the game, so Transfer on
  Catch, Instant Catch and Cooldown Tracker see it as usual. When Cooldown
  Tracker is on with **Prevent Throws**, a tap during a cooldown is held back,
  with the tracker's toast.
- **Hold to open.** Press and hold a Pokémon for 0.8 s to open the normal
  encounter, for example to use a Master Ball. Unlike Pokemod, there is no pink
  tint while holding.
- **Settings.**
  - **Ball** (default `poke`): `poke`, `great` or `ultra`. It updates by itself
    from encounters.
  - **Hold to Open** (default on).
  - **Show Toast** (default on): the result of each catch.

The status action reports the ball, taps by outcome, berries fed, the last throw
and any unavailable part. Each result in the session log includes the server's
award list (`scores.activities` and `scores.xp`).

## Game contract (0.433.0)

| Purpose | Binding |
| --- | --- |
| Trigger | `MapExploreState.PokemonSelected(MapPokemon, Boolean)` is replaced. The original runs for a hold, on a failure and when the module is off. |
| Encounter | `MapPokemon.SendEncounterRequest()` → `IPromise<PokemonEncounterResponse>`; `get_EncounterId()` |
| Catch | `MapPokemon.TryCapture(PokeballThrow, ARPlusEncounterValuesProto)` → `IPromise<CatchPokemonOutProto>`. Throw fields: `BallType`, `ReticleSize`, `HitBullseye`, `Spinning`, `Missed`. AR+ proto fields: `Proximity`, `Awareness`, `PokemonFrightened`. |
| Result | `CatchPokemonOutProto.Status` constants by name (`CatchSuccess`, `CatchFlee`, `CatchEscape`, `CatchMissed`) |
| Bag | `IItemBag.GetItemCount`, `UseItemForEncounter`, resolved from the map scene container. Item numbers 1/2/3 are checked against `Holoholo.Rpc.Item` names. |
| Map removal | The explore state's only `MapContentHandler` field: `RegisterPokemonCaughtOrFled(UInt64)`, `MapPokemon.Destroy()` |
| Ball memory | Listener on `EncounterInteractionState.SelectPokeball(Item)` |
| Hold | Listeners on `TouchScript.Gestures.TapGesture.touchBegan`/`touchEnded`. The gesture's GameObject must carry a `MapPokemon`. The open goes through `IMapExploreState`. |
| Toast | `IToastService.OneLine` with `ToastParams`, as Pinap Master uses it |

Map spawns are subclasses of `MapPokemon`. Its methods are therefore resolved on
the tapped object's own class. Calling the base declaration directly raised an
access violation on the device.

## Failure behaviour

- Unsupported game version or changed core metadata: the module turns itself off
  and installs nothing.
- If hold-to-open, ball memory, map removal or toasts cannot be bound, only that
  part is unavailable, and the status says which. Without hold-to-open, turn the
  module off to open encounters.
- An error while handling a tap is logged, and the normal encounter opens
  instead. A request that gets no answer within 15 s is dropped, so the spawn
  can be tapped again.
- Disabling restores `PokemonSelected`. Answers that arrive later are ignored.

## Differences from Pokemod

- The ball is the last one you picked, not the ball with the best capture chance.
  You cannot choose a set of allowed balls.
- The throw follows Perfect Throw and Headshot. Pokemod always throws an
  Excellent curveball with a random AR+ proximity.
- Pokemod skips non-shiny Pokémon when Block Non-Shiny is on. PGQL has no such
  module yet.
- No hold tint, haptics, candy or stardust reward bubbles, and no Tap to Spin.

## Validation

See the Tap to Catch section of [VALIDATION.md](VALIDATION.md). The
out-of-stock fallback, flee/breakout/miss handling and the cooldown block are
covered by tests only.
