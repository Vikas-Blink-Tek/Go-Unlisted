#!/usr/bin/env bash
# Manual feature verification for GO UNLISTED
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="http://127.0.0.1:8080/api/api.php"
PROXY="http://127.0.0.1:5173/api/api.php"
for p in 5173 5174 5175; do
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$p/" 2>/dev/null | grep -q 200; then
    PROXY="http://127.0.0.1:$p/api/api.php"
    VITE_PORT="$p"
    break
  fi
done
COOKIE="/tmp/gu_test_cookies.txt"
PASS=0
FAIL=0
SKIP=0

rm -f "$COOKIE"

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ~ $1 (skipped)"; SKIP=$((SKIP+1)); }

check_http() {
  local url="$1" expect="$2" label="$3"
  local code body
  code=$(curl -s -o /tmp/gu_test_body.txt -w "%{http_code}" "$url")
  body=$(cat /tmp/gu_test_body.txt)
  if [[ "$code" == "$expect" ]] && echo "$body" | grep -qv "Fatal error"; then
    ok "$label (HTTP $code)"
    echo "$body"
    return 0
  else
    bad "$label (HTTP $code) — $(echo "$body" | head -c 120)"
    echo "$body"
    return 1
  fi
}

csrf() {
  curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=checkAuth" \
    -H "Content-Type: application/json" -d '{}' \
    | php -r 'echo json_decode(file_get_contents("php://stdin"))->csrfToken ?? "";'
}

echo "=============================================="
echo "GO UNLISTED — Manual Feature Test"
echo "=============================================="
echo ""

# --- Server health ---
echo "[1] Server health"
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8080/" | grep -q 200; then
  ok "PHP server on :8080"
else
  bad "PHP server on :8080 not responding"
fi
VITE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${VITE_PORT:-5173}/" 2>/dev/null || echo "000")
if [[ "$VITE_CODE" == "200" ]]; then
  ok "Vite dev server on :${VITE_PORT:-5173}"
else
  bad "Vite dev server not responding (HTTP $VITE_CODE)"
fi
echo ""

# --- Public API ---
echo "[2] Public site APIs"
check_http "$API?action=getSettings" 200 "getSettings" >/dev/null || true
SETTINGS=$(curl -s "$API?action=getSettings")
echo "$SETTINGS" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit(isset($d->bank_upi)&&isset($d->disclaimer)?0:1);' \
  && ok "Settings include bank_upi + disclaimer" || bad "Settings missing bank/UPI fields"

SHARES=$(curl -s "$API?action=getShares")
echo "$SHARES" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit(is_array($d)&&count($d)>=1?0:1);' \
  && ok "getShares returns listings ($(echo "$SHARES" | php -r 'echo count(json_decode(file_get_contents("php://stdin")));') stocks)" \
  || bad "getShares failed"

echo "$SHARES" | php -r '$d=json_decode(file_get_contents("php://stdin")); $s=$d[0]??null; exit($s&&property_exists($s,"listingType")&&property_exists($s,"description")?0:1);' \
  && ok "Share objects include listingType + description fields" || bad "Share schema incomplete"

PROXY_SETTINGS=$(curl -s "$PROXY?action=getSettings" 2>/dev/null || echo '{}')
echo "$PROXY_SETTINGS" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->bank_name??0?0:1);' \
  && ok "Vite proxy /api → PHP works" || bad "Vite proxy broken"
echo ""

# --- Admin auth (request failed fix) ---
echo "[3] Admin login (audit_log fix)"
ADMIN_EMAIL="${GU_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${GU_ADMIN_PASSWORD:-}"
if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  skip "Admin login (export GU_ADMIN_EMAIL and GU_ADMIN_PASSWORD)"
else
  TOKEN=$(csrf)
  LOGIN=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=loginAdmin" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  echo "$LOGIN" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "Admin login succeeds" || bad "Admin login failed: $LOGIN"

  AUTH=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=checkAuth" \
    -H "Content-Type: application/json" -d '{}')
  echo "$AUTH" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit($d->authenticated&&$d->type==="admin"?0:1);' \
    && ok "Admin session persists" || bad "Admin session check failed"
