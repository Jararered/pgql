# Upgrading to a new Pokémon GO build

Every game adapter is gated to one verified build, `PgqlGameVersion.supported`
in `agent/core/game-version.js`. A build that differs makes every game module
fail cleanly; nothing guesses. This runbook turns a game update into a short
review of what actually changed, then re-validation on the device.

## Tools

| Tool | What it does |
|---|---|
| Controller banner | The PGQL app shows a red notice when the installed game `versionName` differs from the version the bundled agent is verified for. |
| `scripts/archive-game.py` | Copies the installed game's APK splits to `build/game-apks/<version>/`. Never overwrites an archive. |
| Contract audit | Runs every adapter's `bind()` on the installed build, whatever its version, and reports which ones still bind, what they resolved and the declared members of every class they use. It installs no adapter hook and touches no scene object. The only hook is the shared frame scheduler's read-only `ExecuteTasks` observer, which is removed afterwards. |
| `scripts/contract-audit.py` | Attaches the installed runner, runs the audit, writes `build/contracts-<version>.json` and detaches. `--pgp` audits the `:pgp` process (GO Plus exports only). |
| **Check game compatibility** (controller) | The same audit from the app while a normal session is attached. The report is saved to `/sdcard/Android/data/dev.qol.framework/files/contracts-<version>.json` and summarised in the session log. |
| `scripts/contract-diff.py OLD NEW` | Diffs two audit reports: binding status per adapter, resolved members, and per-class field/method changes. A removed field plus an added field of the same type shows as a *probable rename*, which is how an obfuscated-name change looks. Exit 1 if NEW has a failing contract. |
| `scripts/native-diff.py OLD NEW` | Virtual GO Plus native contract. Takes `.so` files, APK splits or archive folders. It checks that every `libholoholo.so` export the agent binds (read from the agent sources) exists, then compares each function's disassembly after normalizing addresses, ADRP pages/`:lo12:` offsets and calls to unnamed local code. Exit 1 if an export is missing or a function that reads or writes the pinned struct offsets changed. PgpManager message builders and `~Module` are informational only. |

The audit is an action on the always-on `diagnostics` module:
`{"type":"command","action":"invoke","moduleId":"diagnostics","args":{"action":"contracts"}}`.
It has no menu entry and changes no saved setting. While it binds, the version
gate accepts the running build only for the synchronous duration of each
`bind()` call (`PgqlGameVersion.audit`). A module enabled at the same time
still sees the strict gate.

Not audited offline: Mass Gift and Tamagotchi resolve their services from the
live map scene, so they stay covered by live checks only.

## Keep a baseline

The committed baseline lives in `contracts/<version>.json`. After any adapter
change, refresh it on the verified build:

> **Not generated yet:** `contracts/0.433.0.json` has not been committed. It
> needs a live device session (commands below). Until it exists, step 4's diff
> has no baseline to compare against.

```sh
python3 scripts/build.py && adb install -r build/pgql-debug.apk
python3 scripts/contract-audit.py --out contracts/0.433.0.json
```

## When a new game build arrives

1. **Before updating**, run `python3 scripts/archive-game.py` so the current
   build is kept. Keep Play Store auto-update off for Pokémon GO on the test
   phone, so updates happen when you choose.
2. Update the game, then archive the new build too (`archive-game.py` again).
3. Native contract:
   `python3 scripts/native-diff.py build/game-apks/<old> build/game-apks/<new> --report build/go-plus-<new>-offsets.txt`.
   Any change in a pinned function means the struct offsets in `docs/GOPLUS.md`
   need re-deriving before the gate is bumped.
4. Managed contracts: start the game fresh and send it to the background (see
   AGENTS.md on attach crashes), then run
   `python3 scripts/contract-audit.py` and
   `python3 scripts/contract-diff.py contracts/<old>.json build/contracts-<new>.json`.
5. Fix the adapters the diff reports. Prefer binding obfuscated members by
   their unique declared type or signature (`PgqlBinding.create(...).fieldOfType` in
   `agent/core/metadata-binding.js`, or `typedField` in `game-encounters.js`) over literal
   obfuscated names. Re-run the audit until it reports every contract binding.
6. Bump `supported` in `agent/core/game-version.js`, rebuild, and run the
   per-module live checks, using the table format of the 0.433.0 upgrade in
   `docs/VALIDATION.md`. A binding contract is not proof of behavior.
7. Commit the new `contracts/<new>.json` baseline and record the session in
   `docs/VALIDATION.md`.
