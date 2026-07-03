# Security notes

## Production admin

Single master admin after setup:

- Email: `jgond1992@gmail.com`
- Set via `setup.php` or `schema.sql` import

## Before go-live

1. Edit `api/db_config.php` with Hostinger MySQL credentials only
2. Run `setup.php` once, then delete it from the server
3. Upload only the contents of `deploy/package/` (built via `scripts/build_deploy.sh`)
4. Configure MSG91 for registration OTP SMS; rotate keys if ever exposed

## Enabled protections

- CSRF on POST API requests
- Phone OTP required for registration
- Admin routes noindex (`robots.txt` + headers)
- `db_config.php` not web-accessible
- Sensitive files blocked in production `.htaccess`
