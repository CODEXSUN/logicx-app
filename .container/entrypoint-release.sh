#!/bin/sh
set -eu
cd /home/frappe/frappe-bench
if [ "${2:-}" = /opt/logicx/release_init.py ]; then
  if [ -e sites/assets ] || [ -L sites/assets ]; then
    echo 'Existing site assets require installation review' >&2
    exit 1
  fi
  ln -s /home/frappe/frappe-bench/assets sites/assets
elif [ ! -L sites/assets ]; then
  echo 'Run the explicit site installer before starting the runtime' >&2
  exit 1
fi
exec "$@"
