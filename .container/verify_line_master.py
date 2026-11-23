"""Exercise permission-aware Line Master CRUD in a rolled-back transaction."""
import json
import os
from uuid import uuid4

os.chdir('/home/frappe/frappe-bench/sites')
import frappe

frappe.init(site='logicx.localhost')
frappe.connect()
try:
    assert frappe.conf.db_name == 'logicx_dev'
    frappe.set_user('admin@tenant.com')
    assert frappe.has_permission('Line Master', ptype='create')
    record = frappe.get_doc({'doctype': 'Line Master', 'factory': ' Verification ',
        'floor': '1', 'area': 'Sewing', 'line_no': '01'}).insert()
    serial = record.name
    assert serial.startswith('LM-') and serial[3:].isdigit()
    assert record.factory == 'Verification'
    second = frappe.get_doc({'doctype': 'Line Master', 'factory': 'Verification',
        'floor': '1', 'area': 'Sewing', 'line_no': '02'}).insert()
    assert int(second.name[3:]) == int(serial[3:]) + 1
    assert frappe.get_list('Line Master', filters={'name': serial}, pluck='name') == [serial]
    record.area = 'Cutting'
    record.save()
    record.reload()
    assert record.area == 'Cutting' and record.name == serial
    for field in ('factory', 'floor', 'area', 'line_no'):
        values = {'doctype': 'Line Master', 'factory': 'Test', 'floor': '1', 'area': 'Test', 'line_no': '1'}
        values[field] = ' '
        try:
            frappe.get_doc(values).insert()
        except frappe.MandatoryError:
            pass
        else:
            raise AssertionError('Blank ' + field + ' was accepted')
    frappe.set_user('Guest')
    assert not frappe.has_permission('Line Master', ptype='read')
    assert not frappe.has_permission('Line Master', ptype='create')
    print(json.dumps({'doctype': 'Line Master', 'create': True, 'read': True,
        'update': True, 'automaticSequentialSerial': True, 'requiredValidation': True,
        'guestDenied': True, 'testData': 'rolled back'}))
finally:
    frappe.db.rollback()
    frappe.destroy()
