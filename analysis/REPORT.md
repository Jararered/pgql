# Pokemod 13.8.0: architecture and friend-gift reconstruction

**Later work:** this is the historical APK-only report. The phone copy subsequently enabled agent decoding (`copied-injector-findings.md`) and gift-source tracing (`mass-gift-findings.md`). The user then clarified that the primary goal was an original injector/module framework. That project is now in `../framework/`, with its current build and device results documented in `../framework/README.md` and `../framework/VALIDATION.md`. Conclusions about absent agent files or an unbuilt custom APK below describe the earlier investigation stage.

This investigation establishes the APK's launcher/instrumentation architecture. It does **not** recover or verify an implementation of mass friend gifting. The strongest lead is a separately downloaded agent, which was not supplied with this APK. No APK, native executable, or game process was executed.

## Target identity

- Input: `/Users/jared/Ghidra/PokeMod/Pokemod-v13.8.0.apk`, 51,476,309 bytes.
- SHA-256: `78e181da98f39e2267b0ec0465b3f79bd21edd13040cc5ac442688083043d784`.
- Decoded manifest package: `com.pokemod.app.public`; version `13.8.0`, code `1380999`; minimum SDK 28, target SDK 34.
- Application: `com.pokemod.app.PokemodHALApp`. Important components: `AuthActivity`, `MainActivity`, `com.pokemod.app.injector.HALService`, and `com.pokemod.app.receivers.DataReceiver`.
- Permissions include internet, foreground service, overlay, package inspection/installation and an `ACCESS_SUPERUSER` declaration. Declarations do not demonstrate permissions being granted or used.

## Observed architecture

```mermaid
flowchart LR
  A[Android launcher and account UI] --> B[Module API client]
  B --> C[Response body saved as agent file]
  C --> D[HALService receives agent path]
  D --> E[Native injector and script runtime]
  E -. Intended instrumentation target .-> F[Pokemon GO process]
```

The arrows summarize static references and recovered strings. They are not a runtime trace.

1. **Android shell and services.** The APK contains two DEX files with 10,810 class definitions combined, including dependencies. Many app classes are renamed to `Init$...`. Kotlin metadata/debug strings retain some original source names. Both class renaming and a string decoder obstruct ordinary text searching.
2. **Network module agent retrieval.** `Init$ca0.getModuleAgent(String,String)` constructs `Init$z90`; its `subscribe` method calls `Init$w90.A(String,String,String)` returning a Retrofit `Call`, executes it, checks success and emits its response body. Parallel methods exist for agent hashes, the module list, and a VPGP agent. These are observed instruction references; complete argument/data-flow reconstruction remains open.
3. **Agent storage.** `Init$eq.AJZl24Fp(Context,Init$um0,String)` references `getFilesDir`, `mkdirs`, `FileOutputStream`, `renameTo`, `getAbsolutePath` and deletion. Its plaintext parameter label is `agentName`. Recovered strings name `agents`, `main_agent`, `vpgp_agent`, `/agents/main_agent`, and `/agents/vpgp_agent`, and explicitly describe failures to save downloaded agents. Together these support downloaded agent storage in the application's private files directory.
4. **Service handoff.** `HALService.onStartCommand` enters coroutine wrappers that reach its large startup method, which instantiates `Init$a00` and invokes its injection methods. The decoded pool names `AGENT_PATH`, `VPGP_AGENT_PATH`, `AGENT_KEYS`, and `InjectionType`; its command fragments include ` -s `, ` -p $TARGET_PID -s ` and ` -R v8 -P `. The pool also includes `attach`, `spawn`, and a `TARGET_LIBRARY` default of `libNianticLabsPlugin.so`. Exact assembled commands and branch conditions require further decompilation.
5. **Native infrastructure.** `assets/pokemod-injector` is a 33,219,024-byte AArch64 ELF executable image with `/system/bin/linker64`, no section-header table, and usable program headers/imports. Its Floyd/GUM/GLib/Vala, script-runtime, script reload and agent-loading diagnostics strongly suggest a customized Frida-family engine. Upstream provenance is an inference; it was not verified against an upstream build. Absence of section headers alone does not prove packing.
6. **JNI helpers.** `libfancier.so` exports `Java_Init_Init` and `Java_Init_Context`; the DEX declares corresponding native methods. APK/ZIP/certificate strings and decoded anti-tamper messages suggest initialization/integrity handling, but the exact decisions were not decompiled. `libconceal.so` includes Facebook Conceal crypto JNI exports and additional `sig_app`/`sigx_app` symbols. Neither library has been shown to implement gifting.

## What this means for your gift button

Your requested feature is a button that processes the day's friend gifts without opening every friend manually. The APK gives us the loader architecture, but no verified friend enumeration, send/open operation, eligibility filter, daily counter, or gift action handler.

There are **no case-insensitive `friend` or `gift` substring matches in the exactly decoded `Init$dg` pool**. That search covers 4,261 length-prefixed entries, totaling 84,957 UTF-16 units, from 11 literals. It does not cover every possible resource, runtime payload, encoded blob, or dynamically obtained value. Separate DEX strings include `friends` and `isInFriendModule`; those identifiers alone do not demonstrate a gift implementation.

