#!/usr/bin/env python3
"""Compare the libholoholo.so functions Virtual GO Plus depends on across two game builds.

Usage: python3 scripts/native-diff.py OLD NEW [--report FILE]

OLD and NEW are each a libholoholo.so, an APK split containing it, or a
directory of archived splits (see scripts/archive-game.py). The export list is
read from the agent sources, so it cannot drift from what the adapter binds.

Each export must exist in NEW. Functions are disassembled with the NDK's
llvm-objdump and compared after normalizing what moves between builds without
changing behavior: instruction addresses, absolute branch targets, ADRP pages
and the :lo12: offsets paired with them. Exit status is 1 when an export is
missing or a function that reads or writes the pinned struct offsets
(docs/GOPLUS.md) changed, so a new build needs review before re-enabling.
"""

import argparse
import difflib
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sources = [
    root / "agent/adapters/game-go-plus.js",
    root / "agent/core/pgp-manager.js",
    root / "agent/core/jni-helper.js",
]
# Changes here are reported but not fatal: PGQL only calls these, it does not
# depend on their field layout (see the 0.433.0 re-verification in GOPLUS.md).
informational = ("PgpManagerAndroid", "_ZN3pgp5sfida6ModuleD2Ev")
library = "lib/arm64-v8a/libholoholo.so"


def exports():
    names = set()
    for path in sources:
        names.update(re.findall(r"'(_ZN3pgp[A-Za-z0-9_]+)'", path.read_text()))
    if not names:
        raise SystemExit("No libholoholo exports found in the agent sources")
    return sorted(names)


def tool(name):
    base = Path(
        os.environ.get("ANDROID_NDK_HOME", root / "toolchains/ndk/android-ndk-r27c")
    )
    found = sorted(base.glob("toolchains/llvm/prebuilt/*/bin/" + name))
    if not found:
        raise SystemExit(
            "Missing toolchain: " + name + " (run python3 scripts/bootstrap.py)"
        )
    return str(found[0])


def resolve(path, scratch):
    path = Path(path)
    if path.is_dir():
        for candidate in sorted(path.glob("*.apk")):
            with zipfile.ZipFile(candidate) as archive:
                if library in archive.namelist():
                    return resolve(candidate, scratch)
        raise SystemExit(str(path) + ": no split contains " + library)
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            if library not in archive.namelist():
                raise SystemExit(str(path) + ": no " + library)
            out = Path(scratch) / (path.parent.name + "-" + path.stem)
            archive.extract(library, out)
            return out / library
    return path


def symbols(lib):
    out = subprocess.run(
        [tool("llvm-nm"), "-D", "-S", "--defined-only", str(lib)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    table = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 4:
            table[parts[3]] = (int(parts[0], 16), int(parts[1], 16))
    return table


branch = re.compile(r"0x[0-9a-f]+ (<[^>]+>)")
address = re.compile(r"(?<!#)\b0x[0-9a-f]{5,}\b")
memory = re.compile(r"\[(x\d+), #(-?0x[0-9a-f]+)\]")
add_lo12 = re.compile(r"^add\s+(x\d+), (x\d+), #0x[0-9a-f]+$")


def callee(label, function):
    # Internal branches keep their offset; calls to unnamed local code are
    # labelled relative to whatever symbol precedes it, which moves freely.
    inner = label[1:-1]
    if inner == function or inner.startswith(function + "+") or "+0x" not in inner:
        return label
    return "<CALL>"


def normalize(lines, function=""):
    pages = set()
    result = []
    for line in lines:
        text = line.split(":", 1)[1].strip() if ":" in line else line.strip()
        text = re.sub(r"\s+", " ", text.replace("\t", " ")).strip()
        if not text:
            continue
        op, _, rest = text.partition(" ")
        target = rest.split(",")[0].strip() if rest else ""
        if op == "adrp":
            pages.add(target)
            result.append("adrp " + target + ", PAGE")
            continue
        match = add_lo12.match(text)
        if match and match.group(2) in pages:
            text = "add " + match.group(1) + ", " + match.group(2) + ", #LO12"
        else:
            text = memory.sub(
                lambda m: (
                    "[" + m.group(1) + ", #LO12]" if m.group(1) in pages else m.group(0)
                ),
                text,
            )
        text = branch.sub(lambda m: callee(m.group(1), function), text)
        text = address.sub("ADDR", text)
        # A register stops holding a page once something else is written to it.
        if target in pages and op != "adrp":
            pages.discard(target)
        result.append(text)
    return result


def disassemble(lib, name, start, size):
    out = subprocess.run(
        [
            tool("llvm-objdump"),
            "-d",
            "--no-show-raw-insn",
            "--start-address=" + hex(start),
            "--stop-address=" + hex(start + size),
            str(lib),
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return normalize(
        [line for line in out.splitlines() if re.match(r"^\s+[0-9a-f]+:", line)], name
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("old")
    parser.add_argument("new")
    parser.add_argument("--report", help="also write the report to this file")
    args = parser.parse_args()
    lines = []
    status = 0
    with tempfile.TemporaryDirectory() as scratch:
        old, new = resolve(args.old, scratch), resolve(args.new, scratch)
        before, after = symbols(old), symbols(new)
        for name in exports():
            critical = not any(part in name for part in informational)
            if name not in after:
                lines.append("== MISSING in new build: " + name)
                status = 1
                continue
            if name not in before:
                lines.append("== new export (absent from old build): " + name)
                continue
            a = disassemble(old, name, *before[name])
            b = disassemble(new, name, *after[name])
            changes = [line for line in difflib.ndiff(a, b) if line[:2] in ("+ ", "- ")]
            label = "" if critical or not changes else " (informational)"
            lines.append(
                "== %d changed / %d->%d insns: %s%s"
                % (len(changes), len(a), len(b), name, label)
            )
            lines.extend("   " + line[0] + line[2:] for line in changes[:40])
            if len(changes) > 40:
                lines.append("   ... %d more" % (len(changes) - 40))
            if changes and critical:
                status = 1
    lines.append(
        "RESULT: "
        + (
            "review required: a pinned function changed or an export is missing"
            if status
            else "all pinned functions identical after normalization"
        )
    )
    text = "\n".join(lines) + "\n"
    sys.stdout.write(text)
    if args.report:
        Path(args.report).write_text(text)
    return status


if __name__ == "__main__":
    sys.exit(main())
