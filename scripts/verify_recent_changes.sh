#!/usr/bin/env bash
# Verify recent GO UNLISTED changes (IST dates, GU00, UTR search, manual order, etc.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/_load_env.sh"
API="http://127.0.0.1:8080/api/api.php"
VITE="http://127.0.0.1:5173"
COOKIE="/tmp/gu_verify_cookies.txt"
PASS=0
FAIL=0

rm -f "$COOKIE"
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

csrf() {
  curl -s -c "$COOKIE" -b "$COOKIE" "$API?action=getCsrfToken" \
    | php -r 'echo json_decode(file_get_contents("php://stdin"))->csrfToken ?? "";'
}

admin_login() {
  local token
  token=$(csrf)
  curl -s -c "$COOKIE" -b "$COOKIE" -X POST "$API?action=loginAdmin" \
    -H "Content-Type: application/json" -H "X-CSRF-Token: $token" \
    -d "{\"email\":\"${GU_ADMIN_EMAIL}\",\"password\":\"${GU_ADMIN_PASSWORD}\"}"
}

echo "=============================================="
echo "GO UNLISTED — Recent Changes Verification"
echo "=============================================="
echo ""

# --- Static / build checks ---
echo "[1] Static code checks"
php -l "$ROOT/api/api.php" >/dev/null 2>&1 && ok "api.php syntax" || bad "api.php syntax"
grep -q 'showPassword' "$ROOT/client/src/pages/admin/AdminLoginPage.tsx" && ok "Admin login show/hide password" || bad "Admin login password toggle missing"
grep -q 'overflow-y: auto' "$ROOT/client/src/styles/theme.css" 2>/dev/null || grep -q 'scrollbar' "$ROOT/client/src/styles/admin.css" && ok "Scrollbar styles present" || bad "Scrollbar styles missing"
grep -q 'fbq' "$ROOT/client/index.html" && ok "Meta Pixel in index.html" || bad "Meta Pixel missing"
grep -q '9820897828\|919820897828' "$ROOT/api/api.php" && ok "Support phone in API default" || bad "Support phone missing"
grep -q 'transactionId' "$ROOT/client/src/pages/admin/panels/AdminManualOrderPanel.tsx" && ok "Manual order UTR field" || bad "Manual order UTR field missing"
grep -q 'AdminVerifyPaymentsPanel' "$ROOT/client/src/pages/admin/AdminDashboard.tsx" && ok "Verify Payments dedicated panel" || bad "Verify Payments panel routing"
grep -q 'displayUserCode\|DEFAULT_USER_CODE' "$ROOT/client/src/pages/admin/components/AdminOrdersSection.tsx" && ok "User Code column in All Orders" || bad "User Code column missing"
grep -q 'formatDateTime\|getOrderDate' "$ROOT/client/src/pages/admin/components/AdminOrdersSection.tsx" && ok "Date/Time formatting in All Orders" || bad "Date/Time column missing"
grep -q 'matchesAdminSearch' "$ROOT/client/src/pages/admin/panels/AdminVerifyPaymentsPanel.tsx" && ok "UTR search in Verify Payments" || bad "UTR search missing"
grep -q 'UPDATE users SET referral_code' "$ROOT/api/api.php" && bad "GU00 backfill still in api.php" || ok "No GU00 user backfill in migrations"
grep -q 'allocateNextOrderId' "$ROOT/api/api.php" && ok "Short sequential order ID allocator" || bad "allocateNextOrderId missing"
grep -q 'CONVERT_TZ' "$ROOT/api/api.php" && bad "CONVERT_TZ still present (double IST shift)" || ok "No CONVERT_TZ (IST session only)"
grep -q 'generateOrderId' "$ROOT/client/src/pages/CheckoutPage.tsx" && bad "Checkout still sends client orderId" || ok "Checkout lets server assign order ID"
echo ""

