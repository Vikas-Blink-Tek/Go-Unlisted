import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gu_widgets.dart';

/// Same behaviour as web [WelcomeAuthModal]: prompt login after a short delay,
/// dismissible so guests can keep browsing.
class WelcomeAuthHost extends StatefulWidget {
  const WelcomeAuthHost({super.key, required this.child});

  final Widget child;

  @override
  State<WelcomeAuthHost> createState() => _WelcomeAuthHostState();
}

class _WelcomeAuthHostState extends State<WelcomeAuthHost> {
  static bool _dismissedThisSession = false;
  bool _shown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
  }

  Future<void> _maybeShow() async {
    if (!mounted || _dismissedThisSession || _shown) return;
    final auth = context.read<AuthProvider>();
    if (auth.booting || auth.isLoggedIn || auth.hasRememberedAccount) return;

    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (!mounted || _dismissedThisSession || auth.isLoggedIn) return;

    _shown = true;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: GuColors.navy.withValues(alpha: 0.45),
      builder: (ctx) => const _WelcomeAuthSheet(),
    );
    _dismissedThisSession = true;
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

class _WelcomeAuthSheet extends StatelessWidget {
  const _WelcomeAuthSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Material(
          color: GuColors.surface,
          borderRadius: BorderRadius.circular(28),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: GuColors.border,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                    color: GuColors.muted,
                  ),
                ),
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: GuColors.softLift,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
                ),
                const SizedBox(height: 16),
                Text(
                  'Welcome to GO UNLISTED',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: GuColors.navy,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Login or create an account to buy Pre-IPO shares and track orders. '
                  'KYC can be completed anytime in your dashboard. '
                  'You can browse listings without signing in.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 13.5,
                    height: 1.45,
                    color: GuColors.muted,
                  ),
                ),
                const SizedBox(height: 22),
                GuPrimaryButton(
                  label: 'Login',
                  onPressed: () {
                    Navigator.pop(context);
                    context.push('/auth');
                  },
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      context.push('/auth?tab=register');
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: GuColors.navy,
                      side: const BorderSide(color: GuColors.border, width: 1.4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text(
                      'Sign up',
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Continue browsing',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      color: GuColors.muted,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
