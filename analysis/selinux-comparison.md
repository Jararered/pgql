# Pokemod versus QoL Lab: SELinux preparation

This comparison answers the user's question about why the new runner needs SELinux preparation. After reviewing the difference, the user explicitly authorized **Enable setup and test**. QoL Lab then called the upstream policy helper, and its diagnostics module ran successfully in Pokémon GO. Enforcement was checked afterwards and remained `Enforcing`. Session detachment does not reverse the resulting policy changes.

## Observed Pokemod behavior

The copied preferences explicitly set `SELINUX_PERMISSIVE=false`. Only this non-secret setting was inspected. This does not mean the native injector avoids policy modifications.

In the copied arm64 injector (SHA-256 `726eb015167e4408ef4dc2ac95c0986a3ae7f19ce5d384929e88505c07f65d1e`):

- Main startup at `0x43b9ac` calls `0x440960` at `0x43ba04`, before processing ordinary options.
- `0x440960` calls initialization at `0x2c4e770`, then tail-branches to `0x2c4ef88` at `0x440974`.
- The routine `0x2c4ef88..0x2c4f464` references `floyd_file`, `floyd_memfd` and the diagnostics `Unable to load SELinux policy from the kernel` and `Unable to save SELinux policy to the kernel`.
- Injector label helpers return `u:object_r:floyd_memfd:s0` and `u:object_r:floyd_file:s0`.

This is strong static evidence of automatic Frida-family policy initialization under renamed Floyd labels. It is distinct from setting the entire system's enforcement mode to permissive. Static analysis identifies the startup path, not whether a particular phone run successfully loaded the resulting policy.

Supporting local evidence: `native/copied-main.asm`, `native/copied-selinux-xrefs.json`, and `native/copied_selinux_xrefs.py`. These are ordinary disassembly/parsing evidence, not REA retained observations. Addresses are image-relative ELF VAs.

## Observed QoL Lab blocker

Root access and native helper execution worked on the connected Pixel 9a (arm64, Android 17, game version 0.431.0). Initial attachment to a cached frozen process timed out; foreground launch corrected that part of the flow. The later attach failed with `Agent connection closed unexpectedly`, including when targeting QoL Lab itself.

Android's audit log then recorded a denial of `read write` on `/memfd:frida-agent-64.so (deleted)` from `untrusted_app_34` to a `tmpfs` file, with `permissive=0`. This provides concrete evidence for a missing SELinux allowance rather than establishing a game-specific rejection.

The initial QoL Lab runner initialized core and attached directly but did **not** call `frida_selinux_patch_policy()`. Its optional `--prepare-selinux` argument now calls that exported upstream API before attachment. The app's checkbox defaults to unchecked.

## Scope of upstream setup

The [pinned upstream implementation](https://github.com/frida/frida-core/blob/17.23.3/lib/selinux/patch.c) creates `frida_file` and `frida_memfd` types, loads/writes the live SELinux policy, and adds instrumentation memory/file/communication permissions across domains. It is system-wide, rather than restricted to this one package. In its policy-load fallback it can briefly change enforcement and make the shell domain permissive. Therefore calling it does not promise an unchanged policy or enforcement behavior.

The runtime changes normally last until reboot; detaching does not roll them back. A pre-change policy snapshot has been saved locally at `framework/build/device-policy.before.bin` (SHA-256 `a8297ac06ea312ce6843abf26abe4a9c265804e5b490fb6ecd60f1211d2fd2f8`). A snapshot is evidence/backup, not a tested restoration method; reboot is preferable to blindly loading an old policy over later root-tool changes.

No Pokemod binary or label substitutions are used by QoL Lab. The separate names explain why an original Floyd policy setup would not necessarily authorize a stock Frida memfd.
