import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/gu_theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/catalog_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    final catalog = context.read<CatalogProvider>();

    // Never hang forever on slow / failed network
    await Future.wait([
      auth.bootstrap().timeout(
        const Duration(seconds: 12),
        onTimeout: () {},
      ),
      catalog.load().timeout(
        const Duration(seconds: 12),
        onTimeout: () {},
      ),
      Future<void>.delayed(const Duration(milliseconds: 900)),
    ]);
    auth.markBootComplete();

    if (!mounted) return;
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getBool('gu_onboarded') ?? false;
    if (!mounted) return;
    if (!seen) {
      context.go('/onboarding');
      return;
    }
    // After first login on this device → MPIN unlock (email remembered).
    // Brand-new guests → home + welcome sheet (same as web).
    if (auth.hasRememberedAccount) {
      context.go('/auth');
    } else {
      context.go('/app');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF8FBF5), Color(0xFFEEF8E8), Color(0xFFE8F3FB)],
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(30),
                boxShadow: GuColors.softLift,
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
            )
                .animate()
                .scale(begin: const Offset(0.85, 0.85), curve: Curves.easeOutBack, duration: 700.ms)
                .fadeIn(),
            const SizedBox(height: 28),
            Text.rich(
              TextSpan(
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                children: const [
                  TextSpan(text: 'GO ', style: TextStyle(color: GuColors.lime)),
                  TextSpan(text: 'UNLISTED', style: TextStyle(color: GuColors.navy)),
                ],
              ),
            ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2, end: 0),
            const SizedBox(height: 12),
            Text(
              'Pre-IPO & Unlisted Shares',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: GuColors.muted),
            ).animate().fadeIn(delay: 350.ms),
            const SizedBox(height: 40),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: GuColors.lime),
            ).animate().fadeIn(delay: 500.ms),
          ],
        ),
      ),
    );
  }
}
