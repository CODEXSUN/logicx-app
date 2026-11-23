import frappe
from frappe.utils import install as frappe_install

APP_NAME = "logicx_app"
APP_LOGO_URL = "/assets/logicx_app/images/logicx-logo.svg?v=3"


def after_install():
	# Frappe v16.60 replaced the earlier sidebar/icon bootstrap helper.
	generate = getattr(frappe_install, "create_desktop_icons_for_app", None)
	if generate is None:
		generate = frappe_install.auto_generate_icons_and_sidebar
	generate(APP_NAME)
	update_desktop_icon_logo()


def update_desktop_icon_logo():
	icon_name = frappe.db.get_value(
		"Desktop Icon",
		{"app": APP_NAME, "icon_type": "App"},
	)
	if icon_name:
		frappe.db.set_value(
			"Desktop Icon",
			icon_name,
			"logo_url",
			APP_LOGO_URL,
			update_modified=False,
		)
