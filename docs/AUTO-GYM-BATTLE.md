# Auto Gym Battle

Original implementation in `agent/core/gym-battle-policy.js` (battle rules),
`agent/adapters/game-gym-battle.js` (game access) and
`agent/modules/auto-gym-battle.js`. Pokemod 13.8.0 has no equivalent, so this is
an original design. Every binding below comes from live 0.433.0 metadata.

Requirements: game 0.433.0, main game process. Default off.

## Behaviour

Automation runs only in a battle against a gym held by **another team**. The
gym team (`GymRootController.get_GymTeam`) and the player team
(`IPlayerService.GetPlayerTeam`) are read when the battle starts. Friendly
gyms, neutral gyms, and battles where either team can't be read are left to
you and counted as skipped. Raids and Max Battles use a different battle
system and are never touched; see [RAID-PACK.md](RAID-PACK.md).

- **Auto-Attack** (default on). Uses the fast attack whenever no action is
  queued. With enough energy, it uses the charged move that is most effective
  against the current defender; between equally effective moves it uses the
  cheaper one.
- **Auto Dodging** (default on). When the defender starts a charged attack,
  the game's own timing service (`IBattleTimingService.TimeUntilAttackLands`)
  says when it lands. The module dodges once it is 0.5 s or less away. Each
  attack is dodged once, and fast attacks are not dodged.
- **Swap to Better Matchups** (default on). Every party member is scored
  against the current defender:
  - offence: 0.6 × the fast move's effectiveness + 0.4 × the best charged
    move's effectiveness;
  - defence: the mean effectiveness of the defender's moves against the
    member's types;
  - score = offence ÷ defence.

  The module swaps when a member with at least 25% health scores at least
  1.5× the active Pokémon (about one super-effective step). It swaps at most
  once per defender; a new defender, or a replacement after a faint, allows
  another swap. A refused swap (the game is still bringing a Pokémon in) is
  retried after 1 s.
- **Skip Next Defender Countdown** (default on). Between defenders the game
  shows a "Next up" screen whose Battle button counts down about 10 s. While
  the module is battling, it presses that button as soon as the screen has
  opened.
- **Manual taps.** Tapping a swap button pauses automation for 1.5 s so your
  own swap goes first.

All settings apply live. The status action reports battles, skipped battles by
reason, fast and charged attacks, dodges, swaps (with the last swap's
Pokédex numbers and score ratio), refused actions by kind, skipped countdowns,
manual taps and any unavailable part. The first refusal of each kind per
defender is logged with the Pokémon involved.

## Game contract (0.433.0)

Gym battles still use the legacy, client-driven battle system, not the VNext
battle director that raids use.

| Part | Binding |
| --- | --- |
| Battle bounds | `Gym.GymBattleState.EnterState` / `ExitState`. One state covers every defender of the gym |
| Services | `Gym.BattleState` fields `battleFrameObservableService`, `gymRootController`, `playerService`, `gameMasterData` |
| Frame | `BattleFrameObservableService` (implements `IBattleFrameObservableService`): `get_BattleActive`, and `get_Observed` inherited from `ObservableService<BattleFrame>` |
| Battle frame | `BattleFrame.LocalPlayer`, `EnemyPokemon`, `BattleStatus` (`Active` = 1) |
| Party | `BattleFrame.PlayerFrame.Pokemon` (`List<PokemonFrame>`), `ActivePokemonIndex`, `get_IsSwapping` |
| Pokémon | `PokemonFrame.get_Pokemon`, `get_Health`, `get_Energy`, `get_IsFainted`, `get_IsDodging`, `get_CurrentAction`, `QueuedActionActive` |
| Enemy action | `FrameAction.Type` (`Attack` 0, `SpecialAttack` 1, `SpecialAttack2` 2, `Dodge` 3), `StartTimeMs` |
| Dodge timing | `BattlePokemon.battleTimingService` → `BattleTimingService.TimeUntilAttackLands(FrameAction)` |
| Actions | `TryOrQueueAttack()`, `TryOrQueueSpecialAttack(Boolean move3)`, `TryDodge()`, `TrySwap(PokemonProto)` on the frame service |
| Moves and types | `PokemonProto.id_`, `pokemonId_`, `maxStamina_`, `move1_`/`move2_`/`move3_`; `IGameMasterData.Get_PokemonSettings(PokemonProto, true)` → `type1_`/`type2_`; `MaybeGetByKey<MoveSettingsProto>(Enum)` → `Type`, `EnergyDelta`; `Get_TypeEffectiveness(HoloPokemonType, HoloPokemonType, HoloPokemonType)` |
| Teams | `GymRootController.get_GymTeam` (`Niantic.Holoholo.Team`), `IPlayerService.GetPlayerTeam` |
| Manual taps | `Battle.SwapButton.Swap` |
| Next defender countdown | `Gym.Battle.GymBattleContinueGuiController.HandleOpenComplete` → `ContinueToNextBattle()` on the next frame |

Enum numbers (action types, battle status) are checked against the policy at
start.

## Failure behaviour

- Unsupported game version, or a required binding missing: the module turns
  itself off and installs nothing.
- `manual` and `countdown` bind on their own; if one is missing, the module
  works without it and names the part in the status.
- Five consecutive failed battle steps stop automation for that battle only.
  The next battle starts fresh.

## Validation

See the Auto Gym Battle section of [VALIDATION.md](VALIDATION.md). On a
device, three full battles against a rival (Instinct) gym were won with no
manual input. They used fast and charged attacks, made four different swaps
to better matchups, and the last battle skipped every "Next up" countdown.

Not yet seen on a device:
- A dodge. The defenders in these battles only used fast attacks, so no dodge
  was attempted, although the timing service gave correct countdowns.
- The manual-tap pause, and a friendly-gym skip.
- What each refused action was. Battles had 12 to 24 refusals, most likely
  swaps tried while the game was still bringing a Pokémon in; the per-kind
  counts and the refusal log were added afterwards and haven't been run in a
  battle yet.
