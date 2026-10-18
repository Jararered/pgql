"""Acquire pinned official build inputs into this project, never system paths."""

import hashlib
import json
import pathlib
import stat
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def download(url, destination, algorithm=None, expected=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        temp = destination.with_suffix(destination.suffix + ".part")
        print("Downloading", destination.name, flush=True)
        urllib.request.urlretrieve(url, temp)
        temp.replace(destination)
    digest = hashlib.new(algorithm or "sha256", destination.read_bytes()).hexdigest()
    if expected and digest != expected:
        raise RuntimeError("Checksum mismatch: " + destination.name)
    return hashlib.sha256(destination.read_bytes()).hexdigest()


def unzip(source, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source) as archive:
        for info in archive.infolist():
            name = pathlib.PurePosixPath(info.filename)
            if name.is_absolute() or ".." in name.parts:
                raise RuntimeError("Unsafe archive member")
            target = destination / name
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if stat.S_ISLNK(info.external_attr >> 16):
                link = archive.read(info).decode("utf-8")
                resolved = (target.parent / link).resolve()
                if destination.resolve() not in resolved.parents:
                    raise RuntimeError("Unsafe symlink target")
                if target.exists() or target.is_symlink():
                    target.unlink()
                target.symlink_to(link)
                continue
            if target.is_symlink():
                target.unlink()
            target.write_bytes(archive.read(info))
            mode = (info.external_attr >> 16) & 0o777
            if mode:
                target.chmod(mode)


repo = ET.fromstring(
    urllib.request.urlopen(
        "https://dl.google.com/android/repository/repository2-1.xml"
    ).read()
)
packages = {
    "platform-35_r02.zip": ("platforms;android-35", "platform"),
    "build-tools_r35_macosx.zip": ("build-tools;35.0.0", "build-tools"),
    "android-ndk-r27c-darwin.zip": ("ndk;27.2.12479018", "ndk"),
}
records = []
for filename, (package, folder) in packages.items():
    destination = ROOT / "toolchains" / folder
    if (destination / ".complete").exists():
        continue
    match = None
    for p in repo.findall("remotePackage"):
        if p.get("path") != package:
            continue
        for a in p.findall("archives/archive"):
            complete = a.find("complete")
            if complete is not None and complete.findtext("url") == filename:
                match = complete
    if match is None:
        raise RuntimeError("Official package not found: " + filename)
    checksum = match.find("checksum")
    archive = ROOT / "toolchains" / "downloads" / filename
    url = "https://dl.google.com/android/repository/" + filename
    sha = download(url, archive, checksum.get("type", "sha1"), checksum.text)
    unzip(archive, destination)
    (destination / ".complete").write_text(sha)
    records.append({"package": package, "url": url, "sha256": sha})
devkit = ROOT / "vendor/frida-core"
archive = devkit / "devkit.tar.xz"
url = "https://github.com/frida/frida/releases/download/17.23.3/frida-core-devkit-17.23.3-android-arm64.tar.xz"
sha = download(
    url,
    archive,
    "sha256",
    "7bf2a76643b3082134dd08d05873d921c0e05532f34afcd1d50952d9c7ad0ab0",
)
with tarfile.open(archive) as tar:
    for member in tar:
        name = pathlib.PurePosixPath(member.name)
        if name.is_absolute() or ".." in name.parts:
            raise RuntimeError("Unsafe archive member")
        if member.isfile():
            target = devkit / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(tar.extractfile(member).read())
records.append(
    {"package": "frida-core 17.23.3 android-arm64", "url": url, "sha256": sha}
)
lock = ROOT / "toolchains/dependencies.json"
old = json.loads(lock.read_text()) if lock.exists() else []
by_url = {x["url"]: x for x in old + records}
lock.write_text(json.dumps(list(by_url.values()), indent=2))
print("Pinned build inputs ready.", flush=True)
