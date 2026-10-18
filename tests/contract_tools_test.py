import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


native = load('native_diff', 'native-diff.py')
contracts = load('contract_diff', 'contract-diff.py')


class NativeDiffTest(unittest.TestCase):
    def test_exports_come_from_agent_sources(self):
        names = native.exports()
        self.assertEqual(len(names), 17)
        self.assertIn('_ZN3pgp5sfida6Module12HandleUpdateEv', names)
        self.assertIn('_ZN3pgp7android17PgpManagerAndroid22SendEncounterIdMessageEl', names)

    def test_normalize_hides_layout_but_keeps_offsets(self):
        function = '_ZN3pgp5sfida6Module12HandleUpdateEv'
        def code(base, page, lo, local):
            return [
                f'  {base:x}:      \tldrb\tw8, [x0, #0xd8]',
                f'  {base + 4:x}:      \tcbz\tw8, 0x{base + 0x108:x} <{function}+0x108>',
                f'  {base + 8:x}:      \tbl\t0x{local:x} <__emutls_get_address+0x{local & 0xfff:x}>',
                f'  {base + 12:x}:      \tbl\t0xc10340 <_ZN4util8location8Location7IsValidEv@plt>',
                f'  {base + 16:x}:      \tadrp\tx24, 0x{page:x}',
                f'  {base + 20:x}:      \tldr\tx10, [x24, #0x{lo:x}]',
                f'  {base + 24:x}:      \tmov\tw21, #0x5629',
            ]
        old = native.normalize(code(0x902b0c, 0x1234000, 0x5a8, 0xa1a5c), function)
        new = native.normalize(code(0x903000, 0x1240000, 0x9c0, 0xa2a58), function)
        self.assertEqual(old, new)
        self.assertIn('ldrb w8, [x0, #0xd8]', old)
        self.assertIn('mov w21, #0x5629', old)
        changed = native.normalize(code(0x902b0c, 0x1234000, 0x5a8, 0xa1a5c), function)
        changed[0] = changed[0].replace('#0xd8', '#0xe0')
        self.assertNotEqual(old, changed, 'a struct offset change must stay visible')


class ContractDiffTest(unittest.TestCase):
    def report(self, game, ok, fields):
        return {'schema': 1, 'game': game, 'unity': 'u', 'supported': '0.433.0',
                'adapters': {'headshot': {'ok': ok, 'classes': ['Pokeball'], 'members': [],
                                          **({} if ok else {'error': 'Unsupported encounter field'})}},
                'native': {}, 'classes': {'Pokeball': {'parent': None, 'fields': fields, 'methods': ['Launch():System.Void']}}}

    def run_diff(self, old, new):
        with tempfile.TemporaryDirectory() as folder:
            paths = []
            for index, report in enumerate((old, new)):
                path = Path(folder) / f'{index}.json'
                path.write_text(json.dumps(report))
                paths.append(str(path))
            out = io.StringIO()
            argv, sys.argv = sys.argv, ['contract-diff.py', *paths]
            try:
                with contextlib.redirect_stdout(out):
                    status = contracts.main()
            finally:
                sys.argv = argv
            return status, out.getvalue()

    def test_obfuscated_rename_is_paired(self):
        status, text = self.run_diff(self.report('0.433.0', True, ['aBcD:IReticle', 'xY:System.Int32']),
                                     self.report('0.435.0', True, ['qRsT:IReticle', 'xY:System.Int32']))
        self.assertEqual(status, 0)
        self.assertIn('field aBcD -> qRsT : IReticle (probable rename)', text)
        self.assertIn('every audited contract binds', text)

    def test_failing_contract_sets_status(self):
        status, text = self.run_diff(self.report('0.433.0', True, ['a:T']), self.report('0.435.0', False, ['a:T', 'b:T', 'c:T']))
        self.assertEqual(status, 1)
        self.assertIn('headshot: FAILS: Unsupported encounter field (was ok)', text)
        self.assertIn('+ field b:T', text)


if __name__ == '__main__':
    unittest.main()
