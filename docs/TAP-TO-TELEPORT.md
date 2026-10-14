# Tap to Teleport

Original implementation in `agent/adapters/game-tap-to-teleport.js` (game
access), `agent/adapters/mock-location.js` (mock flag), `agent/modules/tap-to-teleport.js`
and `teleport()` in `SessionService`. It reproduces the behaviour of Pokemod
13.8.0's Tap to Teleport, recovered under `analysis/`; no recovered code is used.

Requirements: game 0.433.0, root, and [GPS Joystick](https://gpsjoystick.theappninjas.com/)
(`com.theappninjas.fakegpsjoystick`, validated with 5.3.3) set as the mock
location app. **Start GPS Joystick's spoofing before using the module** (see
"Cold start" below).

## Behaviour

- **Double tap the map.** Two ground taps less than 500 ms apart move you to the
  second tap's spot. A single tap does nothing extra, and the game still gets
  every tap. A third quick tap starts a new double tap instead of jumping again.
- **Teleport via Nearby Menu** (default on). These all jump to their place and
  close the Nearby menu:
  - tapping a Pokémon that sits at a stop;
  - tapping a raid, showcase or Power Spot;
  - **See in Map** on a stamp, which also steps back out of the stamp pages.
  
  Pokémon in the grass have no place, so they still track as usual. With the
  setting off, every icon behaves as in the game.
- **Hide Mock Location** (default on). Native code sees
  `Location.isFromMockProvider()` and `isMock()` as false.
- **Alerts.** Tapping any module alert with coordinates (for example from Shiny
  Scanner) teleports there. Its **Open map** action still offers map apps.
- **Status.** The status action shows the teleport count, the last target and
  any optional part that could not be bound.

## How it works

1. **Tap.** `GroundTapHandler.OnTap(object sender, EventArgs e)` is observed
   with a listener. The tap point is the `TapGesture.startPosition`. The handler's
   own `IMapController.GetGroundLocation(Vector2, out LatLng)` turns it into a
   location, so the game does the camera math. Pokemod used
   `IWorldMapRenderer.GetGroundLocation`, which has the same contract.
2. **Nearby and stamp clicks.** These handlers are replaced; any other click falls
   through to the original:
   - `NearbyPokemonIcon.IconClicked` and `NearbyContestIcon.IconClicked`:
     `get_FortId` → `IMapEntityService.GetMapPoi(id).get_Location()`.
   - `NearbyRaidIconWidget.IconClicked`: the fort proto's `Latitude`/`Longitude`.
   - `NearbyStationIconWidget.IconClickedAction`: `get_Station().get_Location()`.
   - `StampCollectionPoiDetailGuiController.OnClickSeeInMap`: its one `LatLng` field.
   
   Interface methods are called through the object's own implementation. The
   Nearby and stamp parts are optional: if one cannot be bound, the map tap still
   works.
3. **Agent → controller.** `ctx.teleport(lat, lng)` validates the coordinates
   (finite, in range, not 0,0), allows at most one jump per 250 ms, and sends a
   `teleport` event.
4. **Controller → GPS Joystick.** `SessionService` sends GPS Joystick's public
   intent: action `theappninjas.gpsjoystick.TELEPORT` with **float** extras
   `lat` and `lng` (about 1 m precision, as in Pokemod). The steps are:
   1. Resolve the service with `queryIntentServices`; the manifest declares a
      `<queries>` intent for this.
   2. `startService` it explicitly from the foreground session service.
   3. If Android refuses (GPS Joystick not running), run
      `su -c am start-foreground-service -a … --ef lat … --ef lng …`.
   4. After that fallback, repeat the jump once 2 s later.
5. **Mock bypass.** The JavaVM comes from `libart.so` `JNI_GetCreatedJavaVMs`.
   Method IDs for the two `Location` checks are looked up once. Then
   `CallBooleanMethod`, `CallBooleanMethodV` and `CallBooleanMethodA` (JNIEnv
   slots 37–39) return 0 for those IDs. Only the published JNI ABI is used, so
   this part has no game-version gate. Turning the setting or the module off
   detaches the hooks.

## Cold start

If GPS Joystick is not spoofing yet, the root fallback starts it. On this start,
GPS Joystick:
- begins at **its own last saved location** (this can be far away);
- ignores the requested target;
- brings its main screen, with an ad, to the front.

PGQL's repeat jump moves you to the target about 2 s later, but you must return
to the game yourself. Once GPS Joystick is running, every jump goes straight to
its service, silently.

## Limits

- Teleporting is instant; there is no walk mode, and teleports themselves never
  check cooldowns or distance. Large jumps can trigger the game's travel limits;
  enable [Cooldown Tracker](COOLDOWN-TRACKER.md) to hold back throws until the
  cooldown has passed.
- Only native (JNI) mock checks are hidden. Java code calling `isMock()` directly
  is not covered.
- The double-tap window is fixed at 500 ms. Pokemod's single-tap option is not
  offered.
