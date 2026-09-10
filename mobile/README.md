# GO UNLISTED — Flutter App (Android & iOS)

Public investor app for [go-unlisted.com](https://go-unlisted.com).  
**No admin panel** — always uses the **live API + MySQL database** (same as the website). Admin catalog, prices, KYC, and orders appear here automatically.

## Live API (installable APK)

Release builds are hard-wired to:

`https://go-unlisted.com/api/api.php`

Session cookies + CSRF are handled like the website. Do **not** point release APKs at localhost.

## Build & install APK

```bash
cd mobile
flutter pub get
flutter build apk --release
```

APK path:

`mobile/build/app/outputs/flutter-apk/app-release.apk`

Install on a phone (USB debugging or file share):

```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

## Run (emulator / debug)

```bash
cd mobile
flutter run
# still uses live API by default
```

Local API only when debugging:

```bash
flutter run --dart-define=GU_API_BASE=http://10.0.2.2:8080
```

## Features

| Flow | Live DB |
|------|---------|
| Splash + onboarding | — |
| Login / Sign up (OTP + MPIN) | ✅ users |
| Shares catalog + logos | ✅ shares |
| Prices (after login) | ✅ shares |
| Checkout → UTR | ✅ orders |
| Portfolio | ✅ orders |
| KYC + Profile | ✅ users |

Buy works without KYC; KYC still needed before demat transfer (ops).