fi
echo ""

# --- Admin APIs ---
echo "[4] Admin panel APIs"
TOKEN=$(csrf)
ORDERS=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getOrders")
echo "$ORDERS" | php -r 'exit(is_array(json_decode(file_get_contents("php://stdin")))?0:1);' \
  && ok "getOrders (admin)" || bad "getOrders failed"

USERS=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getUsers")
echo "$USERS" | php -r 'exit(is_array(json_decode(file_get_contents("php://stdin")))?0:1);' \
  && ok "getUsers (admin)" || bad "getUsers failed"

INIT=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getInitiatedCheckouts")
echo "$INIT" | php -r 'exit(is_array(json_decode(file_get_contents("php://stdin")))?0:1);' \
  && ok "getInitiatedCheckouts (admin)" || bad "getInitiatedCheckouts failed"

ADMIN_SHARES=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getShares")
echo "$ADMIN_SHARES" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit(is_array($d)?0:1);' \
  && ok "getShares (admin session)" || bad "getShares admin failed"
echo ""

# --- Stock management ---
echo "[5] Stock add/edit (catalog)"
TOKEN=$(csrf)
SAVE=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=saveShare" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{
    "name":"Test Unlisted Co",
    "ticker":"TUC",
    "sector":"Fintech",
    "basePrice":100,
    "minQty":5,
    "logoInitials":"TU",
    "listingType":"Pre-IPO",
    "description":"Test Unlisted Co is a fintech platform used for automated QA verification of the GO UNLISTED catalog and checkout flows.",
    "ipoTimeline":"Expected 2027",
    "keyHighlights":["QA test listing","Auto cleanup"],
    "riskNotes":"Test stock only.",
    "inventoryStatus":"In Stock"
  }')
TEST_ID=$(echo "$SAVE" | php -r 'echo json_decode(file_get_contents("php://stdin"))->shareId??"";')
if [[ -n "$TEST_ID" ]]; then
  ok "saveShare (add stock) → $TEST_ID"
  TOKEN=$(csrf)
  UPD=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=saveShareConfig" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
    -d "{\"shareId\":\"$TEST_ID\",\"basePrice\":110}")
  echo "$UPD" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "saveShareConfig (price update)" || bad "saveShareConfig failed"
  TOKEN=$(csrf)
  DEL=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=deleteShare" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
    -d "{\"shareId\":\"$TEST_ID\"}")
  echo "$DEL" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "deleteShare (cleanup)" || bad "deleteShare failed"
else
  bad "saveShare failed: $SAVE"
fi
echo ""

# --- Guest checkout flow ---
echo "[6] Checkout flow (guest, no Razorpay)"
TOKEN=$(csrf)
SESSION="test-$(date +%s)"
INIT_CHK=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=saveInitiatedCheckout" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{
    "sessionId":"'"$SESSION"'",
    "shareId":"zepto",
    "shareName":"Zepto",
    "shareTicker":"ZEPTO",
    "qty":15,
    "pricePerShare":620,
    "totalAmount":9300,
    "paymentMode":"NEFT"
  }')
echo "$INIT_CHK" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "saveInitiatedCheckout (abandoned tracking)" || bad "saveInitiatedCheckout failed: $INIT_CHK"

