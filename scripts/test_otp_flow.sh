#!/bin/bash
# End-to-end OTP + MPIN reset test (local dev)
set -euo pipefail
API="http://127.0.0.1:8080/api/api.php"
COOKIE="$(mktemp)"
EMAIL="demo@gounlisted.com"
NEW_MPIN="5678"

cleanup() { rm -f "$COOKIE"; }
trap cleanup EXIT

echo "== 1. sendResetOtp =="
RESET_JSON=$(curl -s -c "$COOKIE" -X POST "${API}?action=sendResetOtp" \
  -H "Content-Type: application/json" \
  -d "{\"loginId\":\"${EMAIL}\"}")
echo "$RESET_JSON"
OTP=$(echo "$RESET_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dev_otp',''))")
if [ -z "$OTP" ]; then
  echo "FAIL: no dev_otp in response (is GU_DEV_MODE=1?)"
  exit 1
fi
echo "OTP: $OTP"

echo "== 2. verifyOtp =="
VERIFY_JSON=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST "${API}?action=verifyOtp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"otp\":\"${OTP}\"}")
echo "$VERIFY_JSON"
echo "$VERIFY_JSON" | grep -q '"success":true' || { echo "FAIL verifyOtp"; exit 1; }

echo "== 3. resetMpin =="
RESET_MPIN_JSON=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST "${API}?action=resetMpin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"mpin\":\"${NEW_MPIN}\"}")
echo "$RESET_MPIN_JSON"
echo "$RESET_MPIN_JSON" | grep -q '"success":true' || { echo "FAIL resetMpin"; exit 1; }

echo "== 4. loginUser with new MPIN =="
LOGIN_JSON=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST "${API}?action=loginUser" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${NEW_MPIN}\"}")
echo "$LOGIN_JSON"
echo "$LOGIN_JSON" | grep -q '"success":true' || { echo "FAIL loginUser"; exit 1; }

echo "== 5. admin email should NOT get OTP (investor only) =="
ADMIN_JSON=$(curl -s -X POST "${API}?action=sendResetOtp" \
  -H "Content-Type: application/json" \
  -d '{"loginId":"jgond1992@gmail.com"}')
echo "$ADMIN_JSON"
echo "$ADMIN_JSON" | grep -q 'admin login' || { echo "FAIL admin hint"; exit 1; }

echo ""
echo "ALL OTP / MPIN RESET TESTS PASSED"
