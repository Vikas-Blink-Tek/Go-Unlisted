# Go-Unlisted — Hostinger Upload

Upload **`deploy/package/`** contents to `public_html/`.

## Steps

1. **Build** — `bash scripts/build_deploy.sh`
2. **MySQL** — Create database in Hostinger hPanel
3. **Config** — Edit `api/db_config.php` with your DB user, password, and database name
4. **Upload** — Upload all files from `deploy/package/` to `public_html/`
5. **Import** — phpMyAdmin → Import → `schema.sql`
6. **Setup** — Open `https://yourdomain.com/setup.php` → Activate → **delete setup.php**

## Admin panel

- URL: `https://yourdomain.com/admin/login`
- Use the master admin email from `schema.sql`
- Change the default password immediately after first login

## MSG91 (registration OTP SMS)

Add to `api/db_config.php` on Hostinger:

```php
$msg91_auth_key = 'your_msg91_auth_key';
$msg91_template_id = 'your_dlt_otp_template_id'; // required for India (DLT)
$msg91_sender_id = 'GOUNLS';
```

**India DLT:** OTP SMS requires an approved MSG91 template ID. Without it, users cannot complete registration on the live site.

## Do not upload

- `api/php_errors.log`
- `api/db_config.local.php` (local secrets only)
- Source code folders (`client/`, `node_modules/`) — only upload `deploy/package/`
