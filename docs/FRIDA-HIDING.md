# Attach-time Frida names

PGQL applies the `names-v1` profile to the pinned official Frida core 17.23.3
Android arm64 devkit at build time. Main-game, dedicated GO Plus, and companion
attachments all launch the same runner and therefore use this profile.

`scripts/prepare-frida.py` checks the upstream static archive SHA-256
`7aa83d7fae13def91893e330aab142063c1f1d8dd0cf090bf5cfd80407d7ed90`, then
replaces complete NUL-delimited strings with equal-length PGQL names. It checks
each expected occurrence count. The build fails on different inputs; upgrades
require reviewing this contract. Only the build copy is modified, preserving
archive member lengths, ELF layout, relocations and exported symbol names.
The build manifest records both hashes and every replacement.

| Original | Replacement |
| --- | --- |
| `frida-agent-{64,32,arm64,arm,<arch>}.so` | `pgql-worker-{64,32,arm64,arm,<arch>}.so` |
| `libfrida-agent-raw.so` | `libpgql-worker-raw.so` |
| `frida-agent-container` | `pgql-worker-container` |
| `gum-js-loop` | `pgql-js-job` |
| `gmain` / `gdbus` | `pwork` / `pcomm` |
| `frida` (complete literal) | `pgqlx` |
| Java bridge generated DEX prefix `frida` | `pgql` |

`scripts/bundle-agent.py` also changes the pinned Java bridge's generated DEX
filename prefix in its existing build copy. This avoids `cache/frida*.dex`
mapping names when the settings UI creates Java proxies, without modifying npm
inputs or the Java bridge's runtime behavior.

The runner's `ready` event reports `frida_hiding:"names-v1"`; the controller logs
the profile. This identifies the linked build profile, not a runtime assertion
that every detection technique has been defeated.

## PokeMod reference check

Read-only inspection of the packaged 13.8.0 injector
(`analysis/extracted/assets/pokemod-injector`, SHA-256
`60da475360e685524a3a622ae47b3065242785eaa53896b20488f82a4da58ac3`)
found `floyd-agent-64.so` at file offset `0xd9fe4`, `floyd_agent_main` at
`0x1163d8`, `libfloyd-agent-raw.so` at `0x4c796f`, and `gznhm` at `0xe77b7`.
Bounded whole-file literal searches found no `frida-agent`, `frida_agent_main`,
`gum-js-loop`, or complete `gmain`/`gdbus` literals. This supports a renamed
Frida-family engine, as recorded in `analysis/native-inventory.md`.

Its `FloydThreadListCloaker`, `FloydFDListCloaker`, and `FloydThreadCountCloaker`
strings resemble upstream Frida resource cloaking classes. Their presence
alone does not establish extra custom hiding behavior. The library named
`libconceal.so` exports Facebook Conceal crypto JNI APIs; its name alone is
not evidence of Frida hiding. Static evidence does not establish which names
were visible during an actual PokeMod session or explain every modification
in its engine. PGQL implements its own bounded name profile, preserving the
upstream engine and entry point rather than importing recovered code.

## Limits and verification

This feature reduces name-based fingerprints. It does not remove Frida from
memory, conceal every export/protocol/SELinux identifier, or defeat direct
syscall and hook-integrity checks. Resident-agent detach still leaves an inactive
engine in the target until it exits. It does not establish the cause or resolution
of the intermittent Niantic plugin crash.

Local checks: `python3 -m unittest discover -s tests -p '*_test.py'` exercises
exact-string boundaries, equal-length layout, contract drift, unknown inputs,
in-place write refusal, and the real pinned archive when bootstrapped. Build
and device evidence belong in `build/`; device results are recorded separately
in `docs/VALIDATION.md`.
