#!/usr/bin/env bash
set -euo pipefail
cd /home/frappe/frappe-bench

if [[ "$(id -u)" == 0 ]]; then
    chown frappe:0 /workspace/logicx-app/frontend/node_modules
    exec runuser -u frappe --preserve-environment -- /bin/bash "$0" "$@"
fi

case "${1:-start}" in
    init|assets) exec env/bin/python /opt/logicx/init_frappe.py "$1" ;;
    start)
        test -f .logicx-ready.json || { echo 'Run the manual setup command first' >&2; exit 1; }
        exec bench start
        ;;
    verify) exec env/bin/python /opt/logicx/dev_verify.py ;;
    *) echo 'Allowed commands: init, start, assets, verify' >&2; exit 1 ;;
esac
