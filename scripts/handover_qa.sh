#!/usr/bin/env bash
# Go-Unlisted — Full handover QA (API + security + new features)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_load_env.sh"
API="http://127.0.0.1:8080/api/api.php"
VITE_HOST="${GU_VITE_HOST:-localhost}"
VITE_PORT=5173
for p in 5173 5174 5175; do
  if curl -s -o /dev/null -w "%{http_code}" "http://$VITE_HOST:$p/" 2>/dev/null | grep -q 200; then
    VITE_PORT="$p"
    break
  fi
done
PROXY="http://$VITE_HOST:$VITE_PORT/api/api.php"
COOKIE="/tmp/gu_handover_cookies.txt"
PASS=0
FAIL=0
SKIP=0

rm -f "$COOKIE"

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ~ $1"; SKIP=$((SKIP+1)); }

csrf() {
  curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getCsrfToken" \
    | php -r 'echo json_decode(file_get_contents("php://stdin"))->csrfToken ?? "";'
}

admin_login() {
  local email="${GU_ADMIN_EMAIL:-}"
  local pass="${GU_ADMIN_PASSWORD:-}"
  if [ -z "$email" ] || [ -z "$pass" ]; then
    echo '{"error":"Set GU_ADMIN_EMAIL and GU_ADMIN_PASSWORD in .env.local"}'
    return 1
  fi
  local token
  token=$(csrf)
  curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=loginAdmin" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $token" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}"
}

echo "=============================================="
echo "GO UNLISTED — Handover QA"
echo "=============================================="
echo ""

# --- 1. Servers ---
echo "[1] Infrastructure"
curl -s -o /dev/null -w "%{http_code}" "$API?action=getCsrfToken" | grep -q 200 && ok "PHP :8080 API" || bad "PHP :8080 API"
curl -s -o /dev/null -w "%{http_code}" "http://$VITE_HOST:$VITE_PORT/" | grep -q 200 && ok "Vite :$VITE_PORT" || bad "Vite :$VITE_PORT"
HTML=$(curl -s "http://$VITE_HOST:$VITE_PORT/")
echo "$HTML" | grep -q 'viewport' && ok "Viewport meta (mobile-ready)" || bad "Missing viewport meta"
echo ""

# --- 2. Public APIs ---
echo "[2] Public APIs"
SHARES=$(curl -s "$API?action=getShares")
echo "$SHARES" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit(is_array($d)&&count($d)>=1?0:1);' \
  && ok "getShares ($(echo "$SHARES" | php -r 'echo count(json_decode(file_get_contents("php://stdin")));') stocks)" || bad "getShares"
echo "$SHARES" | php -r '$d=json_decode(file_get_contents("php://stdin")); $s=$d[0]??null; exit($s&&property_exists($s,"listingPrice")?0:1);' \
  && ok "listingPrice field in API" || bad "listingPrice missing from API"
curl -s "$PROXY?action=getSettings" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->bank_upi??0?0:1);' \
  && ok "Vite proxy → PHP" || bad "Vite proxy"
echo ""

# --- 3. Admin auth ---
echo "[3] Admin authentication"
LOGIN=$(admin_login)
echo "$LOGIN" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "Master admin login" || bad "Admin login: $LOGIN"
AUTH=$(curl -s -b "$COOKIE" "$API?action=checkAuth")
echo "$AUTH" | php -r '$d=json_decode(file_get_contents("php://stdin")); exit($d->authenticated&&$d->type==="admin"&&$d->isMaster?0:1);' \
  && ok "checkAuth master session" || bad "checkAuth"
echo ""

# --- 4. Admin panels (master) ---
echo "[4] Master admin APIs"
for action in getOrders getUsers getInitiatedCheckouts getEmployees getInventory getInvoices; do
  CODE=$(curl -s -o /tmp/gu_qa_body.txt -w "%{http_code}" -b "$COOKIE" "$API?action=$action")
  if [[ "$CODE" == "200" ]] && php -r 'exit(json_last_error());' < /tmp/gu_qa_body.txt 2>/dev/null || true; then
    body=$(cat /tmp/gu_qa_body.txt)
    if echo "$body" | php -r '$j=json_decode(file_get_contents("php://stdin")); exit($j===null&&json_last_error()!==JSON_ERROR_NONE?1:0);' 2>/dev/null; then
      if echo "$body" | grep -q '"error"'; then bad "$action — $body"; else ok "$action"; fi
    else
      echo "$body" | php -r 'exit(json_decode(file_get_contents("php://stdin"))!==null?0:1);' && ok "$action" || bad "$action invalid JSON"
    fi
  else
    bad "$action HTTP $CODE"
  fi
done
echo ""

