import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('logicx_release_tools', ROOT / 'tools/release.py')
module = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class VersionSync(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='logicx-version-test-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in ('package.json', 'frontend/package.json', 'frontend/package-lock.json',
                     'logicx_app/__init__.py', 'docs/changelog.md',
                     'frontend/src/logicx-product-workspace.jsx', 'frontend/src/build-metadata.js'):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.version = json.loads((self.root / 'package.json').read_text())['version']
        self.metadata = self.root / 'logicx_app/public/frontend/build-metadata.json'
        self.metadata.parent.mkdir(parents=True, exist_ok=True)
        self.metadata.write_text(json.dumps({'appName': 'LogicX', 'version': self.version}))

    def test_current_metadata_matches(self):
        self.assertEqual(module.check_versions(self.root)[1], [])

    def test_stale_frontend_build_fails(self):
        self.metadata.write_text(json.dumps({'appName': 'LogicX', 'version': '0.0.0'}))
        self.assertTrue(any('Generated frontend' in failure for failure in module.check_versions(self.root)[1]))

    def test_optional_root_lock_mismatch_fails(self):
        (self.root / 'package-lock.json').write_text(json.dumps({
            'version': '0.0.0', 'packages': {'': {'version': self.version}}}))
        self.assertTrue(any('root lock version' in failure for failure in module.check_versions(self.root)[1]))

    def test_newest_changelog_entry_must_match(self):
        path = self.root / 'docs/changelog.md'
        content = path.read_text()
        offset = content.index('### [v ')
        path.write_text(content[:offset] + '### [v 0.0.0] 2026-11-23 - Incorrect current entry\n\n' + content[offset:])
        self.assertTrue(any('Latest changelog entry' in failure for failure in module.check_versions(self.root)[1]))

    def test_independent_dependency_versions_are_ignored(self):
        path = self.root / 'frontend/package-lock.json'
        lock = json.loads(path.read_text())
        lock['packages']['node_modules/example'] = {'version': '99.0.0'}
        path.write_text(json.dumps(lock))
        self.assertEqual(module.check_versions(self.root)[1], [])

    def test_stale_generated_release_manifest_fails(self):
        (self.root / 'release-manifest.json').write_text(json.dumps({'version': '0.0.0', 'tag': 'v-0.0.0'}))
        self.assertTrue(any('Generated release manifest' in failure for failure in module.check_versions(self.root)[1]))

    def test_current_header_is_exact_not_a_version_prefix(self):
        path = self.root / 'docs/changelog.md'
        path.write_text(path.read_text().replace(f'Current version: {self.version}', f'Current version: {self.version}0'))
        self.assertTrue(any('changelog current version' in failure for failure in module.check_versions(self.root)[1]))

    def test_pinned_release_adapter_mismatch_fails(self):
        path = self.root / '.container/prepare-release.mjs'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("const tag = 'v-0.0.0';")
        self.assertTrue(any('release tag references' in failure for failure in module.check_versions(self.root)[1]))

    def test_hardcoded_status_instead_of_build_binding_fails(self):
        path = self.root / 'frontend/src/logicx-product-workspace.jsx'
        path.write_text(path.read_text().replace('statusEnd={buildLabel}', 'statusEnd="LogicX - V0.0.0"'))
        self.assertTrue(any('shared statusEnd slot' in failure for failure in module.check_versions(self.root)[1]))
