# Instant Loading and Performance Mode

Original implementations in `agent/adapters/game-map-refresh.js`,
`agent/adapters/game-performance.js` and their modules in `agent/modules/`. Both
are gated to GO 0.431.0, check every managed name they use before changing
anything, and only use switches the game itself exposes. Because PGQL attaches
after the game has started, they change the **live** objects and restore them on
disable; restore runs on the next game frame.

## Instant Loading (`instant-loading`)

The game asks the server for map objects through one throttle
(`MapContentHandler.fetchThrottle`, a `SpaceTimeThrottle`): refresh when at least
*min* seconds have passed and the player moved the minimum distance, or when
*max* seconds have passed. On the test account the server configures 10 s /
30 s / 10 m. The module sets 3 s / 5 s / 10 m through the throttle's own setters
and mirrors the values into the live `MapSettingsProto`, never making a value
slower than the server's. If the game downloads settings again during the
session, the server's new values are remembered for restore and the short ones
re-applied.

It does **not** force requests, retry refused responses, or send any request the
game would not send itself. Pokemod's rate-limit reset through fabricated battle
challenges is deliberately not implemented. More frequent map requests are still
more than the stock client makes and are not risk-free for the account.

**Feature status** shows the game's values and the applied ones.

## Performance Mode (`performance-mode`)

Four independent sub-toggles; each saves what it changes and restores exactly
that when switched off or when the module is disabled:

| Setting | Default | What it does |
| --- | --- | --- |
| Hide weather effects | on | Sets `WeatherService.DisplayWeatherEffects` to false. |
| Hide clouds | on | Disables the sky dome's cloud renderers. |
| Lower render quality | on | Switches Unity to the lowest quality level and applies 70% resolution through the game's `IRenderQualityService`. The whole frame, including UI, is rendered softer. |
| Remove roads | off | Disables the road and road-outline renderers of every map tile, including tiles built later. |

Weather and clouds are re-asserted every 30 seconds in case the game turns them
back on. A reduction that cannot find its target (for example no sky dome) is
reported as unavailable in **Feature status** without blocking the others.

Not implemented: switching off event or seasonal map themes (no such theme was
active to verify against), sky effects other than clouds, and any frame-rate
cap. No frame-time or temperature measurements have been taken.
