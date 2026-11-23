"""Build pinned upstream development sources without connecting to a database."""
import json
from pathlib import Path
import subprocess

ROOT = Path('/opt/logicx')
BENCH = Path('/home/frappe/frappe-bench')
VERSIONS = json.loads((ROOT / 'dev-versions.json').read_text())


def run(*args, cwd=None):
    subprocess.run(args, cwd=cwd, check=True)


for name in ('frappe', 'erpnext'):
    source = ROOT / 'sources' / name
    source.mkdir(parents=True)
    run('git', 'init', '--quiet', str(source))
    run('git', 'remote', 'add', 'origin', f'https://github.com/frappe/{name}.git', cwd=source)
    run('git', '-c', 'http.version=HTTP/1.1', 'fetch', '--depth=1', 'origin', VERSIONS[name], cwd=source)
    run('git', 'checkout', '-b', 'logicx-pinned', 'FETCH_HEAD', cwd=source)

apps = [{'url': (ROOT / 'sources/erpnext').as_uri(), 'branch': 'logicx-pinned'}]
(ROOT / 'sources/apps.json').write_text(json.dumps(apps))
run(
    'bench', 'init', str(BENCH),
    '--frappe-path', (ROOT / 'sources/frappe').as_uri(),
    '--frappe-branch', 'logicx-pinned',
    '--apps_path', str(ROOT / 'sources/apps.json'),
    '--skip-redis-config-generation', '--no-procfile', '--skip-assets',
)
run('bench', 'build', '--production', cwd=BENCH)
(BENCH / '.logicx-upstream.json').write_text(json.dumps(VERSIONS))
