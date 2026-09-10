import 'package:flutter/foundation.dart';

class ApiConfig {
  /// Live site + same MySQL DB as website / admin panel.
  static const productionBase = 'https://go-unlisted.com';

  /// Local PHP only — never used in release APKs.
  static const localBase = 'http://127.0.0.1:8080';

  /// Optional: `flutter run --dart-define=GU_API_BASE=http://10.0.2.2:8080`
  static const _envBase = String.fromEnvironment('GU_API_BASE');

  /// Release / installable APKs always hit production. Debug may override via dart-define.
  static String get baseUrl {
    if (kReleaseMode) return productionBase;
    if (_envBase.isNotEmpty) return _envBase;
    return productionBase;
  }

  static String get apiEndpoint => '$baseUrl/api/api.php';

  static const clientName = 'GO-UNLISTED-Android';
  static const clientVersion = '1.0.0';

  /// Resolves share logos / uploads / QR (e.g. `uploads/shares/x.png` → full HTTPS URL).
  static String resolveMediaUrl(String? path) {
    if (path == null) return '';
    final p = path.trim();
    if (p.isEmpty) return '';
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
      return p;
    }
    final clean = p.replaceFirst(RegExp(r'^/+'), '');
    return '$baseUrl/$clean';
  }
}
