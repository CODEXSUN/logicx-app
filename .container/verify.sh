#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec node .container/dev.mjs verify "$@"
