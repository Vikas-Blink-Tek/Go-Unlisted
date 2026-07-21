#!/bin/bash
# Build React app and prepare Hostinger upload package
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deploy/package"
PUBLIC="$ROOT/client/public"

echo "Building React app..."
cd "$ROOT/client"
npm run build

echo "Preparing deploy package..."
rm -rf "$DEPLOY"
mkdir -p "$DEPLOY/api" "$DEPLOY/uploads" "$DEPLOY/scripts"

# React frontend (dist already includes public/ assets)
cp -r "$ROOT/client/dist/"* "$DEPLOY/"
cp "$ROOT/deploy/public_html.htaccess" "$DEPLOY/.htaccess"

# Backend
cp "$ROOT/api/"*.php "$DEPLOY/api/"
cp "$ROOT/api/.htaccess" "$DEPLOY/api/"
# Bake DB + SMTP credentials when deploy.config.php exists (required for OTP emails on Hostinger)
if [ -f "$ROOT/api/deploy.config.php" ]; then
  php "$ROOT/scripts/render_deploy_configs.php" "$DEPLOY/api"
  echo "  ✓ db_config.php + mail_config.php baked from deploy.config.php"
else
  cp "$ROOT/api/db_config.example.php" "$DEPLOY/api/db_config.example.php"
  cp "$ROOT/api/mail_config.example.php" "$DEPLOY/api/mail_config.example.php"
  cp "$ROOT/api/deploy.config.example.php" "$DEPLOY/api/deploy.config.example.php" 2>/dev/null || true
  echo "  ⚠ No api/deploy.config.php — OTP emails need mail_config.php on server"
fi
rm -f "$DEPLOY/api/db_config.local.php" "$DEPLOY/api/deploy.config.php"

# Uploads directory security
cp "$ROOT/uploads/.htaccess" "$DEPLOY/uploads/" 2>/dev/null || true
mkdir -p "$DEPLOY/uploads/shares" "$DEPLOY/uploads/kyc"
cp "$ROOT/uploads/shares/.htaccess" "$DEPLOY/uploads/shares/" 2>/dev/null || true
cp "$ROOT/uploads/kyc/.htaccess" "$DEPLOY/uploads/kyc/" 2>/dev/null || true
touch "$DEPLOY/uploads/kyc/.gitkeep"

# Never ship logs or install locks
rm -f "$DEPLOY/api/php_errors.log" "$DEPLOY/api/.installed"

cat > "$DEPLOY/HOSTINGER_UPLOAD.txt" << 'EOF'
GO-UNLISTED — HOSTINGER UPLOAD
==============================

SAFE RE-DEPLOY (site already live — employees & data stay intact):
------------------------------------------------------------------
1. Back up database in phpMyAdmin (Export) before any upload.
2. Upload/extract zip to public_html/ — overwrite PHP and JS files only.
3. Do NOT replace api/db_config.php or api/mail_config.php if unchanged.
4. Do NOT import schema.sql — that is first-install only (repo root).
5. Do NOT delete the uploads/ folder — share logos live there.
6. First page load runs safe DB migrations only (adds missing columns/tables — does NOT update or delete your data).

Employee data isolation (after this deploy):
- Each employee sees only signups with their code (?ref=GUE001)
- Orders & Initiate rows tagged with their employee code
- Master admin sees everything

FIRST INSTALL ONLY:
-------------------
1. Import schema.sql from repo root in phpMyAdmin (once).
2. Upload zip; keep api/db_config.php credentials from LOGIN_CREDENTIALS.txt.
3. Admin → Site Settings → Test SMTP.

See LOGIN_CREDENTIALS.txt for admin login.
EOF

echo ""
echo "✓ Deploy package ready: deploy/package/"
echo "  Upload ALL files inside deploy/package/ to Hostinger public_html/"
echo "  See HOSTINGER_UPLOAD.txt in that folder."
