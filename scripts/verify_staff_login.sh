#!/usr/bin/env bash
# Verify staff login feature in built assets + API source (no live credentials)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0
ok() { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "GO-UNLISTED — Staff login verification"
echo ""

echo "[1] Frontend build"
if [ -f "$ROOT/client/dist/index.html" ]; then ok "client/dist exists"; else bad "client/dist missing — run: cd client && npm run build"; fi
BUNDLE=$(ls "$ROOT/client/dist/assets"/index-*.js 2>/dev/null | head -1)
if [ -n "$BUNDLE" ]; then
  grep -q 'staff/login' "$BUNDLE" && ok "Bundle includes /staff/login route" || bad "Bundle missing /staff/login"
  grep -q 'Employee Portal' "$BUNDLE" && ok "Bundle includes Employee Portal" || bad "Bundle missing Employee Portal"
  grep -q 'Master Admin' "$BUNDLE" && ok "Bundle includes Master Admin login" || bad "Bundle missing Master Admin login"
  grep -q 'Copy login info' "$BUNDLE" && ok "Bundle includes Copy login info button" || bad "Bundle missing Copy login info"
  grep -q 'auto-generated' "$BUNDLE" && ok "Bundle includes auto-generated login text" || bad "Bundle missing auto-generated text"
else
  bad "No JS bundle in dist"
fi
echo ""

echo "[2] API portal separation (source)"
grep -q "portal === 'staff'" "$ROOT/api/api.php" && ok "API blocks master on staff portal" || bad "API staff portal guard missing"
grep -q "portal === 'master'" "$ROOT/api/api.php" && ok "API blocks employee on master portal" || bad "API master portal guard missing"
grep -q 'admin_portal' "$ROOT/api/api.php" && ok "API stores admin_portal in session" || bad "API admin_portal missing"
grep -q 'DELETE FROM employees WHERE is_master = 0' "$ROOT/scripts/production_reset.php" \
  && bad "production_reset still deletes employees" \
  || ok "production_reset does not delete employees"
echo ""

echo "[3] Routes"
grep -q 'staff/login' "$ROOT/client/src/App.tsx" && ok "App.tsx has /staff/login route" || bad "App.tsx route missing"
grep -q 'staffLoginUrl' "$ROOT/client/src/pages/admin/AdminEmployees.tsx" && ok "AdminEmployees builds staffLoginUrl" || bad "staffLoginUrl missing"
echo ""

echo "=============================================="
echo "PASSED: $PASS  FAILED: $FAIL"
[ "$FAIL" -eq 0 ]
