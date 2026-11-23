"""Read-only checks inside the selected LogicX backend image."""
import json
import os
os.chdir('/home/frappe/frappe-bench/sites')
import frappe
import erpnext
import logicx_app
from frappe.utils.background_jobs import get_workers

assert os.environ.get('LOGICX_MANAGED_RELEASE') == '1'
frappe.init(site='logicx.localhost')
frappe.connect()
assert frappe.conf.db_name == 'logicx_app'
assert frappe.conf.db_user == 'logicx_app'
assert not frappe.conf.developer_mode
apps = frappe.get_installed_apps()
assert {'frappe', 'erpnext', 'logicx_app'}.issubset(apps)
assert frappe.db.exists('DocType', 'LogicX Product')
assert frappe.db.exists('User', 'admin@tenant.com')
assert 'System Manager' in frappe.get_roles('admin@tenant.com')
frappe.set_user('admin@tenant.com')
assert frappe.has_permission('LogicX Product', ptype='create')
assert frappe.has_permission('Item', ptype='create')
workers = get_workers()
assert len(workers) >= 2, 'Both isolated queue workers must register'
print(json.dumps({'apps': apps, 'frappe': frappe.__version__, 'erpnext': erpnext.__version__, 'logicx': logicx_app.__version__, 'workers': len(workers)}))
frappe.destroy()
