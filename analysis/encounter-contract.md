# Encounter module contracts from the recovered agent

Evidence is the already-recovered `analysis/agents-readable/main_agent.js`, formatted from the supplied Pokemod agent. These are static observations; this investigation did not operate the phone, resolve live metadata, or observe catches. Original agent supports only GO 0.431.0 (90457–90462). Managed parameter counts/types and aliases must be validated against the installed game before hooks are installed.

## Instant Catch

Implementation `dC` / `InstantCatch`, lines 73470–73612.

1. Attach `Niantic.Holoholo.Encounter.EncounterInteractionState.IntroCompleted` on entry. Capture the receiver as interaction state and unwrap its `encounterState` field with the LazyInject helper (73483–73490).
2. Attach `CatchPokemonOutProto.IMergeFrom` on leave, passing the parsed result receiver into the handler (73492–73500). This is a protobuf deserialize hook, not a request to catch anything.
3. Status enum numbers are `ERROR=0`, `SUCCESS=1`, `ESCAPE=2`, `FLEE=3`, `MISSED=4` (58721). On success schedule `encounterState.EncounterStateComplete(0)` for the next Unity frame (73560–73563, 73605–73610). Original also closes on flee, but the user's requested successful-catch behavior only needs status 1.
4. Original additionally accelerates escape/missed recovery: `PokemonBrokeOut()`, encounter Pokemon `BreakoutFromPokeball()`, `set_Invulnerable(false)`, ball `SetActive(true)`, character `PlayAnimation(1,0.5,-1)`, resets ActiveBerry on interaction state and nameplate and resets capture probability from encounter response (73501–73531). This ancillary behavior is unnecessary for success-only PGQL Instant Catch.

Original falls back to DI resolution of `IEncounterInteractionState` if its cached state is absent; that fallback alone does not populate cached `encounterState` (73534–73542). Capturing both on intro, and optionally resolving/unwrap together on enable while already in encounter, avoids this gap. Its original TapOnMap pending capture guard and TransferOnCatch interactions are Pokemod-specific and need not enter PGQL.

`ue.LazyInject` is not magic: if object class name starts `LazyInject<` or `LazyInject\``, return `_value` if populated, otherwise call `get_Value()`; otherwise return the input directly (63898–63915).

Original next-frame scheduler wraps a managed `System.Action` and calls Zeppelin `SchedulerExt.RunNextFrame(Scheduler,action)` (67219–67230). PGQL's existing Unity main-thread queue can provide equivalent scheduling. Avoid executing exit in the middle of parsing, correlate with active encounter, deduplicate repeated parsing, pin retained managed state, and invalidate pending exit on disable/new encounter.

## Perfect Throw

Implementation `IC` / `PerfectedThrow`, lines 76839–76946. The requested separate PGQL Headshot toggle should not inherit the original's nested enable/disable coupling.

| Managed hook | Original effect | Lines |
|---|---|---|
| `Niantic.Holoholo.Encounter.EncounterPokemon.SetCanPerformActions` | Replace first managed argument with `false` on entry | 76870–76876 |
| same class `get_Invulnerable` | Replace getter, return false | 76878–76881 |
| `Niantic.Holoholo.Encounter.Reticle.get_NormalizedSize` | Replace float getter, return random value in `[0,0.13)` | 76883–76904 |
| same class `ScreenPositionOverBullseye` | Replace bool return, always true | 76906–76910 |
| `Niantic.Holoholo.Encounter.Pokeball.Initialize` | Call original with every argument, then install missed-ball delegates | 76911–76924 |
| `CatchPokemonProto.CalculateSize` | Before serialization sizing, set curve and AR+ values | 76926–76938 |

The miss delegate is a managed **`System.Action`**, assigned to both `HitGround` and `HitKillZone`. It captures that Pokeball and the unwrapped `encounterState`. If encounter state exists, increments `<RaidBallCount>k__BackingField` **only if current value is truthy/nonzero**, then calls ball `SetActive(true)` (76915–76923). Original suppresses previous delegates rather than invoking them. Preserve original delegates and restore on disable, keep every replacement pinned while installed, and avoid retaining destroyed balls indefinitely. A single miss can potentially trigger multiple callbacks; behavior/deduplication needs runtime testing. No server inventory refund is established by this code.

