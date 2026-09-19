import 'package:flutter/foundation.dart';

import '../core/api/gu_api.dart';
import '../core/auth_prefs.dart';
import '../models/models.dart';

class AuthProvider extends ChangeNotifier {
  GuUser? _user;
  bool _booting = true;
  String? _error;
  String? _rememberedEmail;
  String? _rememberedName;

  GuUser? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get booting => _booting;
  String? get error => _error;
  bool get canViewPrices => isLoggedIn;
  String? get rememberedEmail => _rememberedEmail;
  String? get rememberedName => _rememberedName;
  bool get hasRememberedAccount => (_rememberedEmail ?? '').isNotEmpty;

  Future<void> bootstrap() async {
    _booting = true;
    notifyListeners();
    try {
      _rememberedEmail = await AuthPrefs.rememberedEmail();
      _rememberedName = await AuthPrefs.rememberedName();
      await GuApi.instance.init();

      // Once the user has logged in on this device, every cold start asks for MPIN only
      // (email is remembered). Silent cookie restore would skip that unlock step.
      if (hasRememberedAccount) {
        await GuApi.instance.clearSession();
        _user = null;
      } else {
        final res = await GuApi.instance.get('checkAuth');
        if (res['authenticated'] == true && res['type'] == 'user' && res['user'] is Map) {
          _user = GuUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
          await AuthPrefs.rememberAccount(email: _user!.email, name: _user!.name);
          _rememberedEmail = _user!.email;
          _rememberedName = _user!.name;
        } else {
          _user = null;
        }
      }
    } catch (_) {
      _user = null;
    } finally {
      _booting = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String mpin) async {
    _error = null;
    notifyListeners();
    try {
      final res = await GuApi.instance.post('loginUser', {
        'email': email.trim(),
        'password': mpin.trim(),
      });
      GuApi.instance.invalidateCsrf();
      if (res['user'] is Map) {
        _user = GuUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
        await AuthPrefs.rememberAccount(email: _user!.email, name: _user!.name);
        _rememberedEmail = _user!.email;
        _rememberedName = _user!.name;
        notifyListeners();
        return true;
      }
      _error = (res['error'] ?? 'Login failed').toString();
      notifyListeners();
      return false;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<bool> sendSignupOtp(String email) async {
    _error = null;
    try {
      await GuApi.instance.post('sendOtp', {'email': email.trim()});
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String email, String otp) async {
    _error = null;
    try {
      await GuApi.instance.post('verifyOtp', {
        'email': email.trim(),
        'otp': otp.trim(),
      });
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String phone,
    required String mpin,
    String? referralCode,
  }) async {
    _error = null;
    try {
      await GuApi.instance.post('saveUser', {
        'name': name.trim(),
        'email': email.trim(),
        'phone': phone.trim(),
        'password': mpin.trim(),
        'role': 'user',
        'kycStatus': 'Not Submitted',
        if (referralCode != null && referralCode.isNotEmpty) 'referralCode': referralCode.trim(),
      });
      GuApi.instance.invalidateCsrf();
      return login(email, mpin);
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshUser() async {
    try {
      final res = await GuApi.instance.get('checkAuth');
      if (res['authenticated'] == true && res['user'] is Map) {
        _user = GuUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
        await AuthPrefs.rememberAccount(email: _user!.email, name: _user!.name);
        _rememberedEmail = _user!.email;
        _rememberedName = _user!.name;
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Clears session but keeps remembered email so next open is MPIN-only.
  Future<void> logout() async {
    try {
      await GuApi.instance.post('logout', {});
    } catch (_) {}
    await GuApi.instance.clearSession();
    _user = null;
    notifyListeners();
  }

  /// Permanently deletes user account from server and removes stored credentials from device.
  Future<bool> deleteAccount() async {
    _error = null;
    notifyListeners();
    try {
      await GuApi.instance.post('deleteAccount', {});
      await AuthPrefs.clearRememberedAccount();
      await GuApi.instance.clearSession();
      _user = null;
      _rememberedEmail = null;
      _rememberedName = null;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  /// Full login again (different email / phone).
  Future<void> switchAccount() async {
    await AuthPrefs.clearRememberedAccount();
    _rememberedEmail = null;
    _rememberedName = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Splash timeout / offline — don't block navigation forever.
  void markBootComplete() {
    if (!_booting) return;
    _booting = false;
    notifyListeners();
  }
}
