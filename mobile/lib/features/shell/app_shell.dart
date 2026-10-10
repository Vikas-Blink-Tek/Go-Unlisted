import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/gu_theme.dart';
import 'package:provider/provider.dart';

import '../../providers/auth_provider.dart';
import '../auth/welcome_auth_sheet.dart';

/// Branch indexes match the StatefulShellRoute order in router.dart.
typedef _Tab = ({int branch, IconData icon, IconData activeIcon, String label});

const List<_Tab> _guestTabs = [
  (branch: 0, icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Home'),
  (branch: 1, icon: Icons.grid_view_outlined, activeIcon: Icons.grid_view_rounded, label: 'Shares'),
  (branch: 2, icon: Icons.pie_chart_outline_rounded, activeIcon: Icons.pie_chart_rounded, label: 'Portfolio'),
  (branch: 3, icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Profile'),
];

/// Signed-in investors: no marketing home — same order as the website nav.
const List<_Tab> _memberTabs = [
  (branch: 1, icon: Icons.grid_view_outlined, activeIcon: Icons.grid_view_rounded, label: 'Shares'),
  (branch: 2, icon: Icons.receipt_long_outlined, activeIcon: Icons.receipt_long_rounded, label: 'Orders'),
  (branch: 4, icon: Icons.newspaper_outlined, activeIcon: Icons.newspaper_rounded, label: 'News'),
  (branch: 5, icon: Icons.info_outline_rounded, activeIcon: Icons.info_rounded, label: 'About'),
  (branch: 3, icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Profile'),
];

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    HapticFeedback.selectionClick();
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final index = navigationShell.currentIndex;
    final loggedIn = context.watch<AuthProvider>().isLoggedIn;
    final tabs = loggedIn ? _memberTabs : _guestTabs;

    return WelcomeAuthHost(
      child: Scaffold(
      backgroundColor: GuColors.bg,
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: GuColors.surface.withValues(alpha: 0.96),
          boxShadow: [
            BoxShadow(
              color: GuColors.navy.withValues(alpha: 0.08),
              blurRadius: 28,
              offset: const Offset(0, -6),
            ),
          ],
          border: const Border(top: BorderSide(color: GuColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
            child: Row(
              children: [
                for (final t in tabs)
                  _NavItem(
                    icon: t.icon,
                    activeIcon: t.activeIcon,
                    label: t.label,
                    selected: index == t.branch,
                    onTap: () => _onTap(t.branch),
                  ),
              ],
            ),
          ),
        ),
      ),
    ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? GuColors.limeSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedScale(
                scale: selected ? 1.12 : 1.0,
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutBack,
                child: Icon(
                  selected ? activeIcon : icon,
                  size: 24,
                  color: selected ? GuColors.limeDark : GuColors.muted,
                ),
              ),
              const SizedBox(height: 4),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 220),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? GuColors.limeDark : GuColors.muted,
                ),
                child: Text(label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
