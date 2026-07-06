#!/usr/bin/env bash
# Test SMTP delivery for OTP emails
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_load_env.sh"
API="http://127.0.0.1:8080/api/api.php"
COOKIE="/tmp/gu_smtp_test.txt"
TO="${1:-}"

if [ -z "$TO" ]; then
  echo "Usage: bash scripts/test_smtp.sh your@email.com"
  echo "Requires GU_SMTP_* in .env.local or api/mail_config.php"
  exit 1
fi

if [ -z "${GU_ADMIN_EMAIL:-}" ] || [ -z "${GU_ADMIN_PASSWORD:-}" ]; then
  echo "Set GU_ADMIN_EMAIL and GU_ADMIN_PASSWORD in .env.local"
  exit 1
fi

rm -f "$COOKIE"
TOKEN=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getCsrfToken" | php -r 'echo json_decode(file_get_contents("php://stdin"))->csrfToken;')
curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=loginAdmin" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"email\":\"${GU_ADMIN_EMAIL}\",\"password\":\"${GU_ADMIN_PASSWORD}\"}" >/dev/null

TOKEN=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getCsrfToken" | php -r 'echo json_decode(file_get_contents("php://stdin"))->csrfToken;')
echo "== Mail status =="
curl -s -b "$COOKIE" "$API?action=getMailStatus" | python3 -m json.tool

echo ""
echo "== Test email to $TO =="
RES=$(curl -s -b "$COOKIE" -X POST "$API?action=testSmtp" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"email\":\"$TO\"}")
echo "$RES" | python3 -m json.tool
echo "$RES" | grep -q '"success":true' && echo "OK — check inbox for test email" || exit 1
