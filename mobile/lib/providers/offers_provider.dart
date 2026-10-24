import 'package:flutter/foundation.dart';

import '../core/api/gu_api.dart';
import '../models/models.dart';

class OffersProvider extends ChangeNotifier {
  List<GuFestivalOffer> _offers = [];
  bool _loading = false;
  String? _error;

  List<GuFestivalOffer> get offers => _offers;
  bool get loading => _loading;
  String? get error => _error;

  List<GuFestivalOffer> get validOffers {
    final now = DateTime.now();
    return _offers.where((o) {
      if (!o.isActive) return false;
      if (o.endsAt == null) return true;
      return o.endsAt!.isAfter(now);
    }).toList();
  }

  /// [silent] = background refresh: no spinner, keeps current offers on errors.
  Future<void> load({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      await GuApi.instance.init();
      final res = await GuApi.instance.get('getActiveOffers');
      final raw = res['data'] ?? res['offers'] ?? res;
      List list = [];
      if (raw is List) {
        list = raw;
      } else if (raw is Map && raw['data'] is List) {
        list = raw['data'];
      }

      _offers = list
          .whereType<Map>()
          .map((e) => GuFestivalOffer.fromJson(Map<String, dynamic>.from(e)))
          .where((o) => !o.isExpired)
          .toList();
      if (silent) notifyListeners();
    } on ApiException catch (e) {
      if (!silent) {
        _error = e.message;
        _offers = [];
      }
    } catch (e) {
      if (!silent) {
        _error = e.toString();
        _offers = [];
      }
    } finally {
      if (!silent) {
        _loading = false;
        notifyListeners();
      }
    }
  }
}
