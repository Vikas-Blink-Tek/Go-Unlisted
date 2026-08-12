#!/bin/bash
# Build React app + zip for Hostinger public_html upload.
# Always runs `npm run build` first — never ships stale client/dist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/client/dist"
API_SRC="$ROOT/api"
UPLOADS_SRC="$ROOT/uploads"
SCRIPTS_SRC="$ROOT/scripts"
TEMP="$ROOT/_deploy_temp"
ZIP_OUT="$ROOT/Go-Unlisted-hostinger.zip"

echo "=== Go-Unlisted deploy zip ==="
echo ""

echo "→ Building React app (npm run build)..."
cd "$ROOT/client"
npm run build

if [ ! -f "$DIST/index.html" ]; then
  echo "ERROR: Build failed — $DIST/index.html not found"
  exit 1
fi

JS_BUNDLE=$(basename "$DIST/assets"/index-*.js 2>/dev/null | head -1 || true)
CSS_BUNDLE=$(basename "$DIST/assets"/index-*.css 2>/dev/null | head -1 || true)
if [ -z "$JS_BUNDLE" ]; then
  echo "ERROR: No JS bundle in $DIST/assets/"
  exit 1
fi
echo "   ✓ Built: assets/$JS_BUNDLE"
[ -n "$CSS_BUNDLE" ] && echo "   ✓ Built: assets/$CSS_BUNDLE"

echo ""
echo "→ Preparing package..."
rm -rf "$TEMP"
mkdir -p "$TEMP"

# Frontend — full dist output (catches new assets Vite may add)
cp -r "$DIST/"* "$TEMP/"
# Production .htaccess (SPA + uploads rules)
if [ -f "$ROOT/deploy/public_html.htaccess" ]; then
  cp "$ROOT/deploy/public_html.htaccess" "$TEMP/.htaccess"
fi

echo "→ Copying API..."
mkdir -p "$TEMP/api"
for f in "$API_SRC"/*; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  case "$fname" in
    *.local.php|*.local.example.php|*.log|db_config.example.php|deploy.config.example.php|mail_config.example.php|deploy.config.php)
      echo "   Skipping: $fname"
      continue
      ;;
  esac
  cp "$f" "$TEMP/api/"
done

# Bake live DB/SMTP credentials when deploy.config.php exists
if [ -f "$API_SRC/deploy.config.php" ]; then
  php "$SCRIPTS_SRC/render_deploy_configs.php" "$TEMP/api"
  echo "   ✓ db_config.php + mail_config.php baked from deploy.config.php"
fi

echo "→ Copying uploads scaffold (empty — do not wipe live uploads on server)..."
mkdir -p "$TEMP/uploads/articles" "$TEMP/uploads/kyc" "$TEMP/uploads/shares"
cp "$UPLOADS_SRC/.htaccess" "$TEMP/uploads/" 2>/dev/null || true
printf '%s\n' \
  'KEEP THIS FOLDER ON THE SERVER.' \
  'Do not replace public_html/uploads with this empty package folder.' \
  > "$TEMP/uploads/DO_NOT_OVERWRITE.txt"

echo "→ Copying scripts..."
mkdir -p "$TEMP/scripts"
for f in "$SCRIPTS_SRC"/*.php; do
  [ -f "$f" ] && cp "$f" "$TEMP/scripts/"
done

echo "→ Copying root files..."
cp "$ROOT/schema.sql" "$TEMP/"
cp "$ROOT/setup.php" "$TEMP/"

echo "→ Creating zip: $ZIP_OUT"
rm -f "$ZIP_OUT"
(cd "$TEMP" && zip -rq "$ZIP_OUT" . -x "*.DS_Store")
rm -rf "$TEMP"

echo ""
echo "=== Done! ==="
echo "Zip:  $ZIP_OUT"
echo "Bundle: assets/$JS_BUNDLE"
echo ""
echo "After upload + extract on Hostinger:"
echo "  1. Hard refresh (Ctrl+Shift+R) or open in incognito"
echo "  2. View page source → confirm script is assets/$JS_BUNDLE"
echo "  3. Do NOT overwrite server uploads/ (KYC, logos, article images)"
echo ""
