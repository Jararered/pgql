"""Rename attach-time identifiers in a build copy of the pinned Frida devkit.

Equal-sized, complete C-string replacements preserve ELF/archive layout and
linker symbols. This is name obfuscation, not a promise of undetectability.
"""
import argparse
import hashlib
import json
from pathlib import Path

DEVKIT_SHA256 = '7aa83d7fae13def91893e330aab142063c1f1d8dd0cf090bf5cfd80407d7ed90'
# Counts bind this contract to the official 17.23.3 Android arm64 archive.
# Do not rename exported entry points: ELF hash tables depend on their names.
RENAMES = (
    ('frida-agent-64.so', 'pgql-worker-64.so', 1),
    ('frida-agent-32.so', 'pgql-worker-32.so', 1),
    ('frida-agent-arm64.so', 'pgql-worker-arm64.so', 2),
    ('frida-agent-arm.so', 'pgql-worker-arm.so', 2),
    ('frida-agent-<arch>.so', 'pgql-worker-<arch>.so', 1),
    ('libfrida-agent-raw.so', 'libpgql-worker-raw.so', 2),
    ('frida-agent-container', 'pgql-worker-container', 1),
    ('gum-js-loop', 'pgql-js-job', 2),
    ('gmain', 'pwork', 4),
    ('gdbus', 'pcomm', 4),
    ('frida', 'pgqlx', 3),
)


def rename_literals(source, renames=RENAMES):
    result = source
    changes = []
    for old, new, expected in renames:
        if len(old.encode('ascii')) != len(new.encode('ascii')):
            raise ValueError('Replacement changes layout: ' + old)
        before = b'\0' + old.encode('ascii') + b'\0'
        after = b'\0' + new.encode('ascii') + b'\0'
        count = result.count(before)
        if count != expected:
            raise ValueError(f'Pinned identifier changed: {old} ({count}, expected {expected})')
        result = result.replace(before, after)
        changes.append({'original': old, 'replacement': new, 'count': count})
    return result, changes


def prepare(devkit, output):
    devkit, output = Path(devkit).resolve(), Path(output).resolve()
    original = devkit / 'libfrida-core.a'
    if output == devkit or (output / original.name).resolve() == original:
        raise ValueError('Use a separate build directory; vendor inputs are read-only')
    source = original.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != DEVKIT_SHA256:
        raise ValueError('Frida devkit differs from pinned 17.23.3 Android arm64; review hiding contract')
    renamed, changes = rename_literals(source)
    output.mkdir(parents=True, exist_ok=True)
    # Validate everything before writing anything. Every build starts upstream.
    (output / original.name).write_bytes(renamed)
    report = {'profile': 'names-v1', 'version': '17.23.3',
              'input_sha256': digest, 'output_sha256': hashlib.sha256(renamed).hexdigest(),
              'changes': changes}
    (output / 'names.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--devkit', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = prepare(args.devkit, args.output)
    except (OSError, ValueError) as error:
        parser.exit(2, str(error) + '\n')
    print('Prepared Frida names-v1 build copy:', args.output)
