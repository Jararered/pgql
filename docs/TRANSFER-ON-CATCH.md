# Transfer on Catch

Original implementation in `agent/core/transfer-policy.js` (rules),
`agent/adapters/game-transfer-on-catch.js` (game access) and
`agent/modules/transfer-on-catch.js`. It reproduces the behaviour of Pokemod
13.8.0's feature of the same name as read from `analysis/`; no recovered code is
used. The adapter is gated to GO 0.431.0, checks every managed name and signature
it uses before installing a hook, and has no offsets. The module is default-off
and runs in the main game process only.

**Transfers are permanent.** A released Pokémon cannot be recovered. Read the
keep rules below before turning the module on.

## What it does

1. **Trigger.** A caught Pokémon is noticed in two places:
   - a parsed `CatchPokemonOutProto` with a non-zero `CapturedPokemonId` (catches
     you make yourself);
   - a handled accessory entry in the game's action log
     (`PgpActivityMonitor`, entry flagged `Sfida`, `CatchPokemon.PokemonId`), for
     GO Plus catches the main process learns about.
   The same id is never acted on twice.
2. **Wait.** It asks the game's `IPokemonBag.GetPokemon(id)` once per frame, for
   at most 600 frames, until the new Pokémon is in the bag. If it never arrives
   nothing is transferred.
3. **Decide.** The rules below run on the Pokémon's own data.
4. **Transfer.** Unless a rule keeps it, `IPokemonBag.ReleasePokemon(pokemon)` is
   called once. There is no retry. The game's answer is only used for reporting.

It does not end the encounter or touch the catch screens; with Instant Catch on,
both work on the same catch result.

## Keep rules

Checked in this order; the first match keeps the Pokémon.

Your preferences (toast `[Meets Preference, Not Transferred]`):

- IVs meet **Min. IV**.
- Size is XXS or XXL and the matching **Keep** switch is on.
- Species is on the **Ignore List**.

Built-in protections (toast `[Not Transferred]`):

- 100% or 0% IV.
- Shadow Pokémon (caught from Team GO Rocket), unless **Transfer Shadow** is on.
- Shiny, unless **Transfer Shiny** is on. Shiny shadows are always kept.
- A location background, unless **Transfer Background** is on.
- Caught with a Premier, Beast, Wild Premier or Master Ball (shadows excepted).
- Legendary, mythical or ultra beast.
- Marked non-transferable by the game, or its settings cannot be read.
- Any origin other than a wild or Team GO Rocket catch: raid, research, egg,
  GO Battle League, photobomb, incense, lure, station, Max Battle and others.
  This follows Pokemod, which lists incense and lure origins as kept.
- Transfer was disabled for this encounter (below).

Anything else is transferred (toast `[Transferred]`).

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Show Toast | on | Green game toast per catch: `Successful Capture!`, the result, and XL Candy earned if any. |
| Min. IV | `100` | Text. A percentage `0`–`100`, or `Attack/Defense/HP` minimums such as `15/14/13`. Pokémon at or above it are kept. `0` (or `0/0/0`) turns the rule off; empty means 100. |
| Keep XXS / Keep XXL | off | Protect that size. Together they are Pokemod's `XXL+XXS` choice. |
| Transfer Shiny | off | When on, shiny Pokémon are transferred. |
| Transfer Background | off | When on, Pokémon with a location background are transferred. |
| Transfer Shadow | off | When on, shadow Pokémon are transferred. |
| Ignore List | `132,201,352,570,999` | Text. Pokédex numbers never transferred (Ditto, Unown, Kecleon, Zorua, Gimmighoul by default). |

Settings are read when each decision is made, so changes apply to the next catch.
**Feature status** shows counts, the last decision and any unavailable part.

## Disabling it for one encounter

While the module is on, the **ⓘ** button on the encounter's Poké Ball or berry
selector no longer opens the item info panel. Tapping it closes the selector,
shows `Transfer On Catch was disabled for this encounter.` and keeps the next
Pokémon you catch. It cannot be undone within the encounter, and it is cleared
when the encounter ends. Other item selectors keep their info button. Accessory
catches are not affected.

## Text settings

This module introduced the runtime's `text` setting type (`agent/runtime.js`):
a string with a required `maxLength` and an optional `validate(value)` that
throws on bad input. `Qol.setConfig` rejects anything else, so an invalid value
is never stored. On the settings page a text setting is a button captioned
`Label: value`; tapping it opens a small Android input dialog over the game.

## Differences from Pokemod

- No PvP rank rule: it depends on PVP Metrics, which is not implemented.
- The ignore list is typed as Pokédex numbers; there is no species picker.
- The XL Candy line reads `+N XL Candy`, and there is no "maybe shiny Ditto"
  line.
- Pokemod ignores the answer to the release request. Here a refused or failed
  request is logged and counted as "not confirmed" in the status; the toast still
  says `[Transferred]` as soon as the request is made, as Pokemod's does.
- The bypass is remembered as "the next catch of this encounter" rather than by
  encounter id.

## Failure behaviour

- Unsupported game version or changed metadata: the module turns itself off and
  installs nothing.
- If the toast service, the accessory handler or the item selector cannot be
  bound, only that part is unavailable; status says which.
- An unexpected error while handling a catch stops all further transfers until
  the module is re-enabled.

## Validation boundary

See the Transfer on Catch section of [VALIDATION.md](VALIDATION.md) for what was
exercised on the device and what was not.
