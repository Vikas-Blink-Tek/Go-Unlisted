#!/bin/bash
# Start local dev — .env.local controls API target and optional live DB
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
USE_LIVE_API=false
if [[ "$API_TARGET" == https://* ]]; then
  USE_LIVE_API=true
fi

echo "=============================================="
echo "Go-Unlisted local dev"
echo "  Web:  http://localhost:5173"
echo "  API:  $API_TARGET"
if [ "$USE_LIVE_API" = true ]; then
  echo "  Data: LIVE production (go-unlisted.com)"
else
  if [ -n "${GU_DB_HOST:-}" ]; then
    echo "  DB:   ${GU_DB_NAME} @ ${GU_DB_HOST}"
  else
    echo "  DB:   local MySQL (gounlisted)"
  fi
fi
echo "=============================================="

PHP_PID=""
if [ "$USE_LIVE_API" = false ]; then
  GU_DEV_MODE=1 php -S 127.0.0.1:8080 -t . &
  PHP_PID=$!
  trap 'kill $PHP_PID 2>/dev/null' EXIT
fi

cd client
npm run dev -- --host 127.0.0.1
