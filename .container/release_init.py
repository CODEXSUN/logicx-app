"""Initialize one fresh site using an already provisioned, database-scoped account.

Only the explicit one-shot installer executes this module. Runtime containers
never receive installation secrets, root database access, or run migrations.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import quote

BENCH = Path('/home/frappe/frappe-bench')


def configuration(values: dict) -> dict:
    required = ('site', 'database', 'db_user', 'db_password', 'admin_password', 'admin_email', 'redis_password')
    if any(not isinstance(values.get(key), str) or not values[key] for key in required):
        raise ValueError('Incomplete private site configuration')
    if values['site'] != 'logicx.localhost' or values['database'] != 'logicx_app' or values['db_user'] != 'logicx_app':
        raise ValueError('Unexpected LogicX installation identity')
    password = quote(values['redis_password'], safe='')
    return {
        'db_host': 'mariadb', 'db_port': 3307,
        'redis_cache': f'redis://:{password}@redis-cache:6379/0',
        'redis_queue': f'redis://:{password}@redis-queue:6379/0',
        'redis_socketio': f'redis://:{password}@redis-queue:6379/0',
        'socketio_port': 9000, 'serve_default_site': True,
        'default_site': values['site'], 'developer_mode': 0,
    }


def main() -> None:
    values = json.loads(Path('/run/secrets/logicx-install.json').read_text())
    config = configuration(values)
    site = values['site']
    os.chdir(BENCH / 'sites')
    if Path(site).exists():
        raise RuntimeError('Site already exists; preserve it and review the retained installation state')
    os.umask(0o077)
    Path('common_site_config.json').write_text(json.dumps(config, indent=2))
    Path('common_site_config.json').chmod(0o600)
    Path('apps.txt').write_text('frappe\nerpnext\nlogicx_app\n')
    Path('currentsite.txt').write_text(site + '\n')
    import frappe
    from frappe.installer import _new_site
    frappe.init(site, new_site=True)
    # The host has already created the empty database and database-scoped user.
    # setup_db=False prevents CREATE USER/GRANT/server-wide operations in the app.
    _new_site(
        db_name=values['database'], site=site, db_type='mariadb',
        db_user=values['db_user'], db_password=values['db_password'],
        admin_password=values['admin_password'], db_host='mariadb', db_port=3307,
        setup_db=False, install_apps=['erpnext', 'logicx_app'],
    )
    Path(site, 'site_config.json').chmod(0o600)
    frappe.init(site=site)
    frappe.connect()
    # Frappe authenticates by User.name; changing Administrator.email alone
    # does not enable email login. Provision the explicitly requested manager.
    from frappe.utils.password import update_password
    user = frappe.get_doc({
        'doctype': 'User', 'email': values['admin_email'],
        'first_name': 'LogicX Administrator', 'enabled': 1,
        'user_type': 'System User', 'send_welcome_email': 0,
        # LogicX Product is System Manager-owned; ERPNext Item creation/read
        # additionally requires Item Manager in the pinned ERPNext release.
        'roles': [{'role': 'System Manager'}, {'role': 'Item Manager'}],
    }).insert(ignore_permissions=True)
    update_password(user.name, values['admin_password'])
    frappe.db.set_single_value('System Settings', 'enable_scheduler', 1)
    frappe.db.commit()
    apps = frappe.get_installed_apps()
    if not {'frappe', 'erpnext', 'logicx_app'}.issubset(apps):
        raise RuntimeError('Required installed applications are missing')
    frappe.destroy()
    print('LogicX fresh site installation verified', flush=True)


if __name__ == '__main__':
    main()