TOKEN=$(csrf)
ORDER_ID="GU$(date +%s | tail -c 9)T"
ORDER=$(curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{
    "orderId":"'"$ORDER_ID"'",
    "userId":"guest",
    "buyerName":"Test Buyer",
    "buyerEmail":"test@example.com",
    "buyerPhone":"9876543210",
    "shareId":"zepto",
    "shareName":"Zepto",
    "shareTicker":"ZEPTO",
    "pricePerShare":620,
    "qty":15,
    "method":"NEFT",
    "transactionId":"UTRTEST123",
    "status":"Pending Verification"
  }')
echo "$ORDER" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "saveOrder guest checkout → $ORDER_ID" || bad "saveOrder failed: $ORDER"

# Verify order appears in admin
ORDERS2=$(curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getOrders")
echo "$ORDERS2" | php -r '$d=json_decode(file_get_contents("php://stdin")); foreach($d as $o){if(($o->orderId??"")==="'$ORDER_ID'")exit(0);} exit(1);' \
  && ok "Order visible in admin getOrders" || bad "Order not in admin queue"
echo ""

# --- CSRF protection ---
echo "[7] Security checks"
NO_CSRF=$(curl -s -o /tmp/gu_test_body.txt -w "%{http_code}" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -d '{"orderId":"x"}')
[[ "$NO_CSRF" == "403" ]] && ok "POST without CSRF returns 403" || bad "CSRF not enforced (HTTP $NO_CSRF)"

NO_AUTH_ORDERS=$(curl -s -o /tmp/gu_test_body.txt -w "%{http_code}" "$API?action=getOrders")
[[ "$NO_AUTH_ORDERS" == "401" ]] && ok "getOrders without admin session returns 401" || bad "Admin auth not enforced (HTTP $NO_AUTH_ORDERS)"
echo ""

# --- Frontend routes (HTML) ---
echo "[8] Frontend routes (Vite)"
for route in "/" "/shares" "/shares/zepto" "/checkout/zepto" "/admin/login" "/admin"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${VITE_PORT:-5173}$route" 2>/dev/null || echo "000")
  [[ "$CODE" == "200" ]] && ok "GET $route" || bad "GET $route (HTTP $CODE)"
done
echo ""

# --- React build ---
echo "[9] Production build"
if (cd "$ROOT/client" && npm run build >/tmp/gu_build.log 2>&1); then
  ok "npm run build succeeds"
else
  bad "npm run build failed — see /tmp/gu_build.log"
fi
echo ""

# --- User auth (login & register) ---
echo "[10] User login & register"
TEST_USER_EMAIL="${GU_TEST_USER_EMAIL:-}"
TEST_USER_PASSWORD="${GU_TEST_USER_PASSWORD:-}"
if [[ -n "$TEST_USER_EMAIL" && -n "$TEST_USER_PASSWORD" ]]; then
  LOGIN=$(curl -s -c /tmp/gu_user.txt -b /tmp/gu_user.txt -X POST "$API?action=loginUser" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")
  echo "$LOGIN" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "loginUser" || bad "loginUser failed: $LOGIN"
else
  skip "loginUser (export GU_TEST_USER_EMAIL and GU_TEST_USER_PASSWORD)"
fi

REG_EMAIL="testuser$(date +%s)@example.com"
OTP_RES=$(curl -s -c /tmp/gu_reg.txt -b /tmp/gu_reg.txt -X POST "$API?action=sendOtp" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$REG_EMAIL\"}")
echo "$OTP_RES" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "sendOtp for registration" || bad "sendOtp failed: $OTP_RES"

sleep 0.3
DEV_OTP=$(grep -F "DEV OTP for $REG_EMAIL:" "$ROOT/api/php_errors.log" 2>/dev/null | tail -1 | sed 's/.*: //' | tr -d ' \r')
if [[ -n "$DEV_OTP" ]]; then
  ok "OTP available in server log (GU_DEV_MODE=1)"
  VERIFY=$(curl -s -c /tmp/gu_reg.txt -b /tmp/gu_reg.txt -X POST "$API?action=verifyOtp" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$REG_EMAIL\",\"otp\":\"$DEV_OTP\"}")
  echo "$VERIFY" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "verifyOtp" || bad "verifyOtp failed: $VERIFY"
  SAVE=$(curl -s -c /tmp/gu_reg.txt -b /tmp/gu_reg.txt -X POST "$API?action=saveUser" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test User\",\"email\":\"$REG_EMAIL\",\"phone\":\"\",\"password\":\"5678\",\"kycStatus\":\"Not Submitted\"}")
  echo "$SAVE" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
    && ok "saveUser after OTP verification" || bad "saveUser failed: $SAVE"
else
  skip "Registration OTP flow (start PHP with GU_DEV_MODE=1 for local OTP logging)"
fi
echo ""

echo "=============================================="
echo "RESULT: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=============================================="
exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
