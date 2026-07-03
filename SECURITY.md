# Security notes

## Before go-live

1. Edit `api/db_config.php` with Hostinger MySQL credentials only
2. Run `setup.php` once on first deploy, then delete it
3. Upload only `deploy/package/` or `Go-Unlisted-hostinger.zip` contents

## Enabled protections

- CSRF on POST API requests
- Email OTP required for registration
- Admin routes noindex
- Sensitive files blocked in production `.htaccess`
