# Pinap Master

Original implementation in `agent/core/berry-policy.js` (rules),
`agent/adapters/game-pinap-master.js` (game access) and
`agent/modules/pinap-master.js`. It reproduces the behaviour of Pokemod
13.8.0's Berry Master, recovered under `analysis/`; no recovered code is used.

Requirements: game 0.433.0, main game process. Default off.

## Behaviour

- **Automatic feeding.** In a wild encounter with no active berry, the chosen
  berry is fed as soon as the game allows one (`CanUseBerry`). It is fed again
  after a throw uses it up. Feeding goes through the game's own item bag
  (`IItemBag.UseItemForEncounter`), and the encounter is marked with that berry
  (`set_ActiveBerry`), so the game shows its usual berry badge next to the name.
- **Wild only.** Raid and Team GO Rocket encounters (`IsRaidOrIncidentEncounter`)
  are skipped, so premium-ball fights stay manual. Each skipped encounter is
  counted once in the status.
- **Stock and pacing.** Nothing is fed when the bag has none of that berry or a
  request is still waiting for an answer. Feeds are at least 2 s apart. An
  encounter that already has a berry, including one the server remembers from an
  earlier visit to the same spawn, is left alone.
- **Berry button.** While the module is on, the encounter's **Berries** list
  gets a berry button in the top-left corner, opposite the **ⓘ** button (which
  Transfer on Catch uses for its bypass). It shows the selected berry's icon,
  dimmed when the setting is off or when you have none of that berry. Tapping it
  opens the game's own dialog with Pinap, Razz, Nanab, Golden Razz, Silver Pinap,
  Off and Cancel. A choice is saved like any other setting and confirmed with a
  toast such as `Razz Berry selected`.
- **Settings.**
  - **Berry** (default `pinap`): `pinap`, `razz`, `nanab`, `golden-razz`,
    `silver-pinap` or `off`.
  - **Show Toast** (default on): the toast after a change from the button.

The status action reports the berry, how many were fed and how many of those the
server confirmed or refused, skipped raid/Rocket encounters, the last berry and
any unavailable part.

## Game contract (0.433.0)

| Purpose | Binding |
| --- | --- |
| Trigger | Listener on `EncounterInteractionState.get_ActiveBerry` (result 0) |
| Eligibility | `get_CanUseBerry`; the interaction state's only `LazyInject<IEncounterState>` and `IItemBag` fields, bound by type; `EncounterState.get_IsRaidOrIncidentEncounter` |
| Feeding | `IItemBag.GetItemCount(Item)`, `IItemBag.UseItemForEncounter(Item, IMapPokemon)` with `EncounterState.get_MapPokemon`, `set_ActiveBerry(Item)` |
| Confirmation | `Then`/`Error` on the returned promise; `UseItemEncounterOutProto.Status == Success` |
| Button | Listener on `ItemSelectionSliderGuiController.Initialize` (title key `encounter_item_berries`) and `HandleOpenComplete`; a clone of `infoButtonGameObject` mirrored to anchor (0, 1); icon from the selector's `ItemSelectionSliderEntryWidget.iconImage` for the selected berry |
| Picker | `IUserPromptsService.ShowModal` with `ModalButton(ModalEvent, text, null, null)` for OptionA–E, AltOption (Off) and Cancel |

The item numbers (701, 703, 705, 706, 708) are checked against the game's
`Holoholo.Rpc.Item` names at start. The game's `SelectBerry(Item)` only puts the
berry in hand and still needs a tap, so it is not used. All hooks are listeners,
so the module runs alongside the other encounter features.

## Failure behaviour

- Unsupported game version or changed core metadata: the module turns itself off
  and installs nothing.
- If the button, picker, toast or request confirmation cannot be bound, only that
  part is unavailable and the status says which. Without the picker, each tap on
  the button moves to the next berry (then Off).
- An unexpected error while feeding turns the module off.
- Disabling removes the button on the next game frame. If the game is paused, the
  button stays until the selector is rebuilt, but it ignores taps.

## Differences from Pokemod

- Raid and Rocket encounters are skipped. Pokemod feeds in every encounter.
- The choice is a module setting, not stored per account.
- The berry icon comes from the berry list itself, not from the gym screen.
- The server's answer is checked and counted; Pokemod ignores it.

## Validation

See the Pinap Master section of [VALIDATION.md](VALIDATION.md). A re-feed after
a breakout and the raid/Rocket skip have not been observed on a device yet.
