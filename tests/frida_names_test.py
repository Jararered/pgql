import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_frida', ROOT / 'scripts/prepare-frida.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FridaNamesTest(unittest.TestCase):
    def test_complete_strings_only_and_layout_preserved(self):
        source = b'\0gmain\0prefix-gmain\0gmain_suffix\0frida_agent_main\0'
        result, _ = module.rename_literals(source, [('gmain', 'pwork', 1)])
        self.assertEqual(result, b'\0pwork\0prefix-gmain\0gmain_suffix\0frida_agent_main\0')
        self.assertEqual(len(source), len(result))

    def test_contract_drift_rejected(self):
        with self.assertRaisesRegex(ValueError, 'identifier changed'):
            module.rename_literals(b'\0gmain\0', [('gmain', 'pwork', 2)])
        with self.assertRaisesRegex(ValueError, 'changes layout'):
            module.rename_literals(b'\0gmain\0', [('gmain', 'too-long', 1)])

    def test_unknown_devkit_and_in_place_writes_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            devkit = Path(temporary) / 'vendor'
            devkit.mkdir()
            original = devkit / 'libfrida-core.a'
            original.write_bytes(b'unknown devkit')
            with self.assertRaisesRegex(ValueError, 'read-only'):
                module.prepare(devkit, devkit)
            output = Path(temporary) / 'build'
            with self.assertRaisesRegex(ValueError, 'differs from pinned'):
                module.prepare(devkit, output)
            self.assertFalse(output.exists())
            self.assertEqual(original.read_bytes(), b'unknown devkit')

    @unittest.skipUnless((ROOT / 'vendor/frida-core/libfrida-core.a').exists(), 'bootstrap devkit absent')
    def test_pinned_archive_and_unchanged_entrypoint(self):
        source = (ROOT / 'vendor/frida-core/libfrida-core.a').read_bytes()
        self.assertEqual(hashlib.sha256(source).hexdigest(), module.DEVKIT_SHA256)
        result, changes = module.rename_literals(source)
        self.assertEqual(len(source), len(result))
        self.assertEqual(source.count(b'frida_agent_main\0'), result.count(b'frida_agent_main\0'))
        for change in changes:
            self.assertNotIn(b'\0' + change['original'].encode() + b'\0', result)


if __name__ == '__main__':
    unittest.main()
