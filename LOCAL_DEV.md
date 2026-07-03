# Local Development Setup

## Project structure

```
Go-Unlisted-main/
├── client/          ← React frontend (Vite)
│   ├── src/         ← Pages, admin panel, components
│   └── public/      ← Static assets (logo, QR, robots.txt)
├── api/             ← PHP backend (api.php, db_config.php)
├── scripts/         ← Build & test scripts
├── deploy/          ← Production .htaccess template + build output
├── schema.sql       ← Database schema
└── setup.php        ← One-time production activation
```

---

## 1. Database (one-time)

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS gounlisted CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
mysql -u root gounlisted < schema.sql
```

Database name: `gounlisted` (matches `api/db_config.php`)

Admin credentials come from `schema.sql` — change the default password after first login.

---

## 2. Start backend (PHP + MySQL)

Terminal 1:
```bash
cd /Users/ashwatisuvarna/Go-Unlisted-main
php -S 127.0.0.1:8080 -t .
```

For local OTP testing without MSG91, use:
```bash
GU_DEV_MODE=1 php -S 127.0.0.1:8080 -t .
```
OTP codes are logged to `api/php_errors.log` — never use `GU_DEV_MODE=1` in production.

---

## 3. Start frontend (React)

Terminal 2:
```bash
cd /Users/ashwatisuvarna/Go-Unlisted-main/client
npm install   # first time only
npm run dev
```

Open: http://localhost:5173

Admin: http://localhost:5173/admin/login

Vite proxies `/api` → `http://127.0.0.1:8080` automatically.

---

## 4. MySQL must be running

```bash
brew services start mysql
```

---

## 5. Registration OTP (local dev)

Use `http://localhost:5173/login` (React app).

Registration requires **phone OTP verification** via SMS (MSG91).

**Without MSG91:** start PHP with `GU_DEV_MODE=1` and read OTP from `api/php_errors.log`.

**With MSG91:** copy `api/db_config.local.example.php` → `api/db_config.local.php` and set:
```php
$msg91_auth_key = 'your_key';
$msg91_template_id = 'your_dlt_template_id';
$msg91_sender_id = 'GOUNLS';
```

---

## 6. Build production package

```bash
bash scripts/build_deploy.sh
```

Upload everything inside `deploy/package/` to Hostinger `public_html/`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Admin login fails | Re-import schema.sql |
| API empty / connection failed | Start PHP on port 8080 |
| Blank checkout / no data | Check both servers running |
| Don't see React files | Open `client/` folder in the editor |
| OTP not received locally | Use `GU_DEV_MODE=1` and check `api/php_errors.log` |
