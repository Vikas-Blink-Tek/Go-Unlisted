import 'package:flutter/foundation.dart';

import '../core/api/gu_api.dart';
import '../models/models.dart';

class CatalogProvider extends ChangeNotifier {
  List<GuShare> _shares = [];
  GuSettings? _settings;
  bool _loading = false;
  String? _error;
  String _query = '';
  String _sector = 'All';

  List<GuShare> get shares => _shares;
  GuSettings? get settings => _settings;
  bool get loading => _loading;
  String? get error => _error;
  String get query => _query;
  String get sector => _sector;

  List<String> get sectors {
    final set = <String>{'All'};
    for (final s in buyable) {
      if (s.sector.isNotEmpty) set.add(s.sector);
    }
    return set.toList()..sort();
  }

  List<GuShare> get featured => _shares.where((s) => s.featured).take(12).toList();

  /// Buyable catalog only — exchange-listed / out-of-stock excluded.
  List<GuShare> get buyable => _shares.where((s) => s.isPurchasable).toList();

  List<GuShare> get filtered {
    return buyable.where((s) {
      if (_sector != 'All' && s.sector != _sector) return false;
      if (_query.isEmpty) return true;
      final q = _query.toLowerCase();
      return s.name.toLowerCase().contains(q) ||
          s.ticker.toLowerCase().contains(q) ||
          s.sector.toLowerCase().contains(q);
    }).toList();
  }

  GuShare? byId(String id) {
    try {
      return _shares.firstWhere((s) => s.id == id);
    } catch (_) {
      return null;
    }
  }

  void setQuery(String q) {
    _query = q;
    notifyListeners();
  }

  void setSector(String s) {
    _sector = s;
    notifyListeners();
  }

  List _asList(dynamic raw) {
    if (raw is List) return raw;
    if (raw is Map) {
      final data = raw['data'] ?? raw['shares'] ?? raw['items'];
      if (data is List) return data;
    }
    return const [];
  }

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await GuApi.instance.init();
      final results = await Future.wait([
        GuApi.instance.get('getShares'),
        GuApi.instance.get('getSettings'),
      ]);

      final list = _asList(results[0]);
      _shares = list
          .whereType<Map>()
          .map((e) => GuShare.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      _settings = GuSettings.fromJson(Map<String, dynamic>.from(results[1]));
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}

class PortfolioProvider extends ChangeNotifier {
  List<GuOrder> _orders = [];
  bool _loading = false;
  String? _error;

  List<GuOrder> get orders => _orders;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await GuApi.instance.get('getOrders');
      final raw = res['data'] ?? res['orders'] ?? res;
      List list = [];
      if (raw is List) list = raw;
      _orders = list
          .whereType<Map>()
          .map((e) => GuOrder.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on ApiException catch (e) {
      _error = e.message;
      _orders = [];
    } catch (_) {
      _orders = [];
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
