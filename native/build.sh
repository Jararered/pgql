#!/usr/bin/env bash
set -euo pipefail
# ANDROID_NDK_HOME points to an existing NDK; this script installs nothing.
native_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$native_dir/.." && pwd)"
devkit_dir="${FRIDA_CORE_DEVKIT:-$project_dir/vendor/frida-core}"
: "${ANDROID_NDK_HOME:?Set ANDROID_NDK_HOME to an installed Android NDK}"
case "$(uname -s)" in
  Darwin) host_tag=darwin-x86_64 ;;
  Linux) host_tag=linux-x86_64 ;;
  *) echo 'Unsupported build host (use the NDK manually).' >&2; exit 2 ;;
esac
compiler="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$host_tag/bin/aarch64-linux-android28-clang"
output="${1:-$project_dir/app/src/main/jniLibs/arm64-v8a/libqolrunner.so}"
[[ -f "$devkit_dir/frida-core.h" && -f "$devkit_dir/libfrida-core.a" ]] || { echo 'Missing pinned official Frida core devkit.' >&2; exit 2; }
mkdir -p "$(dirname "$output")"
prepared_dir="$project_dir/build/frida-core-names"
python3 "$project_dir/scripts/prepare-frida.py" --devkit "$devkit_dir" --output "$prepared_dir"
"$compiler" -std=c11 -DANDROID -O2 -Wall -Wextra -Werror \
  -ffunction-sections -fdata-sections -fPIE -pie \
  -I"$devkit_dir" "$native_dir/runner.c" "$native_dir/json_protocol.c" \
  "$prepared_dir/libfrida-core.a" -llog -ldl -lm -pthread \
  -Wl,--export-dynamic -Wl,--gc-sections -Wl,-z,max-page-size=16384 -o "$output"
echo "Built $output"