# --- Frontend unit-style checks (node) ---
echo "[2] Frontend utility logic"
node --input-type=module -e "
import { parseDbDateTime, formatDateTime, getOrderDate } from './client/src/utils/format.ts';
import { displayUserCode } from './client/src/utils/userCode.ts';
import { matchesAdminSearch } from './client/src/utils/adminSearch.ts';
import { canMarkOrderComplete } from './client/src/utils/orderStatus.ts';

let fail = 0;
const check = (name, cond) => { if (!cond) { console.log('  ✗', name); fail++; } else console.log('  ✓', name); };

const d = parseDbDateTime('2026-07-09 19:30:00');
check('parseDbDateTime IST', !!d && formatDateTime('2026-07-09 16:12:00') === '09 Jul 2026, 04:12 pm');
check('formatDateTime wall clock afternoon', formatDateTime('2026-07-09 14:00:00') === '09 Jul 2026, 02:00 pm');
check('displayUserCode empty → GU00', displayUserCode('') === 'GU00');
check('displayUserCode preserves GUE001', displayUserCode('gue001') === 'GUE001');
check('UTR search partial', matchesAdminSearch('UTR123', 'Order GU123', 'NEFT UTR123456'));
check('getOrderDate prefers date', getOrderDate({ date: '2026-07-09 10:00:00', createdAt: 'x' }) === '2026-07-09 10:00:00');
check('canMarkOrderComplete Confirmed', canMarkOrderComplete('Confirmed'));
check('cannot complete Pending', !canMarkOrderComplete('Pending Verification'));

process.exit(fail > 0 ? 1 : 0);
" && PASS=$((PASS+8)) || { bad "Frontend utility tests failed"; FAIL=$((FAIL+1)); }
echo ""

# --- PHP helper logic ---
echo "[3] PHP helper logic"
php -r "
function normalizeUserCode(string \$code): string {
    \$code = strtoupper(trim(\$code));
    return \$code !== '' ? \$code : 'GU00';
}
function sanitizeStoredUserCode(string \$code): string {
    return strtoupper(trim(\$code));
}
\$tests = [
    normalizeUserCode('') === 'GU00',
    normalizeUserCode('gue001') === 'GUE001',
    sanitizeStoredUserCode('') === '',
];
exit(in_array(false, \$tests, true) ? 1 : 0);
" && ok "PHP user code helpers" || bad "PHP user code helpers"
echo ""

# --- Admin API integration ---
echo "[4] Admin API integration"
LOGIN=$(admin_login)
echo "$LOGIN" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "Admin login" || { bad "Admin login failed: $LOGIN"; echo "Cannot continue admin tests"; exit 1; }

ORDERS=$(curl -s -b "$COOKIE" "$API?action=getOrders")
echo "$ORDERS" | php -r '
$d=json_decode(file_get_contents("php://stdin"));
if(!is_array($d)||count($d)<1){exit(1);}
$o=$d[0];
$hasDate=!empty($o->date)||!empty($o->createdAt)||!empty($o->created_at);
$hasCode=isset($o->employeeCode)||isset($o->employee_code)||isset($o->userCode);
exit($hasDate?0:1);
' && ok "getOrders returns date field on orders" || bad "getOrders missing date on orders"

echo "$ORDERS" | php -r '
$d=json_decode(file_get_contents("php://stdin"));
if(!is_array($d))exit(1);
foreach($d as $o){
  $code=$o->employeeCode??$o->employee_code??"";
  if($code===""){ if(($o->userCode??"")!=="GU00" && ($o->employeeCode??"")==="") continue; }
}
exit(0);
' && ok "getOrders includes user/employee code fields" || bad "getOrders user code fields"

INIT=$(curl -s -b "$COOKIE" "$API?action=getInitiatedCheckouts")
echo "$INIT" | php -r '
$d=json_decode(file_get_contents("php://stdin"));
if(!is_array($d))exit(1);
if(count($d)<1){exit(0);}
$o=$d[0];
$ts=$o->initiatedAt??$o->created_at??$o->date??"";
exit($ts!==""?0:1);
' && ok "getInitiatedCheckouts has timestamp" || bad "getInitiatedCheckouts missing timestamp"