Bounded full-file search found no other HitGround/HitKillZone reference and no named ground/kill-zone handlers. Replacing a specific miss dispatch method instead could avoid persisted delegate mutations, but the recovered source does not establish that method's identity or signature. Do not infer that suppressing OnCollisionEnter covers kill-zone behavior; Headshot only uses that method to alter the collision target. The source does establish that the miss callbacks take zero managed arguments because their delegate class is System.Action (the unused JavaScript callback parameter does not establish a managed argument).

Serialization mutation creates `ARPlusEncounterValuesProto`, sets `Proximity=random*[0.05)+0.45`, `Awareness=0`, `PokemonFrightened=false`; sets CatchPokemonProto `SpinModifier=1` and `ArPlusValues` to that object (76929–76936). The fields alter outbound catch claims; this static code does not establish awarded XP. `CalculateSize` may run repeatedly; an implementation should avoid repeated managed allocations/mutation churn when values are already set. Changing a float return requires ABI-aware replacement, not integer-only retval.replace assumptions.

Original optional `amateurThrow` mode randomizes quality and is not part of the requested feature. Original first action suppression only affects calls occurring after enable; it does not immediately stop an already-running animation. Disabling hooks alone does not necessarily restore object fields last set to false, so track desired action state or restore on the game thread when relevant.

## Headshot

Implementation `TC` / `Headshot`, 76776–76837. Hooks are on `Niantic.Holoholo.Encounter.Pokeball`.

* `Launch` on entry: `pokemon.set_Invulnerable(false)`; if `<BallType>k__BackingField != 4`, run `effects.CreateVfx(6)`, read this ball's `get_Transform()` and `reticle.get_Transform()`, then move the ball to `Vector3.Lerp(ball.position,reticle.position,0.9)` (76795–76808). Item value 4 is `MASTER_BALL` (58487). This is a position shift toward the target, not evidence of universally centered physics.
* `OnCollisionEnter` on entry: first managed argument is a Unity Collision object. Get this ball's `pokemon.get_GameObject()`, call `GetComponentInChildren(typeof(UnityEngine.Collider))`, get `Collider.GetEntityId()`, create a new `UnityEngine.ContactPair`, set its `m_OtherColliderID` to that collider ID, then assign Collision `m_Pair` to the struct (76812–76828). Validate actual ID/struct types and value-type assignment via bridge metadata; older Unity `GetInstanceID` assumptions are not justified here.
* Original optional ULTRAKILL/random 5% plays `pokemon.character.PlayAnimation(4,0.5,-1)`; decorative and not needed for requested PGQL behavior (76829–76830).

Hook removal affects future throws/collisions, not the position or collision data already mutated. Headshot should have its own lifecycle and should not implicitly toggle Perfect Throw.

## Relevant 0.431.0 aliases

Source global map at 90259–90455 is obfuscated identifier to readable identifier, **not scoped by owner**. Resolve on the concrete class and validate field type; two `encounterState` aliases belong to different owners.

| Raw | Readable |
|---|---|
| `drde` | `encounterState` |
| `dqjd` | `encounterState` |
| `drea` | `reticle` |
| `dreb` | `pokemon` |
| `eaky` | `_value` |
| `eakx` | `promise` |
| `dria` | `namePlate` |
| `drib` | `encounterPokemon` |
| `btyu` | `Initialize` |
| `btyl` | `Initialize_b_0` |
| `efk` | `Initialize_c` |

Several unrelated raw names map to `IMergeFrom`: sdm, khk, qxx, nay, kpk, oxs, kgp, hwy, lnu, qdb, qlq, mrx, kpz, kqf, mmz, mnf, naa, kgy, miv, isr, ngg, mqb (90405 onward). Do not choose by order. Prefer exact method or explicit interface signature on `CatchPokemonOutProto`, matching parameter metadata for the protobuf reader. No aliases for Launch, SetCanPerformActions, ScreenPositionOverBullseye, or CalculateSize appear in the map; these call sites use readable names.

## Cleanup and remaining gaps

Original base module disable detaches tracked listeners and reverts tracked native replacements before calling `onDisable` (70061–70083). Perfect Throw's only explicit `onDisable` is disabling its child Headshot (76942–76944). Thus original does **not** show restoration of saved HitGround/HitKillZone delegates, already-mutated fields, or cached InstantCatch receivers; PGQL should improve these boundaries.

All three contracts are statically answered. Exact current metadata signatures, owner-specific aliases, value-type ABI, managed object lifetime, active-encounter transition correctness, missed-ball inventory behavior, awarded throw/XP results and runtime stability remain unobserved by this investigation. No copied agent code or proprietary auth/network service is required to implement original modules against these contracts.
