import 'package:shared_preferences/shared_preferences.dart';

const _kEmail = 'gu_remembered_email';
const _kName = 'gu_remembered_name';

class AuthPrefs {
  static Future<void> rememberAccount({required String email, String? name}) async {
    final prefs = await SharedPreferences.getInstance();
    final clean = email.trim().toLowerCase();
    if (clean.isEmpty) return;
    await prefs.setString(_kEmail, clean);
    if (name != null && name.trim().isNotEmpty) {
      await prefs.setString(_kName, name.trim());
    }
  }

  static Future<String?> rememberedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_kEmail)?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }

  static Future<String?> rememberedName() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_kName)?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }

  static Future<void> clearRememberedAccount() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kEmail);
    await prefs.remove(_kName);
  }
}