The network retrieval code, agent filenames, and V8 command fragments make a downloaded script agent the strongest candidate for feature logic. This is a supported architectural inference, not proof that a gifting feature exists in a particular agent.

## Proposed implementation boundary

These are design choices for your own code, not recovered Pokemod behavior:

- A **Send today's gifts** action, with optional opening handled as a separate mode until its intended behavior is specified.
- A queue of currently eligible friends, refreshed from actual game state. Sending eligibility and daily completion must be tracked separately.
- A single operation in flight. Wait for a confirmed result before recording success and moving on; handle out-of-gifts, ineligible friend, full inventory, daily limit and transient errors as distinct results.
- Progress showing sent/skipped/failed counts, plus cancel/resume. A rerun should recheck state and avoid resending completed actions.
- An adapter containing version-specific game interfaces. Keep the queue, policy and UI independent of hook addresses so a game update does not require rewriting the feature.

The adapter cannot be implemented reliably from this APK alone. We still need the actual friend/gift interfaces and result semantics. A working hook, a recovered gift feature or a functional custom APK has not been produced.

## Next evidence needed

The highest-value next input is the cached **main agent** from your existing Pokemod installation, associated with its Pokemon GO version. The launcher strings point to an expected location under the app's private files directory, commonly `/data/user/0/com.pokemod.app.public/files/agents/main_agent` (an Android path inference; it has not been observed on a device). The same package can have different downloaded agents over time.

With that file, inspect its actual format, hashes and friend/gift symbols, then trace the action from UI entry through friend selection, gift operation and result handling. If it is encoded, follow the loader's decoding code before drawing conclusions. A matching game APK/native library may then be needed to resolve the interfaces. There is no need to reuse the original service, accounts or backend in your own implementation merely because this launcher uses them.

## Checklist and limitations

| Question | Status | Evidence / remaining gap |
|---|---|---|
| What artifact/package is this? | Answered | APK digest, archive inventory, locally decoded manifest |
| What are the major components? | Answered for static layout | Manifest, DEX members, native inventory |
| How does launcher reach injector? | Partially answered | Static calls and command fragments; exact branch/data flow unresolved |
| Where is feature code likely stored? | Strong inference | Network agent response, private-file writer, agent paths and runtime options |
| How does gifting work? | Unresolved | Actual agent and game interfaces absent |
| What should your own feature look like? | Proposed design | Queue/controller/adapter separation above |

REA's Android code provider was unavailable because `REA_JADX_MCP_JAR` was not configured with its required caller-supplied JADX headless MCP 0.7.1 JAR. Local DEX projection is not Java source recovery: it inventories standard instructions, string constants and invoke references, without resolving control flow, reflection, field data flow or encrypted-string call-site values. It scanned 15,772 methods under `LInit`/`Lcom/pokemod`, of which 1,280 have no code, and 14,492 had linear scans; methods outside that scope were not projected. The original simple DEX string dumps used replacement UTF-8 decoding; use the separate exact MUTF-8 decoded pool for obfuscated text conclusions.

REA's whole-injector Ghidra overview exceeded the client tool's 300-second response timeout. No completed overview/decompilation result was used, and the session was closed. Full REA extraction failed because macOS's destination filesystem could not represent both `res/1u.png` and `res/1U.png`; selective local extraction preserved assets, DEX, manifest, resource table and native libraries without flattening those resource names. APK signatures were not verified. No device was returned by the ADB inventory.

## Evidence and reusable files

REA artifact inspection: `ev_a3411142cc5f6ac05f287c1a8555f2701b049b67fb03d033166f965b4098e65e`; nested inventory: `ev_940ed344d561bafbe08f285bc45b1a4265262f47cc912b02595aa0ce1abbe2b8`. The complete inline artifact record, including nested inventory, is in `rea-artifact-evidence.json`. ADB inventory: `ev_afb71fa783c4db8b65fd2b90f9b90e5f6342631fea22b97f1cdfadd1478b3229` (no devices), exported separately in `rea-evidence.json` after session close.

Ordinary local static outputs, distinct from REA Evidence:

- `manifest.txt`, `members.json`, and `extracted/`: decoded declarations and content hashes.
- `dex_inventory.py`, `app-methods.json`, `architecture-traces.json`: reproducible member/instruction projection. DEX `code_offset` and reference `file_offset` values are byte offsets; `code_unit` values are 16-bit instruction offsets.
- `native/decode_pool.py`, `decoded-pool.json`, `decoded-pool-strings.json`, `decoded-pool-strings.txt`: exact MUTF-8 extraction and complemented UTF-16 pool entries with offsets.
- `native-inventory.md` and `native/*`: native hashes, layout, symbols and bounded string evidence.

Useful DEX anchors in `classes.dex`: `getModuleAgent` at `0x200a00`; `Init$z90.subscribe` at `0x2004bc`; agent writer at `0x1d434c`; `HALService.onStartCommand` at `0x399b0c`; startup method at `0x39a344`; injector command builder at `0x1e76c0`; string decoder at `0x1bcc7c`. These are method code-item file offsets, not runtime addresses.
