"""Back up and migrate the existing local site; never fetch upstream source."""
import os
from pathlib import Path
import subprocess

BENCH = Path('/home/frappe/frappe-bench')
SITE = 'logicx.localhost'
os.chdir(BENCH / 'sites')

import frappe

frappe.init(site=SITE)
frappe.connect()
assert frappe.conf.db_type == 'postgres' and frappe.conf.db_name == 'logicx_dev'
assert 'logicx_app' in frappe.get_installed_apps()
module = frappe.db.get_value('DocType', 'Line Master', 'module')
if module and module != 'LogicX':
    raise RuntimeError('Line Master already belongs to another app; migration refused')
frappe.destroy()

subprocess.run(['bench', '--site', SITE, 'backup'], cwd=BENCH, check=True)
backups = sorted((BENCH / 'sites' / SITE / 'private/backups').glob('*database*'), key=lambda file: file.stat().st_mtime)
if not backups or backups[-1].stat().st_size == 0:
    raise RuntimeError('Database backup was not created; migration refused')
print('Pre-migration backup:', backups[-1].name, flush=True)
subprocess.run(['bench', '--site', SITE, 'migrate'], cwd=BENCH, check=True)
