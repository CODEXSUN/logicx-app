"""Read-only checks in the manually installed development container."""
import json
import os

os.chdir('/home/frappe/frappe-bench/sites')
import frappe
import erpnext
import logicx_app
from frappe.utils.background_jobs import get_workers
from frappe.utils.scheduler import is_scheduler_process_running

frappe.init(site='logicx.localhost')
frappe.connect()
assert frappe.conf.db_type == 'postgres'
assert frappe.conf.db_name == 'logicx_dev'
assert frappe.conf.developer_mode
database, database_user, server_version = frappe.db.sql(
    'SELECT current_database(), current_user, version()'
)[0]
assert database == 'logicx_dev' and database_user == 'logicx_dev'
assert server_version.startswith('PostgreSQL ')
apps = frappe.get_installed_apps()
assert {'frappe', 'erpnext', 'logicx_app'}.issubset(apps)
frappe.set_user('admin@tenant.com')
assert frappe.has_permission('LogicX Product', ptype='create')
assert frappe.has_permission('Item', ptype='create')
workers = len(get_workers())
assert workers >= 2
assert is_scheduler_process_running()
assert frappe.db.get_single_value('System Settings', 'enable_scheduler')
print(json.dumps({
    'database': 'postgres', 'apps': apps, 'workers': workers,
    'frappe': frappe.__version__, 'erpnext': erpnext.__version__,
    'logicx': logicx_app.__version__, 'developerMode': True,
    'postgresVersion': server_version.split()[1], 'scheduler': True,
}))
frappe.destroy()
