import 'package:flutter/foundation.dart';

import '../core/api/gu_api.dart';
import '../models/models.dart';

class AuthProvider extends ChangeNotifier {
  GuUser? _user;
  bool _booting = true;
  String? _error;

  GuUser? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get booting => _booting;
  String? get error => _error;
  bool get canViewPrices => isLoggedIn;

  Future<void> bootstrap() async {
    _booting = true;
    notifyListeners();
    try {
      await GuApi.instance.init();
      final res = await GuApi.instance.get('checkAuth');
      if (res['authenticated'] == true && res['type'] == 'user' && res['user'] is Map) {
        _user = GuUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
      } else {
        _user = null;
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
      // Server regenerates session + CSRF on login — drop cached token.
      GuApi.instance.invalidateCsrf();
      if (res['user'] is Map) {
        _user = GuUser.fromJson(Map<String, dynamic>.from(res['user'] as Map));
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
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      await GuApi.instance.post('logout', {});
    } catch (_) {}
    await GuApi.instance.clearSession();
    _user = null;
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
