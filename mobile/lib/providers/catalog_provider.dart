import 'package:flutter/foundation.dart';

import '../core/api/gu_api.dart';
import '../models/models.dart';

/// Case-insensitive sector match: "Aviation" also matches "Aviation and Tourism sector".
bool sectorMatches(String? shareSector, String selected) {
  if (selected.isEmpty || selected == 'All') return true;
  final share = (shareSector ?? '').trim().toLowerCase();
  final want = selected.trim().toLowerCase();
  if (share.isEmpty || want.isEmpty) return false;
  if (share == want) return true;
  if (share.startsWith('$want ') ||
      share.startsWith('$want/') ||
      share.startsWith('$want,') ||
      share.startsWith('$want &') ||
      share.startsWith('$want(')) {
    return true;
  }
  return false;
}

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
    for (final s in browsable) {
      final sector = s.sector.trim();
      if (sector.isNotEmpty) set.add(sector);
    }
    final list = set.toList()..sort();
    // Keep "All" first
    list.remove('All');
    return ['All', ...list];
  }

  List<GuShare> get featured => _shares.where((s) => s.featured).take(12).toList();

  /// Homepage Pre-IPO vs Listing Price track record (public).
  List<GuShare> get listingComparisons {
    final items = _shares
        .where((s) => (s.listingPrice ?? 0) > 0 && s.price > 0)
        .toList();
    items.sort((a, b) {
      final aGain = ((a.listingPrice! - a.price) / a.price);
      final bGain = ((b.listingPrice! - b.price) / b.price);
      return bGain.compareTo(aGain);
    });
    return items;
  }

  /// Public browse catalog — same as website Shares page (listed / featured still visible).
  List<GuShare> get browsable => List<GuShare>.from(_shares);

  /// Buyable catalog only — exchange-listed / out-of-stock / featured samples excluded.
  List<GuShare> get buyable => _shares.where((s) => s.isPurchasable).toList();

  bool get _filtersActive => _query.trim().isNotEmpty || _sector != 'All';

  bool _matchesBrowseFilters(GuShare s) {
    if (!sectorMatches(s.sector, _sector)) return false;
    if (_query.isEmpty) return true;
    final q = _query.toLowerCase();
    return s.name.toLowerCase().contains(q) ||
        s.ticker.toLowerCase().contains(q) ||
        s.sector.toLowerCase().contains(q);
  }

  /// Same as website Shares page “Top 10 Shares” block.
  List<GuShare> get top10Shares {
    return browsable.where((s) => s.isTop10 && _matchesBrowseFilters(s)).take(10).toList();
  }

  /// Main grid — excludes Top 10 (shown above) and, with no filters, homepage featured samples.
  List<GuShare> get filtered {
    final top10Ids = top10Shares.map((s) => s.id).toSet();
    return browsable.where((s) {
      if (!_filtersActive) {
        if (s.featured) return false;
        if (s.isTop10) return false;
      } else if (top10Ids.contains(s.id)) {
        return false;
      }
      return _matchesBrowseFilters(s);
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
