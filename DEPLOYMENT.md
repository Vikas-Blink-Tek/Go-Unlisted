# Go-Unlisted — Hostinger Upload

Upload **`deploy/package/`** contents (or extract **`Go-Unlisted-hostinger.zip`**) into `public_html/`.

## Steps

1. Extract zip or upload `deploy/package/` to `public_html/`
2. Edit `api/db_config.php` with Hostinger MySQL credentials
3. Import `schema.sql` in phpMyAdmin **only on first setup** (empty database)
4. Run `setup.php` once on first setup, then delete it

## Admin panel

- URL: `https://yourdomain.com/admin/login`
- Master admin email from `schema.sql`

## Registration OTP (email)

Users verify **email** with a 6-digit OTP — no SMS required.

## Re-deploy (site already live)

- Do **not** re-import `schema.sql`
- Do **not** run `setup.php` again
- Keep existing `api/db_config.php` credentials
