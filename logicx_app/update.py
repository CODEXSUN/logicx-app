from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint
from frappe.utils.synchronization import filelock

ACTIVE_PHASES = {"queued", "pulling", "installing_dependencies", "migrating", "building", "clearing_cache"}
COMMAND_TIMEOUTS = {
	"pulling": 180,
	"installing_dependencies": 600,
	"migrating": 900,
	"building": 1200,
	"clearing_cache": 180,
}


@frappe.whitelist(methods=["GET"])
def get_update_status(refresh: int = 1) -> dict[str, Any]:
	_require_administrator()
	state = _read_state()
	if state.get("phase") in ACTIVE_PHASES:
		return state
	if not cint(refresh):
		return state

	repository = _inspect_repository(fetch=True)
	return {
		**state,
		**repository,
		"phase": state.get("phase", "idle"),
		"message": state["message"] if state.get("phase") in {"failed", "complete"} else repository["message"],
		"repository_message": repository["message"],
	}


@frappe.whitelist(methods=["POST"])
def start_update() -> dict[str, Any]:
	_require_administrator()
	return _start_operation(pull=True)


@frappe.whitelist(methods=["POST"])
def start_maintenance() -> dict[str, Any]:
	_require_administrator()
	return _start_operation(pull=False)


def _start_operation(*, pull: bool) -> dict[str, Any]:
	with filelock("logicx-update", timeout=10):
		current = _read_state()
		if current.get("phase") in ACTIVE_PHASES:
			return current

		repository = {}
		if pull:
			repository = _inspect_repository(fetch=True)
			if repository["dirty"]:
				frappe.throw(_("Commit or discard local app changes before you run a live update."))
			if not repository["update_available"]:
				return {**repository, "phase": "idle"}

		site = frappe.local.site
		state = {
			**repository,
			"phase": "queued",
			"message": _("Update queued.") if pull else _("Migration and build queued."),
			"requested_by": frappe.session.user,
		}
		_write_state(state)
		try:
			frappe.enqueue(
				"logicx_app.update.run_update",
				queue="long",
				timeout=3300,
				job_id=f"logicx-update:{site}",
				deduplicate=True,
				site=site,
				pull=pull,
			)
		except Exception as error:
			_write_state({"phase": "failed", "message": _safe_error(error)})
			raise
		return state


def run_update(site: str, pull: bool = True) -> None:
	repository = _repository_root()
	commands = [
		("installing_dependencies", ["npm", "--prefix", "frontend", "ci"], repository),
		("migrating", ["bench", "--site", site, "migrate"], _bench_root()),
		("building", ["bench", "build", "--app", "logicx_app"], _bench_root()),
		("clearing_cache", ["bench", "--site", site, "clear-cache"], _bench_root()),
	]

	if pull:
		commands.insert(0, ("pulling", _git_command("pull", "--ff-only"), repository))

	try:
		with filelock("logicx-bench-maintenance", is_global=True):
			for phase, command, cwd in commands:
				_write_state({"phase": phase, "message": _phase_message(phase)})
				_run(command, cwd, COMMAND_TIMEOUTS[phase])
			_write_state(
				{
					"phase": "complete",
					"message": _("Update complete.") if pull else _("Migration and build complete."),
					**({"update_available": False} if pull else {}),
					"version": _read_version(),
				}
			)
	except Exception as error:
		frappe.logger("logicx_app.update").exception("LogicX live update failed")
		_write_state({"phase": "failed", "message": _safe_error(error)})
		raise


def _require_administrator() -> None:
	if frappe.session.user != "Administrator":
		frappe.throw(_("Only Administrator can update LogicX."), frappe.PermissionError)
	if os.getenv("LOGICX_MANAGED_RELEASE") == "1":
		frappe.throw(_("This installation is maintained through CodeShip tagged releases."))


def _inspect_repository(fetch: bool) -> dict[str, Any]:
	root = _repository_root()
	branch = _git(root, "branch", "--show-current")
	upstream = _git(root, "for-each-ref", "--format=%(upstream:short)", f"refs/heads/{branch}") if branch else ""
	dirty_lines = _git(root, "status", "--porcelain").splitlines()
	ahead = behind = 0
	if upstream:
		if fetch:
			_git(root, "fetch", "--quiet", timeout=90)
		behind = int(_git(root, "rev-list", "--count", f"HEAD..{upstream}") or 0)
		ahead = int(_git(root, "rev-list", "--count", f"{upstream}..HEAD") or 0)

	message = _("LogicX is current.")
	if not upstream:
		message = _("Configure a tracked Git branch to enable updates.")
	elif ahead and behind:
		message = _("The local branch and its upstream have diverged.")
	elif behind:
		message = _("An update is available.")

	return {
		"ahead": ahead,
		"behind": behind,
		"branch": branch,
		"dirty": bool(dirty_lines),
		"dirty_files": len(dirty_lines),
		"message": message,
		"update_available": behind > 0 and ahead == 0,
		"version": _read_version(),
	}


def _git(root: Path, *args: str, timeout: int = 30) -> str:
	return _run(_git_command(*args), root, timeout)


def _git_command(*args: str) -> list[str]:
	root = _repository_root()
	return ["git", "-c", f"safe.directory={root}", *args]


def _run(command: list[str], cwd: Path, timeout: int) -> str:
	result = subprocess.run(
		command,
		cwd=cwd,
		check=False,
		capture_output=True,
		encoding="utf8",
		env={**os.environ, "CI": "1"},
		errors="replace",
		timeout=timeout,
	)
	if result.returncode:
		detail = (result.stderr or result.stdout or "Command failed.").strip().splitlines()[-1]
		raise RuntimeError(f"{command[0]} failed: {detail}")
	return result.stdout.strip()


def _repository_root() -> Path:
	return Path(frappe.get_app_path("logicx_app")).resolve().parent


def _bench_root() -> Path:
	return Path(frappe.get_app_path("frappe")).resolve().parents[2]


def _state_file() -> Path:
	return Path(frappe.get_site_path("private", "logicx_update.json"))


def _read_state() -> dict[str, Any]:
	file = _state_file()
	if not file.exists():
		return {"phase": "idle", "message": _("Checking for updates.")}
	try:
		return json.loads(file.read_text(encoding="utf8"))
	except (OSError, ValueError):
		return {"phase": "idle", "message": _("Checking for updates.")}


def _write_state(state: dict[str, Any]) -> None:
	file = _state_file()
	file.parent.mkdir(parents=True, exist_ok=True)
	current = _read_state()
	payload = {**current, **state, "updated_at": datetime.now().astimezone().isoformat()}
	temporary = file.with_suffix(".tmp")
	temporary.write_text(json.dumps(payload, indent=2), encoding="utf8")
	temporary.replace(file)


def _read_version() -> str:
	file = Path(frappe.get_app_path("logicx_app", "__init__.py"))
	match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', file.read_text(encoding="utf8"), re.MULTILINE)
	return match.group(1) if match else "unknown"


def _phase_message(phase: str) -> str:
	return {
		"pulling": _("Pulling the latest source."),
		"installing_dependencies": _("Installing locked frontend dependencies."),
		"migrating": _("Running site migrations."),
		"building": _("Building LogicX assets."),
		"clearing_cache": _("Clearing the site cache."),
	}[phase]


def _safe_error(error: Exception) -> str:
	message = str(error).strip() or _("Update failed.")
	return message[-500:]
