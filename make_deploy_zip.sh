#!/bin/bash
set -e

WORKSPACE="/Users/ashwatisuvarna/Go-Unlisted"
DIST="$WORKSPACE/client/dist"
API_SRC="$WORKSPACE/api"
UPLOADS_SRC="$WORKSPACE/uploads"
SCRIPTS_SRC="$WORKSPACE/scripts"
TEMP="$WORKSPACE/_deploy_temp"
ZIP_OUT="$WORKSPACE/Go-Unlisted-hostinger.zip"

echo "=== Creating deploy zip for Hostinger public_html ==="

# Clean old temp
rm -rf "$TEMP"
mkdir -p "$TEMP"

# 1. Copy built client files (index.html, .htaccess, assets/, icons.svg, logo.png, QR.jpeg, robots.txt)
echo "→ Copying built client files..."
cp "$DIST/index.html" "$TEMP/"
cp "$DIST/.htaccess" "$TEMP/"
cp "$DIST/robots.txt" "$TEMP/"
cp "$DIST/icons.svg" "$TEMP/"
cp "$DIST/logo.png" "$TEMP/"
cp "$DIST/QR.jpeg" "$TEMP/"
cp -r "$DIST/assets" "$TEMP/assets"

# 2. Copy API folder (exclude local config & logs)
echo "→ Copying API with production credentials..."
mkdir -p "$TEMP/api"
for f in "$API_SRC"/*; do
    fname=$(basename "$f")
    # Skip local-only files and logs
    case "$fname" in
        *.local.php|*.local.example.php|*.log|db_config.example.php|deploy.config.example.php|mail_config.example.php)
            echo "   Skipping: $fname"
            continue
            ;;
    esac
    cp "$f" "$TEMP/api/"
done

# 3. Copy uploads folder with .htaccess and subdirs (empty dirs preserved)
echo "→ Copying uploads folder..."
mkdir -p "$TEMP/uploads"
cp "$UPLOADS_SRC/.htaccess" "$TEMP/uploads/"
mkdir -p "$TEMP/uploads/articles"
mkdir -p "$TEMP/uploads/kyc"
mkdir -p "$TEMP/uploads/shares"

# 4. Copy scripts folder (only production-needed files)
echo "→ Copying scripts folder..."
mkdir -p "$TEMP/scripts"
for f in "$SCRIPTS_SRC"/*.php; do
    [ -f "$f" ] && cp "$f" "$TEMP/scripts/"
done

# 5. Copy root-level files
echo "→ Copying root files..."
cp "$WORKSPACE/schema.sql" "$TEMP/"
cp "$WORKSPACE/setup.php" "$TEMP/"

# 6. Create the zip
echo "→ Creating zip: $ZIP_OUT"
rm -f "$ZIP_OUT"
cd "$TEMP"
zip -r "$ZIP_OUT" . -x "*.DS_Store"
cd "$WORKSPACE"

# 7. Cleanup
rm -rf "$TEMP"

echo ""
echo "=== Done! ==="
echo "Zip: $ZIP_OUT"
echo ""
echo "Upload instructions:"
echo "  1. Upload $ZIP_OUT to Hostinger File Manager → public_html"
echo "  2. Extract it there — it will overwrite existing files"
echo "  3. The uploads/ folder will keep your existing uploaded files"
echo ""
