import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint


class GeneralMaster(Document):
    def validate(self):
        self.type = (self.type or '').strip()
        self.master_name = (self.master_name or '').strip()
        self.description = (self.description or '').strip()
        self.tag = (self.tag or '').strip()
        self.active = cint(self.active)

        if not self.type or not self.master_name:
            frappe.throw(_('Master Head and Value are required.'), frappe.MandatoryError)
        if self.active not in (0, 1):
            frappe.throw(_('Active must be enabled or disabled.'), frappe.ValidationError)
