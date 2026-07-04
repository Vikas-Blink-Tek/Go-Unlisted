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
cp "$ROOT/api/db_config.example.php" "$DEPLOY/api/db_config.php"
cp "$ROOT/api/db_config.example.php" "$DEPLOY/api/db_config.example.php"

# One-time setup
cp "$ROOT/setup.php" "$DEPLOY/"
cp "$ROOT/schema.sql" "$DEPLOY/"
cp "$ROOT/scripts/production_reset.php" "$DEPLOY/scripts/"

# Uploads directory security
cp "$ROOT/uploads/.htaccess" "$DEPLOY/uploads/" 2>/dev/null || true
mkdir -p "$DEPLOY/uploads/shares"
cp "$ROOT/uploads/shares/.htaccess" "$DEPLOY/uploads/shares/" 2>/dev/null || true

# Never ship logs or install locks
rm -f "$DEPLOY/api/php_errors.log" "$DEPLOY/api/.installed"

cat > "$DEPLOY/HOSTINGER_UPLOAD.txt" << 'EOF'
GO-UNLISTED — HOSTINGER UPLOAD (5 steps)
========================================

1. CREATE DATABASE in Hostinger hPanel → MySQL Databases

2. EDIT api/db_config.php — set your 4 MySQL values:
   YOUR_HOSTINGER_DB_USER
   YOUR_HOSTINGER_DB_PASSWORD
   YOUR_HOSTINGER_DB_NAME
   (host is usually localhost)

3. UPLOAD everything in this folder to public_html/

4. IMPORT schema.sql in phpMyAdmin (select your database → Import)

5. VISIT https://yourdomain.com/setup.php → click "Activate production site"
   Then DELETE setup.php from the server.

ADMIN LOGIN: https://yourdomain.com/admin/login
Use the master admin email from schema.sql. Change the default password immediately after first login.

STOCK LOGOS:
- Keep public_html/uploads/shares/ on the server (do not delete when updating).
- Folder permissions: uploads and uploads/shares = 755.
- After uploading a logo in admin, click Save Listing.

Optional: ensure Hostinger mail() is enabled so registration OTP emails are delivered.
EOF

echo ""
echo "✓ Deploy package ready: deploy/package/"
echo "  Upload ALL files inside deploy/package/ to Hostinger public_html/"
echo "  See HOSTINGER_UPLOAD.txt in that folder."
