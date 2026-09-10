import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class ShareDetailScreen extends StatelessWidget {
  const ShareDetailScreen({super.key, required this.shareId});

  final String shareId;

  @override
  Widget build(BuildContext context) {
    final share = context.watch<CatalogProvider>().byId(shareId);
    final auth = context.watch<AuthProvider>();

    if (share == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Share')),
        body: const Center(child: Text('Share not found')),
      );
    }

    return GuPageBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 188,
              backgroundColor: GuColors.bg,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFE8F3FB), Color(0xFFEEF8E8), Color(0xFFF8FBF5)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
                      child: Row(
                        children: [
                          GuLogoBubble(
                            name: share.name,
                            colorHex: share.sectorColor,
                            logoUrl: share.logoUrl,
                            logoInitials: share.logoInitials,
                            size: 64,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  share.name,
                                  style: GoogleFonts.manrope(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 22,
                                    color: GuColors.ink,
                                    height: 1.15,
                                  ),
                                ).animate().fadeIn(duration: 400.ms).slideX(begin: 0.04, end: 0),
                                const SizedBox(height: 6),
                                Text(
                                  '${share.ticker} · ${share.sector}',
                                  style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: GuColors.surface,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: GuColors.border),
                        boxShadow: GuColors.softCard,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Indicative price',
                                  style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12, fontWeight: FontWeight.w500),
                                ),
                                const SizedBox(height: 6),
                                if (auth.canViewPrices)
                                  Text(formatInr(share.price), style: GuTheme.price(context, size: 28))
                                else
                                  Row(
                                    children: [
                                      ImageFiltered(
                                        imageFilter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
                                        child: Text('₹99,999', style: GuTheme.price(context, size: 28)),
                                      ),
                                      const SizedBox(width: 8),
                                      TextButton(
                                        onPressed: () => context.push('/auth'),
                                        child: Text(
                                          'Login',
                                          style: GoogleFonts.manrope(fontWeight: FontWeight.w700, color: GuColors.blue),
                                        ),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: GuColors.limeSoft,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              children: [
                                Text('Min lot', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 11)),
                                Text(
                                  '${share.minQty}',
                                  style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18, color: GuColors.limeDark),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ).guFadeSlide(delayMs: 40),
                    const SizedBox(height: 24),
                    Text('About', style: Theme.of(context).textTheme.titleLarge).guFadeSlide(delayMs: 80),
                    const SizedBox(height: 8),
                    Text(
                      share.description.isEmpty
                          ? 'Company details available after admin listing update.'
                          : share.description,
                      style: GoogleFonts.inter(height: 1.55, color: GuColors.text, fontSize: 14),
                    ).guFadeSlide(delayMs: 100),
                    if (share.highlights.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      Text('Highlights', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 10),
                      ...share.highlights.asMap().entries.map(
                            (e) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.check_circle_rounded, size: 18, color: GuColors.lime),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(e.value, style: GoogleFonts.inter(height: 1.4, fontSize: 14)),
                                  ),
                                ],
                              ),
                            ).guFadeSlide(delayMs: 120 + e.key * 40),
                          ),
                    ],
                    if (share.ipoTimeline != null && share.ipoTimeline!.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _InfoRow(label: 'IPO timeline', value: share.ipoTimeline!).guFadeSlide(delayMs: 160),
                    ],
                    if (share.valuation != null && share.valuation!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _InfoRow(label: 'Valuation', value: share.valuation!).guFadeSlide(delayMs: 180),
                    ],
                    const SizedBox(height: 110),
                  ],
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: GuPrimaryButton(
              label: 'Buy now',
              onPressed: () {
                if (!auth.isLoggedIn) {
                  context.push('/auth?redirect=/checkout/${share.id}');
                  return;
                }
                context.push('/checkout/${share.id}');
              },
            ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2, end: 0),
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: GuColors.border),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13))),
          Text(value, style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 13)),
        ],
      ),
    );
  }
}
