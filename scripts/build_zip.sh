#!/bin/bash
# Build deploy package + zip for Hostinger upload (credentials baked in)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$ROOT/api/deploy.config.php" ]; then
  echo "Copy api/deploy.config.example.php → api/deploy.config.php and fill DB user/name from hPanel"
  exit 1
fi

echo "== Build frontend =="
bash "$ROOT/scripts/build_deploy.sh"

echo "== Bake credentials into deploy package =="
php "$ROOT/scripts/render_deploy_configs.php" "$ROOT/deploy/package/api"

echo "== Remove local-only files from package =="
rm -f "$ROOT/deploy/package/api/db_config.local.php"
rm -f "$ROOT/deploy/package/api/deploy.config.php"
rm -f "$ROOT/deploy/package/api/deploy.config.example.php"
rm -f "$ROOT/deploy/package/api/php_errors.log"

ZIP="$ROOT/Go-Unlisted-hostinger.zip"
rm -f "$ZIP"
(cd "$ROOT/deploy/package" && zip -rq "$ZIP" .)

echo ""
echo "✓ Ready: $ZIP"
echo "  Upload zip contents to public_html/ (or extract on server)"
echo "  See LOGIN_CREDENTIALS.txt inside the zip for admin + OTP email"
