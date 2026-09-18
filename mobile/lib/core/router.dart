import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_screen.dart';
import '../features/checkout/checkout_screen.dart';
import '../features/home/home_screen.dart';
import '../features/kyc/kyc_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/portfolio/portfolio_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/profile/account_center_screen.dart';
import '../features/profile/about_screens.dart';
import '../features/profile/profile_content.dart';
import '../features/shares/share_detail_screen.dart';
import '../features/shares/shares_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/splash/splash_screen.dart';
import '../providers/auth_provider.dart';
import 'page_transitions.dart';

final _rootKey = GlobalKey<NavigatorState>();

bool _needsAuth(String location) {
  return location.startsWith('/checkout') ||
      location == '/kyc' ||
      location.startsWith('/app/portfolio') ||
      location.startsWith('/app/profile') ||
      location.startsWith('/profile/');
}

GoRouter createRouter(AuthProvider auth) {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/splash',
    refreshListenable: auth,
    redirect: (context, state) {
      if (auth.booting) return null;
      final loc = state.matchedLocation;
      if (_needsAuth(loc) && !auth.isLoggedIn) {
        final redirect = Uri.encodeComponent(state.uri.toString());
        return '/auth?redirect=$redirect';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        pageBuilder: (context, state) => guFadeUpPage(
          key: state.pageKey,
          child: const SplashScreen(),
          duration: const Duration(milliseconds: 280),
        ),
      ),
      GoRoute(
        path: '/onboarding',
        pageBuilder: (context, state) => guFadeUpPage(
          key: state.pageKey,
          child: const OnboardingScreen(),
        ),
      ),
      GoRoute(
        path: '/auth',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: AuthScreen(
            redirectTo: state.uri.queryParameters['redirect'],
            initialTab: state.uri.queryParameters['tab'],
          ),
        ),
      ),
      GoRoute(
        path: '/shares/:id',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: ShareDetailScreen(shareId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/checkout/:id',
        pageBuilder: (context, state) => guFadeUpPage(
          key: state.pageKey,
          child: CheckoutScreen(shareId: state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/kyc',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const KycScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/account',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const AccountCenterScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/about',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const AboutHubScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/about/company',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const AboutCompanyScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/about/vision',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const VisionMissionScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/faqs',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const FaqsScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/legal/privacy',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const LegalDocScreen(title: 'Privacy Policy', body: GuProfileCopy.privacyBody),
        ),
      ),
      GoRoute(
        path: '/profile/legal/risk',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const LegalDocScreen(title: 'Declaration of Risk', body: GuProfileCopy.riskBody),
        ),
      ),
      GoRoute(
        path: '/profile/legal/terms',
        pageBuilder: (context, state) => guSlidePage(
          key: state.pageKey,
          child: const LegalDocScreen(title: 'Terms & Conditions', body: GuProfileCopy.termsBody),
        ),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/app', pageBuilder: (c, s) => NoTransitionPage(key: s.pageKey, child: const HomeScreen())),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/shares', pageBuilder: (c, s) => NoTransitionPage(key: s.pageKey, child: const SharesScreen())),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/portfolio', pageBuilder: (c, s) => NoTransitionPage(key: s.pageKey, child: const PortfolioScreen())),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/app/profile', pageBuilder: (c, s) => NoTransitionPage(key: s.pageKey, child: const ProfileScreen())),
          ]),
        ],
      ),
    ],
  );
}
