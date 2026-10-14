# Raid Pack

Original implementation in `agent/core/raid-battle-policy.js` (battle rules),
`agent/adapters/game-raid-pack.js` (game access) and
`agent/modules/raid-pack.js`. The feature set follows Pokemod 13.8.0's Raid
Pack. Its recovered agent (`analysis/agents-readable/main_agent.js`, class
`RaidPack`) was read only as a description of behaviour. No code was copied,
and every binding below was re-derived from live 0.433.0 metadata.

Requirements: game 0.433.0, main game process. Default off.

## Behaviour

- **Auto-Attack** (default on). In a raid, the module reads the game's own
  battle state every frame (about 20 Hz). It submits one attack per turn and
  waits for that move's duration before the next. It fires the charged move
  with the best type effectiveness against the boss when there is energy for it
  (form and mega aware, through the game's own Pokémon settings), and the fast
  move otherwise. A refused attack is retried on the next turn.
- **Disable Auto-Attack in Max Battles** (default off). With this on, Max Battle
  bosses (a boss whose display has a Max mode) are left to you.
- **Auto Dodging** (default on). When the boss starts a charged attack, its
  damage window (`MoveSettingsProto.DamageWindowStartMs/EndMs`, counted from
  the attack's turn) becomes a range of turns. The module dodges right once
  inside that range, ahead of any attack. Each boss attack is dodged once. Max
  Battles are never dodged.
- **Manual taps.** Tapping swap, a battle item or a trainer ability pauses the
  automation for 1.5 s, so the game's own action goes first.
- **Skip Raid Transitions** (default on). The raid intro is reported as already
  seen. The gym approach camera runs in 0.05 s (this applies to every gym
  approach). The raid boss intro zoom and hold, the shrink sequence, and the
  raid exit and victory fades are shortened. A raid victory skips the result
  screen and its leaderboard and goes straight to the catch. Every shortened
  timing is restored on the game thread when the module is turned off.
- **Skip Max Battle Result** (default on). A Max Battle victory goes straight to
  the catch.
- **Boss Movesets** (default on). Tapping a hatched raid or a Power Spot with a
  Max Battle shows a toast with the boss name (with the form for Genesect,
  Rockruff, Toxtricity, Sinistea and Polteageist) and its fast / charged moves.
  Eggs show nothing. The separate `boss-movesets` slot (notifications before
  the egg hatches) stays planned.

All settings apply live. The status action reports battles, fast and charged
attacks, dodges, refused actions, manual taps, each kind of skip, the last
moveset and any unavailable part.

## Differences from the reference

- Pokemod hooks `BattleDirector.NewTurn` and `ProcessBattleUpdate`. On 0.433.0
  both are obfuscated, among several methods with the same signatures, so
  neither is bound. The battle loop polls the public
  `BattleDirector.get_CurrentState()` instead and reads the boss's turn actions.
- Pokemod replays manual swap, item and ability taps through its own event,
  reading private fields of the buttons. On 0.433.0 the swap target is one of
  two unnamed `UInt64` fields. The module therefore pauses instead and lets the
  game submit the tap itself.
- Pokemod's leaderboard-card toast is not reproduced.

## Game contract (0.433.0)

| Part | Binding |
| --- | --- |
| Raid intro | `GymRootController.get_PlayerHasSeenRaidIntroSequence` return value set to true |
| Approach camera | `ApproachCameraController.AnimateToTarget(Pose, Single, AnimationDefinition)`: the definition (x2; the 28-byte `Pose` goes by reference in x1 and the FOV in s0, checked against its class) gets `duration` 0.05 |
| Raid fades | `Raid.RaidState.EnterState` → `exitTimerWidgetFadeDuration`, `exitScreenFadeDuration`, `victoryTransitionTime`, `victoryIntroDelay` = 0.1 |
| Boss intro | `VNext.RaidBattleAnimationSequencer.PlayStartSequence` → `bossIntroZoomSpeed`/`shrinkSequenceSpeed` 1000, `bossRoarZoomDelay`/`bossFaceHoldTime` 0 |
| Raid result | `Raid.RaidResolveUIController.Initialize(IRaidResolveInformation)`: on `BattleStatus.Victory` (2), `RaidResolveInformation.set_Status(0)`, then `CloseLeaderboard()` and `Close()` |
| Max Battle result | `Bread.BreadBattleResolveGuiController.Initialize(IBreadBattleResolveInformation)`: on `VNext.BattleStatus.Victory`, `set_Status(0)` then `Close()` |
| Battle bounds | `VNext.RaidBattleVNextState.EnterState(IStateApi, RaidBattleLaunchData)` / `ExitState`; the state's only `IBattleDirector` field |
| Battle state | `BattleDirector.get_CurrentState`, `get_InputBlocked`; `BattleState.get_CurrentTurnSyncInfo` (`Turn`, `MsPerTurn`, `get_TurnIsAtLeastBattleStart`), `get_LocalActor`, `ActiveOpponents`; `BattleActorState.get_ActorId`, `get_ActivePokemonState`; `BattlePokemonState.CurrentEnergy`, `get_IsFainted`, `get_Pokemon`, `QueuedActions`; `BattleCharacterState.CurrentAction` |
| Moves | `BattlePokemonProto.Moves` (`MapField<Int32, MoveData>`, key = `MoveType`): `Move`, `Type`, `DurationTurns`, `EnergyDelta` |
| Boss attacks | `BattleTurnAction.Type` (Attack 4), `AttackVariety` (Charge 2 / Charge2 3), `AttackMove`, `Turn`, `Serial` |
| Effectiveness | `IGameMasterData` from the map scene container: `Get_PokemonSettingsWithOverrides(BattlePokemonProto)`, `Get_TypeEffectiveness(HoloPokemonType, IPokemonSettings)` |
| Damage window | `IGameMasterData.MaybeGetByKey<MoveSettingsProto>(Enum)` (generic, inflated at runtime) → `DamageWindowStartMs`, `DamageWindowEndMs` |
| Actions | `BattleDirector.TrySubmitPlayerAction(BattleEventProto, false)`: `Type` Attack (4) with `set_Attack` (`AttackType`, `Move`, `Type`, `TargetId` for charged), or Dodge (5) with `set_Dodge` (`Direction` Right 2). The answer `BattleDirectorPlayerActionStatus` counts `ACCEPTED` (1) and `BUFFERED_BY_INPUT_BLOCK` (6) as accepted |
| Manual taps | Listeners on `SwapButtonVNext.Swap`, `BattleAbilityButtonVNext.AbilityButtonClick`, `BattleItemButtonVNext.TryUseRaidItem` |
| Gym moveset | `MapGym.OnTap` → `AbstractMapPlace.get_FortData().RaidInfo.RaidPokemon` (`pokemonId_`, `move1_`, `move2_`, `pokemonDisplay_.Form`) |
| Power Spot moveset | `MapStation.OnTap` → `get_StationProto().BattleDetails.BattlePokemon` |
| Names | `II18n.PokemonName`, `PokemonMoveName`; `PokemonFormExt.FormName(Form, II18n)` |
| Toast | `IToastService.TwoLine` with `ToastService.ToastParams` |

Enum values (`MoveType`, `EventType`, `Dodge.Direction`, the action status)
are read from metadata at start and checked against the policy's numbers.
Nested types are resolved through their declaring type.

## Failure behaviour

- Unsupported game version, or no part bound: the module turns itself off and
  installs nothing.
- Each part (`skips`, `approach`, `results`, `maxResults`, `battle`, `dodge`,
  `manual`, `movesets`, `stations`, `toast`, `names`) binds on its own. A part
  that fails to bind, or later throws, is left out and named in the status. The
  rest keeps working.
- Five consecutive failed battle steps stop automation for that battle only.
  The next battle starts fresh.

## Validation

See the Raid Pack section of [VALIDATION.md](VALIDATION.md). On a device, every
part binds and the approach camera skip and timing restore were seen. Raid
battles (attack, dodge, manual pause, result skip), Max Battles, the raid
intro, the moveset toast on a hatched raid or Power Spot, and prolonged use
have not been seen on a device yet.
