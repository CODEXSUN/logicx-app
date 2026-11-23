"""Exercise permission-aware General Master CRUD in a rolled-back transaction."""
import json
import os
from uuid import uuid4

os.chdir('/home/frappe/frappe-bench/sites')
import frappe

frappe.init(site='logicx.localhost')
frappe.connect()
try:
    assert frappe.conf.db_name == 'logicx_dev'
    metadata = frappe.get_meta('General Master')
    assert metadata.get_field('type').label == 'Master Head'
    assert metadata.get_field('master_name').label == 'Value'
    frappe.set_user('admin@tenant.com')
    assert frappe.has_permission('General Master', ptype='create')
    reference = 'verification-' + uuid4().hex[:12]
    record = frappe.get_doc({
        'doctype': 'General Master', 'type': 'Process verification',
        'master_name': reference, 'description': 'Temporary rollback-only check',
        'active': 1, 'tag': reference,
    }).insert()
    assert record.name and record.name != reference
    assert frappe.get_list('General Master', filters={'name': record.name}, pluck='name') == [record.name]
    record.active = 0
    record.description = 'Updated verification'
    record.save()
    record.reload()
    assert record.active == 0 and record.description == 'Updated verification'
    invalid = frappe.get_doc({'doctype': 'General Master', 'type': ' ', 'master_name': ' '})
    try:
        invalid.insert()
    except frappe.MandatoryError:
        pass
    else:
        raise AssertionError('Blank required values were accepted')
    frappe.set_user('Guest')
    assert not frappe.has_permission('General Master', ptype='read')
    assert not frappe.has_permission('General Master', ptype='create')
    print(json.dumps({'doctype': 'General Master', 'create': True, 'read': True,
        'update': True, 'deactivate': True, 'requiredValidation': True,
        'guestDenied': True, 'testData': 'rolled back'}))
finally:
    frappe.db.rollback()
    frappe.destroy()
