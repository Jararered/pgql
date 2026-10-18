#!/usr/bin/env python3
"""Copy the installed Pokemon GO APK splits from the connected phone into build/game-apks/<version>/.

Usage: python3 scripts/archive-game.py

Run it before letting the game update, so the previous build stays available
for scripts/native-diff.py and as a rollback reference. Existing archives are
never overwritten.
"""

import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package = "com.nianticlabs.pokemongo"


def adb(*args):
    return subprocess.run(
        ["adb", *args], check=True, capture_output=True, text=True
    ).stdout


def installed_version():
    match = re.search(r"versionName=(\S+)", adb("shell", "dumpsys", "package", package))
    if not match:
        raise SystemExit(package + " is not installed on the connected device")
    return match.group(1)


def main():
    version = installed_version()
    target = root / "build/game-apks" / version
    if target.exists() and any(target.glob("*.apk")):
        print("Already archived: " + str(target.relative_to(root)))
        return 0
    target.mkdir(parents=True, exist_ok=True)
    paths = [
        line.split(":", 1)[1].strip()
        for line in adb("shell", "pm", "path", package).splitlines()
        if line.startswith("package:")
    ]
    if not paths:
        raise SystemExit("No APK paths reported for " + package)
    for path in paths:
        subprocess.run(
            ["adb", "pull", path, str(target / Path(path).name)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
    print(
        "Archived {} {}: {}".format(package, version, ", ".join(sorted(p.name for p in target.glob("*.apk"))))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
