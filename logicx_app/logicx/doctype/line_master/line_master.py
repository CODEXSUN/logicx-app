import frappe
from frappe import _
from frappe.model.document import Document


class LineMaster(Document):
    def validate(self):
        for field in ('factory', 'floor', 'area', 'line_no'):
            value = (self.get(field) or '').strip()
            self.set(field, value)
            if not value:
                frappe.throw(_('{0} is required.').format(self.meta.get_label(field)), frappe.MandatoryError)
