# Native runner

`--prepare-selinux` is an explicit optional setup step. It invokes upstream `frida_selinux_patch_policy()` and changes system-wide live policy until reboot. The Android checkbox defaults off. See the [main project README](../README.md) for the scope, fallback behavior and device findings. With this flag absent, the runner never invokes the policy-writing helper.

Original attach-only Frida core frontend. It does not use the copied Pokemod injector or agents. The pinned official Frida core 17.23.3 Android arm64 devkit lives in `../vendor/frida-core` (download and integrity details are managed by the project dependency setup).

The build applies the **names-v1** hiding profile before linking. `scripts/prepare-frida.py` verifies the official archive's SHA-256 and renames complete, equal-length library and worker-thread strings in `build/frida-core-names/libfrida-core.a`. Vendor files stay unchanged. Both main-game and GO Plus runners use this build copy, so the names change before injection rather than after JavaScript starts. Agent filenames use `pgql-worker`, QuickJS uses `pgql-js-job`, and GLib workers use `pwork`/`pcomm`; the agent thread/program name is `pgqlx`. The manifest `build/frida-core-names/names.json` records replacements and digests. A changed devkit or unexpected string count fails the build for review.

This masks known names; it does not hide instrumentation memory, hooks, direct syscalls, SELinux labels, protocol identifiers, or exported symbols. In particular `frida_agent_main` stays intact to preserve ELF symbol lookup. Upstream Frida's own resource cloaking remains enabled. No runtime `/proc` filtering, game detection hooks, or recovered Pokemod code is added. See [the investigation and validation limits](../docs/FRIDA-HIDING.md).

Build with an existing Android NDK (parent project uses NDK 27c, arm64 API 28):

```sh
ANDROID_NDK_HOME=/absolute/path/to/ndk ./build.sh
```

Default output is `../app/src/main/jniLibs/arm64-v8a/libqolrunner.so`. Despite its packaging name, this is a PIE executable with an entry point, launched from Android's extracted native library directory under the user's root shell. The app must keep extraction of native libraries enabled. No frida-server is used by this local-device frontend.

Invocation:

```sh
/path/to/libqolrunner.so --pid 1234 --script /absolute/path/module.js
```

The PID must already exist. The runner neither launches nor kills the target. It loads the UTF-8 script into the QuickJS runtime and attaches stdin/stdout to its owning app.

Stdin is newline-delimited raw JSON forwarded to `frida_script_post`. Example framework command:

```json
{"type":"command","id":"1","action":"list"}
```

EOF, SIGINT and SIGTERM initiate cleanup and session detachment. The default CLI unloads the script as before. Opt in with `--resident-agent` for logical detachment on devices where physical agent unloading causes a target crash:

```sh
/path/to/libqolrunner.so --pid 1234 --script /absolute/path/module.js --resident-agent
```

In this mode the runner posts `{"type":"command","action":"shutdown","id":"native-shutdown"}`, waits up to three seconds for a Frida `send` message whose payload has `type:"shutdown-complete"` and `id:"native-shutdown"`, calls `frida_script_eternalize_sync`, and detaches the session. The framework agent's shutdown handler must disable every enabled module, remove tracked listeners/hooks/timers, stop command reception, and acknowledge only after finishing. The JavaScript agent and Frida instrumentation code remain resident until the target process exits. This leaves a memory/runtime footprint even after the UI says detached; it is not physical uninstallation from the process. The runner never kills or restarts the target.

If the shutdown acknowledgement times out, the runner reports cleanup as unconfirmed, sets exit status 2, and still attempts eternalization to avoid the known problematic unload path. If eternalization fails, it reports that failure before detaching; this mode cannot then promise avoidance of target crashes. The `resident-agent` event reports both `shutdown_acknowledged` and `eternalized` booleans. No runtime compatibility guarantee follows from a successful API return. Keep stdin open until outstanding command replies arrive; EOF is a shutdown request rather than an acknowledgement barrier. Invalid JSON emits an error and leaves the session active. A line longer than 1 MiB ends the session with an error. Scripts are limited to 16 MiB, valid UTF-8, and no NUL characters.

Stdout emits one JSON object per line:

- `{"event":"ready","pid":1234,"frida_hiding":"names-v1"}` after script loading.
- `{"event":"message","message":{...}}` carrying Frida's own script message, optionally `data_base64` for binary data.
- `{"event":"detached","reason":N,"crashed":false}` with the Frida 17.23.3 detach-reason enum value.
- `{"event":"error","stage":"attach","message":"..."}` for failures.
- `{"event":"resident-agent","shutdown_acknowledged":true,"eternalized":true}` when the opt-in logical detach path completes.

Exit status 0 indicates requested shutdown, 2 indicates runner/setup/cleanup failure, and 3 indicates unexpected target detachment. Startup operations use Frida's synchronous API; a signal received during such an operation is acted on when that operation returns. Loading a script permits its declared code to execute in the target; only the starter diagnostics module is intended for initial device validation.

Validation performed locally: compilation syntax against the pinned devkit header (`-Wall -Wextra -Werror`), and isolated stdin JSON parser tests with address/undefined-behavior sanitizers. The parser handles JSON grammar and nesting limits; the runner separately validates UTF-8. No Android process was attached during this native change validation. Parent device testing separately observed an unload-related crash and is testing this opt-in mitigation.

The API signatures were checked against the downloaded header and official Frida documentation:

- [Device attach](https://frida.re/docs/frida-core/method.Device.attach_sync.html)
- [Session detached signal](https://frida.re/docs/frida-core/signal.Session.detached.html)
- [Session script creation](https://frida.re/docs/frida-core/class.Session.html)

Run the isolated host parser check from this directory:

```sh
cc -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined json_protocol.c test_json_protocol.c -o /tmp/framework-json-test
/tmp/framework-json-test
```
