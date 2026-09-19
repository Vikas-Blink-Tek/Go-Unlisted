import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

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

class _GoUnlistedAppState extends State<GoUnlistedApp> {
  final AuthProvider _auth = AuthProvider();
  final CatalogProvider _catalog = CatalogProvider();
  final PortfolioProvider _portfolio = PortfolioProvider();
  final OffersProvider _offers = OffersProvider();
  late final GoRouter _router = createRouter(_auth);

  @override
  void initState() {
    super.initState();
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
