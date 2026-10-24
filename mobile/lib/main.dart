import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/api/gu_api.dart';
import 'core/router.dart';
import 'core/theme/gu_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/offers_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const GoUnlistedApp());
}

class GoUnlistedApp extends StatefulWidget {
  const GoUnlistedApp({super.key});

  @override
  State<GoUnlistedApp> createState() => _GoUnlistedAppState();
}

class _GoUnlistedAppState extends State<GoUnlistedApp> with WidgetsBindingObserver {
  /// How often the open app re-checks prices, listings, offers and orders changed from the admin panel.
  static const _autoRefreshEvery = Duration(seconds: 30);

  final AuthProvider _auth = AuthProvider();
  final CatalogProvider _catalog = CatalogProvider();
  final PortfolioProvider _portfolio = PortfolioProvider();
  final OffersProvider _offers = OffersProvider();
  late final GoRouter _router = createRouter(_auth);
  Timer? _autoRefresh;
  bool _refreshing = false;
  String _lastVersion = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshAll(); // record the starting version alongside the splash-screen load
    _startAutoRefresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoRefresh?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshAll(); // back from background → show the latest immediately
      _startAutoRefresh();
    } else if (state == AppLifecycleState.paused) {
      _autoRefresh?.cancel(); // no polling in the background
    }
  }

  void _startAutoRefresh() {
    _autoRefresh?.cancel();
    _autoRefresh = Timer.periodic(_autoRefreshEvery, (_) => _refreshAll());
  }

  /// Quiet background refresh. Each tick asks the server for a tiny version fingerprint and
  /// downloads shares / offers / orders only when an admin actually changed something.
  Future<void> _refreshAll() async {
    if (_refreshing || _catalog.loading) return;
    _refreshing = true;
    try {
      final res = await GuApi.instance.get('getDataVersion');
      final version = (res['version'] ?? '').toString();
      if (version.isNotEmpty && version == _lastVersion) return;
      final firstCheck = _lastVersion.isEmpty;
      _lastVersion = version;
      if (firstCheck) return; // data was just loaded at startup
      await Future.wait([
        _catalog.load(silent: true),
        _offers.load(silent: true),
        if (_auth.isLoggedIn) _portfolio.load(silent: true),
      ]);
    } catch (_) {
      // Offline or server busy — keep showing the current data and try again next tick
    } finally {
      _refreshing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _catalog),
        ChangeNotifierProvider.value(value: _portfolio),
        ChangeNotifierProvider.value(value: _offers),
      ],
      child: MaterialApp.router(
        title: 'GO UNLISTED',
        debugShowCheckedModeBanner: false,
        theme: GuTheme.light(),
        routerConfig: _router,
      ),
    );
  }
}
