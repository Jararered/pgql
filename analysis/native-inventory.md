# Offline native inventory

Scope: only `assets/pokemod-injector`, `lib/arm64-v8a/libfancier.so`, and `lib/arm64-v8a/libconceal.so` from the extracted APK. Nothing was executed. Evidence here is filesystem/static ELF evidence, not REA retained evidence. The adjacent JSON inventories contain hashes, exact program-header offsets, dynamic tags, and symbols. Plain `strings` output is supporting evidence only and does not establish executed behavior.

## Observed identity and layout

| Artifact | Bytes | Format / entry | Dynamic dependencies | Dynamic symbols |
|---|---:|---|---|---:|
| pokemod-injector | 33,219,024 | ELF64 little-endian AArch64 ET_DYN, entry `0x472000`, interpreter `/system/bin/linker64` | libm, libdl, libc | 266 including null; no named defined exports |
| libfancier.so | 47,840 | ELF64 little-endian AArch64 ET_DYN, entry `0x38d4`, 23 sections, stripped | liblog, libz, libm, libdl, libc | 56 including null |
| libconceal.so | 267,928 | ELF64 little-endian AArch64 ET_DYN, entry `0x12150`, 20 sections, stripped | liblog, libstdc++, libm, libc, libdl | 61 including null |

SHA-256:

- injector: `60da475360e685524a3a622ae47b3065242785eaa53896b20488f82a4da58ac3`
- fancier: `449753004a60f6c346e2430ea87c50c4b0892e654a7abd0ecefe8fe77d50e4cc`
- conceal: `9bc3cc06192654d1377df0061e85b9c3abb993dcb85ae972edfec4ec9c296f59`

All three have executable/readable and writable LOAD regions and non-executable GNU_STACK declarations, with GNU_RELRO regions. Injector has no section-header table; it retains program headers, dynamic imports, unwind header, and abundant plaintext diagnostic strings. No section headers does not by itself prove encryption or packing. Whole-file byte entropies are 6.125, 5.680, and 4.972 bits/byte respectively; those are descriptive metrics, not packer classifications.

The injector has nine additional ELF magic locations: `0x4bdc40`, `0x4bf3c0`, `0x4c0c60`, `0x4c2480`, `0x4c4e90`, `0x1bd7e00`, `0x1bd9b50`, `0x1bdbd10`, `0x1bdd900`. Their header prefixes identify x86, x86-64, ARM, AArch64, and BPF candidate objects. These are consistent with embedded helpers/loader objects; full nested-artifact validation was outside this inventory. No literal `UPX!` marker was found in the injector; this is a bounded marker check, not proof of absence of all packing.

## Injector clues

Observed strings include `Pokemod Injector version %s`, `FloydInjectApplication`, `floyd_inject_application_get_script_path`, `script-path`, `script-runtime`, `qjs|v8`, `Parameters as JSON, same as Gadget`, `Failed to reload script: %s`, and extensive Floyd/GUM/GLib/Vala names. Source-path strings include `../subprojects/floyd-core/src/linux/kernel-injector.vala` and `../subprojects/floyd-core/src/linux/proc-mem-injector.vala`. Imports include `ptrace`, `dlopen`, `dlsym`, `mmap`, `mprotect`, `pread`, `pwrite`, `fork`, and `execve`. Diagnostics mention `/proc/%u/mem`, agent loading, helper processes, and script loading.

Inference (strong architectural clue, not a verified upstream identity): the executable appears to bundle a renamed/custom Frida-family injection and JavaScript instrumentation engine. The visible Floyd/GUM naming and matching concepts support this; a bytecode/version/source comparison would be needed to prove provenance. `qjs|v8` documents candidate CLI runtime choices but does not prove that both runtime engines are enabled in this build.

The large executable and only three system dependencies are consistent with statically linked supporting components. Strings show OpenSSL, JSON-GLib, GLib, libbpf, SELinux, and GUM code. Their presence does not establish which components are exercised by this application's launch flow.

## fancier clues

The only named exports are `Java_Init_Context` and `Java_Init_Init`. Imports include ZIP compression functions (`inflate`, `deflate`, `crc32`) and ordinary file/directory operations. Strings include `/proc/self/cmdline`, `/proc/self/maps`, `base.apk`, `base.odex`, `base.vdex`, `META-INF/`, `.RSA`, `.DSA`, `signerInfos`, `certificates-[optional]`, ASN.1 certificate field labels, `lib/`, and `libconceal.so`. Toolchain comment names Android NDK r23b and Clang 12.0.8.

Inference: this is a JNI initialization helper with APK/ZIP/certificate handling. It may participate in APK integrity or native extraction, but confirming checks, patching, trust decisions, or signature changes requires following the two exported functions. The strings alone do not establish any of those operations.

## conceal clues

Exports explicitly name Facebook Conceal Java namespaces: `NativeGCMCipher` encryption/decryption/update/AAD methods, `NativeMac` operations, `PasswordBasedKeyDerivation_nativePbkdf2`, NativeUtils success/failure helpers, and `JNI_OnLoad`. Other exports include `sig_app` and `sigx_app`. OpenSSL/AES strings are present.

Inference: much of this library provides Conceal-style crypto JNI plumbing. The `sig_app`/`sigx_app` exports are unusual additional entry points worth tracing before assuming it is an unchanged standard Conceal build. No claim about the application's key derivation or encrypted payload is established by the native inventory.

## Reconstruction limits and next evidence

The injector is infrastructure; this inventory does not identify a Pokemon GO feature implementation. The actionable next link is the Java launch command and supplied script/payload path, then the payload or download/decryption path. Native source names and debug strings are useful orientation, but all libraries lack normal native debug symbols and static evidence does not recover the original source faithfully. A disassembler can analyze LOAD mappings despite the injector's absent sections. Prioritize small JNI exports in fancier/conceal and their Java callers before decompiling the entire 33 MB engine.

Supporting files: `analysis/native/inspect_elf.py`, `analysis/native/*.json`, and `analysis/native/*.strings.txt`. The parser reads ELF64 little-endian tables directly; symbol counts use SYSV/GNU hash bounds. It is intentionally an inventory, not a disassembler or a complete ELF validator.
