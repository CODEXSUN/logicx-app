#!/usr/bin/env python3
"""Explicit local development setup; shared PostgreSQL and Redis only.

No infrastructure credentials, server provisioning, migration on restart,
database deletion, Redis server startup or global cache flush occurs here.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import site as python_site
import subprocess
import sys
from urllib.parse import quote

BENCH = Path('/home/frappe/frappe-bench')
APP = Path('/workspace/logicx-app')


def run(*args, cwd=BENCH):
    print('+ ' + ' '.join(str(arg) for arg in args), flush=True)
    subprocess.run([str(arg) for arg in args], cwd=cwd, check=True)


def common_config(values):
    if values['database'] != 'logicx_dev' or values['db_user'] != 'logicx_dev':
        raise ValueError('Unexpected development database identity')
    if values['redis_cache_db'] != 10 or values['redis_queue_db'] != 11:
        raise ValueError('Only the reserved development Redis DBs are allowed')
    user = quote(values['redis_user'], safe='')
    password = quote(values['redis_password'], safe='')
    redis = f'redis://{user}:{password}@redis:6379'
    return {
        'db_type': 'postgres', 'db_host': 'postgres', 'db_port': 5432,
        'redis_cache': redis + '/10', 'redis_queue': redis + '/11',
        'redis_socketio': redis + '/11', 'developer_mode': 1,
        'serve_default_site': True, 'default_site': values['site'],
        'webserver_port': 4445, 'socketio_port': 4446,
        'host_name': 'http://logicx.localhost:4445',
    }


def build_assets():
    run('npm', 'ci', '--ignore-scripts', '--no-audit', cwd=APP / 'frontend')
    run('npm', 'run', 'build', cwd=APP / 'frontend')
    assets = BENCH / 'sites/assets/logicx_app'
    if not assets.exists() and not assets.is_symlink():
        assets.symlink_to(APP / 'logicx_app/public', target_is_directory=True)


def main():
    if sys.argv[1:] == ['assets']:
        build_assets()
        return
    if sys.argv[1:] != ['init']:
        raise ValueError('Run the explicit init or assets command')

    values = json.loads(Path('/run/logicx/config.json').read_text())
    config = common_config(values)
    expected = json.loads(Path('/opt/logicx/dev-versions.json').read_text())
    if json.loads((BENCH / '.logicx-upstream.json').read_text()) != expected:
        raise RuntimeError('Bench volume uses other revisions; use the guarded clean reinstall')
    site = values['site']
    if (BENCH / 'sites' / site).exists():
        raise RuntimeError('Existing or partial site: use the guarded clean reinstall')

    target = BENCH / 'apps/logicx_app'
    if target.exists() or target.is_symlink():
        raise RuntimeError('Unexpected pre-existing LogicX app link')
    target.symlink_to(APP, target_is_directory=True)
    run(BENCH / 'env/bin/python', '-m', 'pip', 'install', '--no-deps', '-e', APP)
    # This interpreter started before pip wrote the editable package's .pth file.
    for package_directory in python_site.getsitepackages():
        python_site.addsitedir(package_directory)

    os.chdir(BENCH / 'sites')
    os.umask(0o077)
    Path('apps.txt').write_text('frappe\nerpnext\nlogicx_app\n')
    Path('common_site_config.json').write_text(json.dumps(config, indent=2))
    Path('common_site_config.json').chmod(0o600)
    Path('currentsite.txt').write_text(site + '\n')

    import frappe
    from frappe.installer import _new_site
    frappe.init(site, new_site=True)
    _new_site(
        db_name=values['database'], site=site, db_type='postgres',
        db_user=values['db_user'], db_password=values['db_password'],
        db_host='postgres', db_port=5432, setup_db=False,
        admin_password=values['admin_password'], install_apps=['erpnext', 'logicx_app'],
    )
    frappe.init(site)
    frappe.connect()
    from frappe.utils.password import update_password
    user = frappe.get_doc({
        'doctype': 'User', 'email': values['admin_email'],
        'first_name': 'LogicX Developer', 'user_type': 'System User',
        'send_welcome_email': 0,
        'roles': [{'role': 'System Manager'}, {'role': 'Item Manager'}],
    }).insert(ignore_permissions=True)
    update_password(user.name, values['admin_password'])
    frappe.db.set_single_value('System Settings', 'enable_scheduler', 1)
    frappe.db.commit()
    frappe.destroy()

    build_assets()
    (BENCH / 'Procfile').write_text(
        'web: bench --site logicx.localhost serve --host 0.0.0.0 --port 4445\n'
        'socketio: bench socketio\n'
        'schedule: bench schedule\n'
        'worker_short: bench worker --queue short,default\n'
        'worker_long: bench worker --queue long\n'
    )
    (BENCH / '.logicx-ready.json').write_text(json.dumps({
        'installation': values['installation'], 'site': site, 'versions': expected,
    }))
    print('Manual PostgreSQL development installation completed', flush=True)


if __name__ == '__main__':
    main()
