#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" == "0" ]]; then
	mkdir -p /home/devops/persistent /home/devops/.cache/uv \
		/workspace/logicx-app/node_modules /workspace/logicx-app/frontend/node_modules
	chown -R devops:devops /home/devops/persistent /home/devops/.cache \
		/workspace/logicx-app/node_modules /workspace/logicx-app/frontend/node_modules
	export HOME=/home/devops XDG_CACHE_HOME=/home/devops/.cache
	exec runuser -u devops --preserve-environment -- "$0" "$@"
fi

init-frappe
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
