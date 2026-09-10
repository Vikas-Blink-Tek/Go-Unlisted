import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/router.dart';
import 'core/theme/gu_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';

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
  late final AuthProvider _auth;
  late final CatalogProvider _catalog;
  late final PortfolioProvider _portfolio;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _auth = AuthProvider();
    _catalog = CatalogProvider();
    _portfolio = PortfolioProvider();
    _router = createRouter(_auth);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _catalog),
        ChangeNotifierProvider.value(value: _portfolio),
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