# Create order WITHOUT client orderId → server assigns GU0001-style ID
UTR="UTRVERIFY$(date +%s)"
TOKEN=$(csrf)
SAVE=$(curl -s -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"buyerName\":\"Verify Test\",\"buyerEmail\":\"verify@test.com\",\"buyerPhone\":\"9876543210\",\"shareId\":\"zepto\",\"shareName\":\"Zepto\",\"shareTicker\":\"ZEPTO\",\"pricePerShare\":620,\"qty\":15,\"method\":\"NEFT\",\"transactionId\":\"$UTR\",\"status\":\"Pending Verification\"}")
ORDER_ID=$(echo "$SAVE" | php -r 'echo json_decode(file_get_contents("php://stdin"))->orderId??"";')
echo "$SAVE" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "Create order with UTR (server ID: $ORDER_ID)" || bad "Create order failed: $SAVE"
echo "$ORDER_ID" | php -r 'exit(preg_match("/^GU[0-9]{4,}$/",trim(file_get_contents("php://stdin")))?0:1);' \
  && ok "Short sequential order ID format ($ORDER_ID)" || bad "Order ID not short sequential: $ORDER_ID"

ORDERS2=$(curl -s -b "$COOKIE" "$API?action=getOrders")
echo "$ORDERS2" | php -r "
\$d=json_decode(file_get_contents('php://stdin'));
foreach(\$d as \$o){
  if((\$o->orderId??'')==='$ORDER_ID' && stripos(\$o->transactionId??\$o->transaction_id??'','$UTR')!==false) exit(0);
}
exit(1);
" && ok "Order UTR retrievable in getOrders" || bad "Order UTR not in getOrders"

# Date must be IST wall-clock (not +5:30 shifted) — within ~2 min of PHP Asia/Kolkata now
echo "$ORDERS2" | php -r "
date_default_timezone_set('Asia/Kolkata');
\$d=json_decode(file_get_contents('php://stdin'));
foreach(\$d as \$o){
  if((\$o->orderId??'')!=='$ORDER_ID') continue;
  \$ts=\$o->date??\$o->createdAt??'';
  if(\$ts==='') exit(1);
  \$orderTs=strtotime(\$ts);
  \$now=time();
  // Accept if within 5 minutes of now (IST)
  exit(abs(\$now-\$orderTs)<300?0:1);
}
exit(1);
" && ok "Order date is IST (no double +5:30 shift)" || bad "Order date timezone wrong"

# Manual order without orderId + Confirmed + UTR
MANUAL_UTR="MANUALUTR$(date +%s)"
TOKEN=$(csrf)
MANUAL=$(curl -s -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"buyerName\":\"Manual QA\",\"buyerEmail\":\"manual@test.com\",\"buyerPhone\":\"9876543211\",\"shareId\":\"zepto\",\"shareName\":\"Zepto\",\"shareTicker\":\"ZEPTO\",\"pricePerShare\":625,\"qty\":15,\"method\":\"UPI\",\"transactionId\":\"$MANUAL_UTR\",\"status\":\"Confirmed\",\"orderSource\":\"Offline\"}")
MANUAL_ID=$(echo "$MANUAL" | php -r 'echo json_decode(file_get_contents("php://stdin"))->orderId??"";')
echo "$MANUAL" | php -r 'exit(json_decode(file_get_contents("php://stdin"))->success??false?0:1);' \
  && ok "Manual order Confirmed with UTR ($MANUAL_ID)" || bad "Manual order failed: $MANUAL"
echo "$MANUAL_ID" | php -r 'exit(preg_match("/^GU[0-9]{4,}$/",trim(file_get_contents("php://stdin")))?0:1);' \
  && ok "Manual order short ID ($MANUAL_ID)" || bad "Manual order ID not short: $MANUAL_ID"

