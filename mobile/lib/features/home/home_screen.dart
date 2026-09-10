import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final catalog = context.watch<CatalogProvider>();
    final featured = catalog.featured.isNotEmpty ? catalog.featured : catalog.shares.take(8).toList();
    final firstName = auth.user?.name.isNotEmpty == true ? auth.user!.name.split(' ').first : null;

    return GuPageBackground(
      child: RefreshIndicator(
        color: GuColors.lime,
        onRefresh: () => catalog.load(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
                  child: Row(
                    children: [
                      const Expanded(child: GuBrandMark(compact: true)),
                      if (!auth.isLoggedIn)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: GuColors.navy,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () => context.push('/auth'),
                            child: Text('Login', style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
                          ),
                        )
                      else
                        IconButton(
                          onPressed: () => context.go('/app/profile'),
                          icon: CircleAvatar(
                            radius: 18,
                            backgroundColor: GuColors.limeSoft,
                            child: Text(
                              (firstName ?? 'U')[0].toUpperCase(),
                              style: GoogleFonts.manrope(fontWeight: FontWeight.w800, color: GuColors.limeDark),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Text(
                  firstName != null ? 'Good to see you, $firstName' : 'Start investing smarter',
                  style: GoogleFonts.inter(fontSize: 14, color: GuColors.muted, fontWeight: FontWeight.w500),
                ).guFadeSlide(),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(28),
                    gradient: GuColors.heroGradient,
                    boxShadow: [
                      BoxShadow(
                        color: GuColors.blue.withValues(alpha: 0.28),
                        blurRadius: 32,
                        offset: const Offset(0, 16),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Positioned(
                        right: -12,
                        top: -12,
                        child: Opacity(
                          opacity: 0.18,
                          child: Image.asset('assets/brand/logo.png', width: 110, height: 110),
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Same live catalog as gounlisted.in',
                              style: GoogleFonts.inter(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Invest in Pre-IPO\n& Unlisted Shares',
                            style: GoogleFonts.manrope(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 26,
                              height: 1.15,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Discover private companies, pay securely, complete KYC anytime before demat transfer.',
                            style: GoogleFonts.inter(color: Colors.white.withValues(alpha: 0.9), height: 1.45, fontSize: 13),
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: GuColors.navy,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              onPressed: () => context.go('/app/shares'),
                              child: Text('Browse Shares', style: GoogleFonts.manrope(fontWeight: FontWeight.w800)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ).guFadeSlide(delayMs: 40),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  children: const [
                    Expanded(child: _TrustPill(icon: Icons.verified_user_outlined, label: 'KYC anytime')),
                    SizedBox(width: 8),
                    Expanded(child: _TrustPill(icon: Icons.bolt_rounded, label: '24–72h demat')),
                    SizedBox(width: 8),
                    Expanded(child: _TrustPill(icon: Icons.sync_rounded, label: 'Live prices')),
                  ],
                ).guFadeSlide(delayMs: 80),
              ),
            ),
            SliverToBoxAdapter(
              child: SectionHeader(
                title: 'Featured shares',
                subtitle: 'Curated picks from the live catalog',
                actionLabel: 'See all',
                onAction: () => context.go('/app/shares'),
              ),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 196,
                child: catalog.loading && featured.isEmpty
                    ? const Center(child: CircularProgressIndicator(color: GuColors.lime))
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        scrollDirection: Axis.horizontal,
                        itemCount: featured.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 12),
                        itemBuilder: (_, i) => ShareCard(share: featured[i], horizontal: true)
                            .guFadeSlide(delayMs: 40 * i),
                      ),
              ),
            ),
            const SliverToBoxAdapter(
              child: SectionHeader(
                title: 'How it works',
                subtitle: 'Simple path from browse to demat',
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: GuColors.surface,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: GuColors.border),
                    boxShadow: GuColors.softCard,
                  ),
                  child: const Column(
                    children: [
                      _StepRow(n: '1', title: 'Discover', body: 'Browse Pre-IPO & unlisted companies'),
                      _StepDivider(),
                      _StepRow(n: '2', title: 'Pay', body: 'UPI / NEFT / QR — share your UTR'),
                      _StepDivider(),
                      _StepRow(n: '3', title: 'KYC', body: 'PAN, demat & bank in your profile'),
                      _StepDivider(),
                      _StepRow(n: '4', title: 'Demat', body: 'Shares credited after ops verification'),
                    ],
                  ),
                ).guFadeSlide(delayMs: 100),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 28)),
          ],
        ),
      ),
    );
  }
}

class _TrustPill extends StatelessWidget {
  const _TrustPill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, size: 18, color: GuColors.limeDark),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: GuColors.text),
          ),
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.n, required this.title, required this.body});
  final String n;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: GuColors.brandGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(n, style: GoogleFonts.manrope(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(body, style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepDivider extends StatelessWidget {
  const _StepDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 17),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(width: 2, height: 10, color: GuColors.lime.withValues(alpha: 0.35)),
      ),
    );
  }
}
