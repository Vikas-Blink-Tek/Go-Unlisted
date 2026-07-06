#!/bin/bash
# Start local dev with optional live API + live DB from .env.local
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

API_TARGET="${GU_API_TARGET:-http://127.0.0.1:8080}"
echo "API proxy target: $API_TARGET"
if [ -n "$GU_DB_HOST" ]; then
  echo "PHP database: $GU_DB_NAME @ $GU_DB_HOST"
else
  echo "PHP database: local MySQL (gounlisted)"
fi

GU_DEV_MODE=1 php -S 127.0.0.1:8080 -t . &
PHP_PID=$!
trap 'kill $PHP_PID 2>/dev/null' EXIT

cd client
npm run dev