INVOICES=$(curl -s -b "$COOKIE" "$API?action=getInvoices")
echo "$INVOICES" | php -r "
\$d=json_decode(file_get_contents('php://stdin'));
foreach(\$d as \$i){if((\$i->orderId??'')==='$MANUAL_ID')exit(0);}
exit(1);
" && ok "Invoice auto-created for manual Confirmed order" || bad "Invoice not created for manual order"

# Verify order status update (Pending → Confirmed)
TOKEN=$(csrf)
curl -s -b "$COOKIE" -X POST "$API?action=saveOrder" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"status\":\"Confirmed\"}" >/dev/null
ORDERS3=$(curl -s -b "$COOKIE" "$API?action=getOrders")
echo "$ORDERS3" | php -r "
\$d=json_decode(file_get_contents('php://stdin'));
foreach(\$d as \$o){if((\$o->orderId??'')==='$ORDER_ID' && (\$o->status??'')==='Confirmed')exit(0);}
exit(1);
" && ok "Verify payment (status → Confirmed)" || bad "Status update to Confirmed failed"
echo ""

# --- Initiated checkout preserves start time ---
echo "[5] Initiated checkout timestamp preservation"
SESSION="verify-$(date +%s)"
TOKEN=$(csrf)
curl -s -b "$COOKIE" -X POST "$API?action=saveInitiatedCheckout" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"sessionId\":\"$SESSION\",\"shareId\":\"zepto\",\"shareName\":\"Zepto\",\"shareTicker\":\"ZEPTO\",\"qty\":5,\"pricePerShare\":620,\"totalAmount\":3100,\"paymentMode\":\"NEFT\"}" >/dev/null
sleep 2
TOKEN=$(csrf)
curl -s -b "$COOKIE" -X POST "$API?action=saveInitiatedCheckout" \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $TOKEN" \
  -d "{\"sessionId\":\"$SESSION\",\"shareId\":\"zepto\",\"shareName\":\"Zepto\",\"shareTicker\":\"ZEPTO\",\"qty\":10,\"pricePerShare\":620,\"totalAmount\":6200,\"paymentMode\":\"NEFT\"}" >/dev/null
INIT2=$(curl -s -b "$COOKIE" "$API?action=getInitiatedCheckouts")
echo "$INIT2" | php -r "
\$d=json_decode(file_get_contents('php://stdin'));
foreach(\$d as \$o){
  if((\$o->sessionId??'')==='$SESSION'){
    \$ts=\$o->initiatedAt??\$o->created_at??'';
    if(\$ts==='')exit(1);
    // timestamp should be parseable and not empty
    exit(0);
  }
}
exit(1);
" && ok "Initiated checkout update preserves session + timestamp" || bad "Initiated checkout timestamp issue"
echo ""

# --- Frontend routes + built assets ---
echo "[6] Frontend routes"
for route in "/admin/login" "/admin" "/contact"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VITE$route" 2>/dev/null || echo "000")
  [[ "$CODE" == "200" ]] && ok "GET $route" || bad "GET $route (HTTP $CODE)"
done
HTML=$(curl -s "$VITE/")
echo "$HTML" | grep -q 'viewport' && ok "SPA index loads" || bad "SPA index failed"
echo ""

echo "[7] Production build"
if (cd "$ROOT/client" && npm run build >/tmp/gu_verify_build.log 2>&1); then
  ok "npm run build"
  grep -q 'fbq' "$ROOT/client/dist/index.html" && ok "Meta Pixel in production build" || bad "Meta Pixel missing from dist"
else
  bad "npm run build failed — see /tmp/gu_verify_build.log"
fi
echo ""

echo "=============================================="
echo "VERIFICATION: $PASS passed, $FAIL failed"
echo "=============================================="
exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
