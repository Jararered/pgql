# Shiny Scanner

Original implementation in `agent/core/scanner-policy.js` (rules and scan
cache), `agent/adapters/game-shiny-scanner.js` (game access) and
`agent/modules/shiny-scanner.js`. It reproduces the behaviour of Pokemod 13.8.0's
feature of the same name as read from `analysis/`. No recovered code is used. The
adapter is gated to GO 0.431.0 and checks every managed name, signature and field
type before installing a hook. It has no offsets. The module is off by default and
runs in the main game process only.

**Every scan is a real encounter request.** The scanner calls the game's own
`SendEncounterRequest()` for each nearby spawn, so the game server sees one
encounter request per scanned Pokémon, the same request a tap on the map sends.

## What it does

1. **Notice.** A listener on each spawn kind's `Initialize` queues the new map
   Pokémon:

   | Kind | Class | Result field type |
   | --- | --- | --- |
   | wild | `WildMapPokemon` (both `Initialize` overloads) | `EncounterOutProto` → `Pokemon` (`WildPokemonProto`) → `Pokemon` |
   | lure | `TroyDiskMapPlacePokemon` (via `MapPlacePokemon.Initialize`) | `DiskEncounterOutProto` → `Pokemon` |
   | incense | `IncenseMapPokemon` | `IncenseEncounterOutProto` → `Pokemon` |
   | route | `RouteMapPokemon` | `AttractedPokemonEncounterOutProto` → `Pokemon` |
   | photobomb | `PhotobombingMapPokemon` | `EncounterPhotobombOutProto` → `Pokemon` |
   | station | `StationMapPokemon` | `EncounterPokestopEncounterOutProto` → `Pokemon` |

   The field that holds the result has an obfuscated name, so it is bound by its
   proto type. That type is unique on each class. Only the wild kind is
   required; a kind that fails its contract is reported and skipped.
2. **Filter.** One job at a time, on the Unity frame:
   - Map objects that were destroyed (`<Destroyed>k__BackingField`) are released.
   - Spawns farther than 100 m (`IPlayerProximityService.DistanceM`) are skipped.
   - For 20 s after a 100% IV result, spawns within 100 m of it are skipped.
   - Scans pause while `IPokemonBag.Count` ≥ `IPlayerService.MaxPokemon`
     (checked at most every 5 s).

   Skipped spawns stay retained in a set of at most 128 and are retried every
   10 s, so a spawn first seen too far away is scanned once you walk up to it.
3. **Request.** `MapPokemon.SendEncounterRequest()` returns a
   `Promise<PokemonEncounterResponse>`. The response itself carries no Pokémon;
   once it arrives, the result proto is read from the field above. A request
   with no answer within 15 s clears the queue, so scanning never blocks. The
   queue holds at most 64 spawns.
4. **Classify.** The proto becomes a plain snapshot. That covers IVs, CP
   multiplier, shiny, background card, size, weight, weather boost, strong flag
   and `PokemonProto.GetClass`. For Magikarp it also takes Pokédex weight and
   weight deviation from `GetPokemonSettings`. `PgqlScannerPolicy.classify` picks
   **one** alert, the most notable first:

   | Alert | Setting | Example text |
   | --- | --- | --- |
   | Shiny 100% | always | A shundo 💯 ✨Pikachu✨ is nearby! |
   | Shiny 0% | always | A shiny 0% ✨Pikachu✨ is nearby! |
   | Shiny | Notify Shinies (on) | A shiny ✨Pikachu✨ with background is nearby! |
   | 0% IV | Notify Zero IVs (off) | A 0% Pidgey is nearby! |
   | Hidden Ditto | Notify Ditto (off) | Wild Spearow is a hidden Ditto! |
   | Legendary / mythical | Notify Legendaries/Mythicals (on) | Legendary Articuno is nearby! |
   | Tiny Rattata (≤ 2.41625 kg) / big Magikarp (≥ 2.5 σ) | Tiny Rattata / Big Magikarp (on) | A tiny Rattata is nearby! |
   | IV ≥ Minimum IV | Minimum IV (100; 0 = off) | 93% Dratini is nearby! |
   | Background card | Notify Background Card (on) | A Pikachu with background is nearby! |
   | XXL / XXS | Notify XXL/XXS (off) | XXL Wailmer is nearby! |

   Hidden Ditto: one of Ditto's current disguise species whose stats cannot
   occur for it. That means above level 30 without weather boost (unless
   strong), or, when boosted, any IV below 4 or a CP multiplier below level 6.
   Names come from the game's `II18n.PokemonName`. If that is unavailable the
   alert shows `#<dex number>`.
5. **Alert.** Each encounter alerts once per account:
   - **Show Toast**: a game toast, gold for shiny, 100% and legendary alerts,
     green for the rest.
   - **Android Notification**: the module calls `ctx.notify`. The controller
     posts it on the high-importance **Module alerts** channel with the
     coordinates as subtext. Tapping it teleports there with GPS Joystick (see
     [TAP-TO-TELEPORT.md](TAP-TO-TELEPORT.md)); its **Open map** action opens a
     `geo:` chooser for any installed map app.
6. **Redraw.** Every scanned spawn's ripple (`normalRippleFx`/`rippleFx`, where
   the kind has one) is tinted: red for 100% IV, gold for shiny, green for
   scanned. With **Update Map Models** on:
   - Shinies are reloaded as shiny with sparkles.
   - Hidden Dittos are reloaded as Ditto.
   - XXS/XXL (0.6×/1.5×) and Gimmighoul (5.5×) are scaled.

   The reload uses `HoloCharacter.LoadPokemon` with `LOAD_ALWAYS`/`M` on a
   **clone** of the display proto, so the game's own data is unchanged. A model
   that is still loading is redrawn on `PokemonInstantiated`. A spawn seen again
   (a new map object for a cached encounter) is redrawn from the cache without a
   new request.

The cache keeps results for 30 minutes (lure spawns 5) and clears when the player
id changes. Disabling releases every retained object; the listeners are removed
by the module cleanup.

## Optional parts

Each of these is bound separately; if one fails its contract it is listed in
the status report and the rest keeps working: lure, incense, route, photobomb
and station spawns, toasts, model updates, ripple tint and Pokémon names.

## Not reproduced

- The original created missing wild map Pokémon itself inside
  `MapEntityService.UpdateWildPokemon` and replaced `WildMapPokemon.Initialize`
  so a spawn could not be initialised twice. PGQL only observes `Initialize`.
- The original set `Shiny` on the game's own display proto. PGQL uses a clone.
- The original sent alerts to its companion app with a teleport action. PGQL
  posts an Android notification from its controller; tapping it teleports with
  GPS Joystick, like the original.
- Localised alert text: alerts are English; only Pokémon names come from the game.

## Validation limits

See `docs/VALIDATION.md`. Shiny, Ditto, XXS/XXL, legendary and badge alerts, the
redraw of a real shiny, and non-wild spawn kinds have not been seen on a live
result.
