# Copied arm64 injector and agent decoding

Static-only examination of the user's copied app files. No injector, APK, game process, JavaScript agent or backend was executed/accessed. Shell `objdump` and Python parsed the file; `node --check` parsed JavaScript syntax without running it. Findings are local evidence rather than retained REA IDs.

## Identity and comparison

- `com.pokemod.app.public/files/injector/pokemod-injector-arm64`: 50,116,728 bytes; SHA-256 `726eb015167e4408ef4dc2ac95c0986a3ae7f19ce5d384929e88505c07f65d1e`. ELF64 little-endian AArch64 ET_DYN, entry VA `0x43b000`, interpreter `/system/bin/linker64`, 26 section headers. `.text` VA `0x43b000`, file offset `0x43a000`, size `0x2b1cfc0`; `.rodata` maps file offset equal to VA, `0x99190` through `0x31a790`.
- Copied generic `pokemod-injector`: 33,219,024 bytes; SHA-256 `60da475360e685524a3a622ae47b3065242785eaa53896b20488f82a4da58ac3`, exactly matching the packaged APK injector examined previously. The separate arm64 file supplies the successful decoding path here.
- Native mode global VA `0x2fc7dac` (file `0x2fc4dac`) is initialized to 2. Unencrypted-mode flag VA `0x2fce148` is in BSS (zero initial state). These are static initial values; actual phone launch arguments were not observed.

## Confirmed decoding result

The small native front-end implements Base64 followed by RC4. The RC4 identification is supported by a 256-entry initialization, standard key scheduling swaps, and standard PRGA byte XOR in `0x43b858..0x43b9ac`. The loader invokes it at `0x43eee4`, using binary-contained key derivation helpers, after Base64 decoding at `0x43ee5c`.

The offline reconstruction using mode 2 and the default unencrypted flag successfully yields coherent UTF-8 JavaScript for both supplied agents. Both pass `node --check`. This strong corroboration verifies the reconstructed decoding for these exact files, without proving agent runtime behavior. The injector and original agent files remain unchanged.

| Output | Bytes | SHA-256 |
|---|---:|---|
| `analysis/agents-decoded/main_agent.js` | 2,285,749 | `9a20b21248e731f157a65d31a77ae26227efd88735a2119d625b94f61b7a5552` |
| `analysis/agents-decoded/vpgp_agent.js` | 29,842 | `288002113b26b8ef563b943329ce14b635eef3a239a7f04c44cf4ff3000f0749` |

`analysis/agents-decoded/manifest.json` binds source carrier, decoded Base64 payload and output hashes. `analysis/native/decode_copied_agents.py` reproduces the operation from constants read at recorded offsets in a SHA-256-bound injector, without displaying key material. It is deliberately specific to the exact supplied binary and its mode 2.

## Function and call anchors for decompilation

| VA / range | Observed role / evidence |
|---|---|
| `0x43b9ac..0x43bfc4` | CLI front-end; version diagnostic reference at `0x43ba64` |
| `0x43df78..0x43e17c` | Script path/source property declarations |
| `0x43e9ac..0x43f424` | Script loader coroutine, file read, mode branch, decode, UTF-8 conversion and script creation path; labeled by native assertion string `floyd_inject_script_runner_load_co` |
| `0x43ea78..0x43ea84` | Unencrypted flag branch |
| `0x43ee30..0x43ee48` | Encryption-level branch; zero mode bypasses RC4 path |
| `0x43ee5c -> 0x2d26dd4` | Base64 decoder call |
| `0x43b088`, `0x43b0e8`, `0x43b26c` | Mode-dependent binary constant selection / key assembly |
| `0x43b13c`, `0x43b19c`, `0x43b20c` | Additional mode-dependent constant/decimal fragment helpers used by `0x43b26c` |
| `0x2d55658` | UTF-8 string reverse routine used by selected key fragment helper |
| `0x2d4d1a4` | Concatenation helper; called with NULL terminator |
| `0x43b60c` | Key string length, calls `strlen` |
| `0x43eee4 -> 0x43b858` | RC4 call, five arguments: key bytes, key length, payload bytes, payload length, output-length pointer |
| `0x43ef6c -> 0x2d2c9fc` | Converts decoded bytes to script string |
| `0x43fa8c..0x43fc44` | Script initialization/RPC coroutine candidate |

Native virtual addresses are image-relative ELF VAs, not phone runtime addresses. Unwind starts delimit candidates but do not establish complete function bodies independently; disassembly corroborates the relevant front-end entries. The raw disassembly is preserved in `analysis/native/copied-loader.asm` and `analysis/native/copied-crypto.asm`. `analysis/native/copied-injector-xrefs.json` retains bounded ADRP+ADD string-reference candidates and explicitly notes that this search does not validate data/control flow. `analysis/native/copied-injector-strings.json` retains relevant short strings.

## Limits

No gifting implementation was investigated within this independent injector scope. The decoded agents are now suitable for that feature tracing. Other encryption-level branches were not reproduced or validated; no device identity or account preference values were needed for decoding the two supplied files. Provenance of the embedded engine remains unverified; Frida-family resemblance is architectural evidence from its Floyd/GUM/Vala naming and script runtime concepts.