# --- 5. Listing price save + homepage data ---
echo "[5] Pre-IPO vs Listing price flow"
TOKEN=$(csrf)
LISTING_SAVE=$(curl -s -b "$COOKIE" -X POST "$API?action=saveShareConfig" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{"shareId":"phonepe","basePrice":3200,"listingPrice":4800}')
echo "$LISTING_SAVE" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "saveShareConfig with listingPrice" || bad "saveShareConfig listing: $LISTING_SAVE"
SHARES2=$(curl -s "$API?action=getShares")
echo "$SHARES2" | php -r '
$d=json_decode(file_get_contents("php://stdin"));
foreach($d as $s){if(($s->id??"")==="phonepe"&&($s->listingPrice??0)==4800)exit(0);}
exit(1);
' && ok "PhonePe listingPrice=4800 in public API" || bad "Listing price not returned after save"
echo ""

# --- 6. Security (Burp-style) ---
echo "[6] API security hardening"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API?action=saveShareConfig" \
  -H "Content-Type: application/json" -d '{"shareId":"phonepe","basePrice":1}')
[[ "$CODE" == "403" ]] && ok "saveShareConfig without CSRF → 403" || bad "CSRF bypass (HTTP $CODE)"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" "$API?action=getEmployees")
# unauthenticated employee test - fresh cookie
rm -f /tmp/gu_noauth.txt
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c /tmp/gu_noauth.txt "$API?action=getEmployees")
[[ "$CODE" == "401" ]] && ok "getEmployees without login → 401" || bad "getEmployees unauth (HTTP $CODE)"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE" -X POST "$API?action=getInventory" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $(csrf)" -d '{}')
# getInventory is GET
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API?action=getInventory")
[[ "$CODE" == "401" ]] && ok "getInventory without login → 401" || bad "getInventory unauth (HTTP $CODE)"

TOKEN=$(csrf)
REJECT=$(curl -s -b "$COOKIE" -X POST "$API?action=saveEmployee" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d '{"name":"Hack","email":"hack@test.com","password":"123456","isMaster":true}')
echo "$REJECT" | grep -q "cannot be granted\|Forbidden\|Master privileges" && ok "isMaster in POST rejected" || \
  echo "$REJECT" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->error??"" ? 0 : 1);' && ok "isMaster escalation blocked" || bad "isMaster escalation: $REJECT"
echo ""

# --- 7. Invoice generation ---
echo "[7] Invoice flow"
TOKEN=$(csrf)
ORDER_ID="GU$(date +%s | tail -c 9)Q"
SAVE1=$(curl -s -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"buyerName\":\"QA Test\",\"buyerEmail\":\"qa@test.com\",\"buyerPhone\":\"9876543210\",\"shareId\":\"zepto\",\"shareName\":\"Zepto\",\"shareTicker\":\"ZEPTO\",\"pricePerShare\":620,\"qty\":15,\"method\":\"NEFT\",\"transactionId\":\"UTRQA$(date +%s)\"}")
echo "$SAVE1" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "Manual order created ($ORDER_ID)" || bad "Manual order failed: $SAVE1"
TOKEN=$(csrf)
curl -s -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"status\":\"Confirmed\"}" >/dev/null
INVOICES=$(curl -s -b "$COOKIE" "$API?action=getInvoices")
echo "$INVOICES" | php -r '
$d=json_decode(file_get_contents("php://stdin"));
if(!is_array($d))exit(1);
foreach($d as $i){if(($i->orderId??"")==="'$ORDER_ID'")exit(0);}
exit(1);
' && ok "Auto-invoice on order confirm" || bad "Invoice not created for $ORDER_ID"
echo ""

# --- 8. Frontend routes ---
echo "[8] SPA routes (web)"
for route in "/" "/shares" "/shares/phonepe" "/checkout/zepto" "/login" "/about" "/contact" "/admin/login" "/admin" "/admin#prices"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$VITE_HOST:$VITE_PORT$route" 2>/dev/null || echo "000")
  [[ "$CODE" == "200" ]] && ok "GET $route" || bad "GET $route (HTTP $CODE)"
done
echo ""

# --- 9. Production build ---
echo "[9] Production build"
if (cd "$ROOT/client" && npm run build >/tmp/gu_handover_build.log 2>&1); then
  ok "npm run build"
  [[ -f "$ROOT/client/dist/index.html" ]] && ok "dist/index.html exists" || bad "dist missing"
else
  bad "npm run build failed"
fi
echo ""

# --- 10. OTP flow ---
echo "[10] OTP / MPIN flow"
if bash "$ROOT/scripts/test_otp_flow.sh" >/tmp/gu_otp_test.log 2>&1; then
  ok "test_otp_flow.sh passed"
else
  bad "test_otp_flow.sh failed — see /tmp/gu_otp_test.log"
  tail -5 /tmp/gu_otp_test.log | sed 's/^/    /'
fi
echo ""

echo "=============================================="
echo "HANDOVER QA: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=============================================="
exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
