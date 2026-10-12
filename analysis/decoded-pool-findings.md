# Exact static DEX string pool recovery

Source: `analysis/extracted/classes.dex`, SHA-256 `1089cf895912e7072cc08cf2c637533c840cecc0b43fa8d619feb69c75437f97`. Selected operands: the 11 const-string instructions listed for `LInit$dg;-><clinit>()V` in `app-methods.json`. The script re-reads each instruction and its string index directly from the DEX, decodes the original MUTF-8 into UTF-16 code units without replacement, XORs every code unit with `0xffff`, and concatenates the transformed literals. Reading one unsigned UTF-16 length followed by that many units yields **4,261 strings**, consuming **all 84,957 code units** exactly.

This complete structural parse plus readable text strongly supports the transform and length-prefix interpretation. The helper's actual decoding control flow still needs corroboration; no target code was executed. JSON includes exact `decoded_units` arrays because a JSON reader may combine surrogate pairs and lose the distinction between code-point and UTF-16 offsets. An earlier UTF-8 replacement-decoded preview must not be used for exact lengths or indices.

Artifacts: `decoded-pool.txt` preserves the 11 transformed chunks with escaped controls; `decoded-pool.json` preserves per-instruction offsets and original string indices; `decoded-pool-strings.json` and `.txt` supply index, UTF-16 offset, and each segmented string. Reproduce using `python3 analysis/native/decode_pool.py` from the repository root.

## Injection and downloaded module clues

Recovered strings include:

- entries 173/178: `api.getModuleAgent(gameV…ppSignatureSha).execute()` and `api.getVpgpAgent(gameVer…ppSignatureSha).execute()` (ellipsis occurs in the artifact itself).
- entries 209/225–227: `agentKeys`, `agentHash`, `vpgpAgentHash`.
- entries 1442/1443: `/agents/main_agent`, `/agents/vpgp_agent`.
- entries 3813–3821: `LC_ALL="en_US.UTF-8" `, ` -f `, ` -s `, ` -R v8 -P `, ` -p $TARGET_PID -s `, and redirected stdin. These suggest spawn/attach launch variants using V8, but concatenation order and argument values must be established from callers.
- entries 3822/3823: `libNianticLabsPlugin.so`, `libholoholo.so`.
- entries 4000–4007: JSON fragments containing `uuid`, `refreshToken`, `apiBaseUrl` (`https://discovery.pokemod.dev/hal/`), `injectionType` (`spawn`/`attach`), `targetLibrary`, and `signals`.
- entry 4012: `Failed to start VPGP injection, but continuing with main process`.

Inference: the launcher supports a main agent and an optional vPGP agent, retrieves agent metadata/content remotely, then passes configuration to the injector. These strings corroborate the native injector's JavaScript engine clues; they do not disclose agent feature code or prove a successful runtime download.

## Additional scope and integrity clues

The pool contains account management, OAuth, root/SELinux setup, logging, Discord presence, vPGP settings, recording-mode device settings, service state transitions, and telemetry strings. `theappninjas.gpsjoystick.TELEPORT` and latitude/longitude command fragments are also present. Report these as packaged capabilities/clues; strings alone do not establish execution or whether a feature is accessible in this build.

Entries 4200–4227 describe comparing native and PackageManager signatures and calculating SHA-1/Base64 signature hashes. Entries 4228–4255 describe fetching suspicious entry patterns, checking ZIP/APK names, and terminating on a security violation. This supports investigating `libfancier` as signature extraction/integrity support, but does not independently prove its internal native implementation.

## Bounded negative finding

A case-insensitive substring search across all 4,261 decoded strings found **no `friend` or `gift` occurrence**. This applies only to this pool in this DEX. It does not exclude resource strings, other DEX files, encrypted assets, remote agent code, localized wording, or dynamically assembled names. No remote endpoint was fetched and no user account was accessed.
