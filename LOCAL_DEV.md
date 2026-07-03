# Local Development Setup

## Start backend

```bash
cd /Users/ashwatisuvarna/Go-Unlisted-main
GU_DEV_MODE=1 php -S 127.0.0.1:8080 -t .
```

## Start frontend

```bash
cd client && npm run dev
```

Open: http://localhost:5173

## Database

```bash
mysql -u root gounlisted < schema.sql
```

## Registration OTP

Email OTP only. With `GU_DEV_MODE=1`, codes are logged to `api/php_errors.log`.

## Build deploy zip

```bash
bash scripts/build_deploy.sh
cd deploy/package && zip -r ../../Go-Unlisted-hostinger.zip .
```
