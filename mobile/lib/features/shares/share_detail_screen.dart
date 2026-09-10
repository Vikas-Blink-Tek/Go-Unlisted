import 'dart:ui';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../models/models.dart';
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

    final canViewRates = auth.canViewPrices;

    return GuPageBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: GuColors.ink),
            onPressed: () => context.pop(),
          ),
          title: Text(
            'Back to Listings',
            style: GoogleFonts.inter(color: GuColors.ink, fontSize: 15, fontWeight: FontWeight.w500),
          ),
          titleSpacing: 0,
        ),
        body: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        share.ticker,
                        style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: GuColors.limeSoft,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          share.sector,
                          style: GoogleFonts.inter(color: GuColors.limeDark, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  _BlurredRatesLock(
                    canView: canViewRates,
                    isInline: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatInr(share.price, decimals: true),
                          style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        if (share.growth != null && share.growth!.isNotEmpty)
                          Text(
                            '${share.growth} YoY',
                            style: GoogleFonts.inter(
                              color: share.changePositive ? GuColors.limeDark : Colors.red,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // Logo & Title
              Row(
                children: [
                  GuLogoBubble(
                    name: share.name,
                    colorHex: share.sectorColor,
                    logoUrl: share.logoUrl,
                    logoInitials: share.logoInitials,
                    size: 48,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          share.name.toUpperCase(),
                          style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 20, height: 1.1),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${share.ticker} · Unlisted',
                          style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 400.ms).slideX(begin: 0.04, end: 0),
              
              const SizedBox(height: 24),

              if (share.discountTiers.isNotEmpty) ...[
                _BlurredRatesLock(
                  canView: canViewRates,
                  child: _PriceComparisonBlock(share: share),
                ),
                const SizedBox(height: 24),
              ],

              Text(
                share.description.isEmpty
                    ? 'Company details available after admin listing update.'
                    : share.description,
                style: GoogleFonts.inter(height: 1.6, color: GuColors.text, fontSize: 13),
              ).guFadeSlide(delayMs: 40),

              if (share.highlights.isNotEmpty) ...[
                const SizedBox(height: 24),
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
                      ).guFadeSlide(delayMs: 80 + e.key * 40),
                    ),
              ],

              const SizedBox(height: 24),
              Text(
                'KEY DATA',
                style: GoogleFonts.inter(
                  color: GuColors.limeDark,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              _BlurredRatesLock(
                canView: canViewRates,
                child: _FundamentalsGrid(share: share),
              ),

              if (share.priceHistory.isNotEmpty) ...[
                const SizedBox(height: 24),
                _BlurredRatesLock(
                  canView: canViewRates,
                  child: _PriceChartSection(share: share),
                ),
              ],
              
              const SizedBox(height: 24),
              
              // Bottom CTA Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: GuColors.border),
                  boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ready to invest in ${share.name}?',
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Min. ${formatNumber(share.minQty)} shares · ${canViewRates ? formatInr(share.price * share.minQty) : "Login to see total"}',
                            style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: GuPrimaryButton(
                            label: 'Invest Now →',
                            onPressed: () {
                              if (!auth.isLoggedIn) {
                                context.push('/auth?redirect=/checkout/${share.id}');
                                return;
                              }
                              context.push('/checkout/${share.id}');
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}

class _BlurredRatesLock extends StatelessWidget {
  const _BlurredRatesLock({required this.canView, required this.child, this.isInline = false});
  final bool canView;
  final Widget child;
  final bool isInline;

  @override
  Widget build(BuildContext context) {
    if (canView) return child;

    final blurContent = Stack(
      alignment: Alignment.center,
      children: [
        ImageFiltered(
          imageFilter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: IgnorePointer(child: child),
        ),
        if (!isInline)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4)),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_rounded, size: 28, color: GuColors.ink),
                const SizedBox(height: 8),
                Text(
                  'Login to see prices',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: 140,
                  child: GuPrimaryButton(
                    label: 'Login',
                    onPressed: () => context.push('/auth'),
                  ),
                ),
              ],
            ),
          ),
      ],
    );

    return blurContent;
  }
}

class _PriceComparisonBlock extends StatelessWidget {
  const _PriceComparisonBlock({required this.share});
  final GuShare share;

  @override
  Widget build(BuildContext context) {
    final tiers = List<GuDiscountTier>.from(share.discountTiers)
      ..sort((a, b) => a.minQty.compareTo(b.minQty));
      
    final bestTier = tiers.isNotEmpty ? tiers.last : null;

    return Container(
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Price comparison', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 4),
                Text('Regular rate vs bulk rate — discount is automatic when you order higher quantity.', 
                  style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12)),
              ],
            ),
          ),
          const Divider(height: 1, color: GuColors.border),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('REGULAR PRICE', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 10, fontWeight: FontWeight.w600)),
                    Text(formatInr(share.price, decimals: true), style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16)),
                    Text('Min lot: ${formatNumber(share.minQty)} shares', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 11)),
                  ],
                ),
                const Icon(Icons.arrow_forward_rounded, color: GuColors.muted, size: 20),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('BEST BULK PRICE', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 10, fontWeight: FontWeight.w600)),
                    Text(bestTier != null ? formatInr(bestTier.price, decimals: true) : '-', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18, color: GuColors.limeDark)),
                    if (bestTier != null)
                      Text('${formatNumber(bestTier.minQty)}+ shares', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: GuColors.border)),
            ),
            child: Row(
              children: [
                Expanded(child: Text('QUANTITY', style: GoogleFonts.inter(color: GuColors.muted, fontWeight: FontWeight.w600, fontSize: 10))),
                Expanded(child: Text('REGULAR / SHARE', style: GoogleFonts.inter(color: GuColors.muted, fontWeight: FontWeight.w600, fontSize: 10))),
                Expanded(child: Text('BULK / SHARE', style: GoogleFonts.inter(color: GuColors.muted, fontWeight: FontWeight.w600, fontSize: 10))),
                Expanded(child: Text('DISCOUNT', style: GoogleFonts.inter(color: GuColors.muted, fontWeight: FontWeight.w600, fontSize: 10))),
              ],
            ),
          ),
          ...tiers.asMap().entries.map((e) {
            final idx = e.key;
            final tier = e.value;
            final nextTier = idx + 1 < tiers.length ? tiers[idx + 1] : null;
            final range = nextTier != null
                ? '${formatNumber(tier.minQty)} – ${formatNumber(nextTier.minQty - 1)}'
                : '${formatNumber(tier.minQty)}+';
            
            final saving = share.price - tier.price;
            final savePct = ((saving / share.price) * 100).toStringAsFixed(0);

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: GuColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(child: Text(range, style: GoogleFonts.inter(fontSize: 12, color: GuColors.ink))),
                  Expanded(
                    child: Text(
                      formatInr(share.price, decimals: true),
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: GuColors.muted,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      formatInr(tier.price, decimals: true),
                      style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 12, color: GuColors.limeDark),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      saving > 0 ? '${formatInr(saving)} ($savePct%)' : '—',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: saving > 0 ? GuColors.limeDark : GuColors.muted,
                        fontWeight: saving > 0 ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _FundamentalsGrid extends StatelessWidget {
  const _FundamentalsGrid({required this.share});
  final GuShare share;

  String na(String? v) => (v == null || v.trim().isEmpty) ? 'N/A' : v;

  @override
  Widget build(BuildContext context) {
    final items = [
      {'label': 'Indicative price', 'value': formatInr(share.price, decimals: true)},
      {'label': 'Lot size', 'value': formatNumber(share.minQty)},
      {'label': '52-wk high', 'value': na(share.week52High)},
      {'label': '52-wk low', 'value': na(share.week52Low)},
      {'label': 'Market cap', 'value': na(share.marketCap ?? share.valuation)},
      {'label': 'P/E ratio', 'value': na(share.peRatio)},
      {'label': 'P/B ratio', 'value': na(share.pbRatio)},
      {'label': 'Debt / Equity', 'value': na(share.debtEquity)},
      {'label': 'ROE', 'value': na(share.roe)},
      {'label': 'Book value', 'value': na(share.bookValue)},
      {'label': 'Face value', 'value': na(share.faceValue)},
      {'label': 'ISIN', 'value': na(share.isin)},
    ];

    return Container(
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GuColors.border),
      ),
      child: GridView.builder(
        padding: EdgeInsets.zero,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 2.5,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          final isNA = item['value'] == 'N/A';
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: index < items.length - 2 ? GuColors.border : Colors.transparent,
                ),
                right: BorderSide(
                  color: index % 2 == 0 ? GuColors.border : Colors.transparent,
                ),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(item['label']!, style: GoogleFonts.inter(color: GuColors.muted, fontSize: 11)),
                const SizedBox(height: 4),
                Text(
                  item['value']!,
                  style: GoogleFonts.inter(
                    fontWeight: isNA ? FontWeight.w400 : FontWeight.w600,
                    fontSize: 13,
                    color: isNA ? GuColors.muted : GuColors.text,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PriceChartSection extends StatefulWidget {
  const _PriceChartSection({required this.share});
  final GuShare share;

  @override
  State<_PriceChartSection> createState() => _PriceChartSectionState();
}

class _PriceChartSectionState extends State<_PriceChartSection> {
  String period = '3M';

  @override
  Widget build(BuildContext context) {
    final availablePeriods = ['3M', '6M', '1Y'].where((p) => widget.share.priceHistory.containsKey(p)).toList();
    if (!availablePeriods.contains(period) && availablePeriods.isNotEmpty) {
      period = availablePeriods.first;
    }

    final data = widget.share.priceHistory[period] ?? [];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Price Performance', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14)),
              Row(
                children: availablePeriods.map((p) {
                  final active = p == period;
                  return GestureDetector(
                    onTap: () => setState(() => period = p),
                    child: Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: active ? GuColors.limeSoft : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: active ? GuColors.limeSoft : Colors.transparent),
                      ),
                      child: Text(
                        p,
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                          color: active ? GuColors.limeDark : GuColors.muted,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          const SizedBox(height: 32),
          if (data.isEmpty)
            const SizedBox(
              height: 180,
              child: Center(child: Text('No chart data available')),
            )
          else
            SizedBox(
              height: 180,
              child: LineChart(
                key: ValueKey(period),
                LineChartData(
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: true,
                    drawHorizontalLine: true,
                    getDrawingHorizontalLine: (value) => FlLine(color: Colors.black.withValues(alpha: 0.04), strokeWidth: 1),
                    getDrawingVerticalLine: (value) => FlLine(color: Colors.black.withValues(alpha: 0.04), strokeWidth: 1),
                  ),
                  borderData: FlBorderData(show: false),
                  titlesData: FlTitlesData(
                    show: true,
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 22,
                        interval: math.max(1, (data.length / 5).floorToDouble()),
                        getTitlesWidget: (value, meta) {
                          final idx = value.toInt();
                          final labels = widget.share.chartLabels[period] ?? [];
                          if (idx >= 0 && idx < labels.length) {
                            return Padding(
                              padding: const EdgeInsets.only(top: 8.0),
                              child: Text(
                                labels[idx],
                                style: GoogleFonts.inter(color: GuColors.muted, fontSize: 10),
                                textAlign: TextAlign.center,
                              ),
                            );
                          }
                          return const SizedBox();
                        },
                      ),
                    ),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 32,
                        getTitlesWidget: (value, meta) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: Text(
                              value.toStringAsFixed(1),
                              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 10),
                              textAlign: TextAlign.right,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    LineChartBarData(
                      spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value)).toList(),
                      isCurved: true,
                      color: widget.share.changePositive ? GuColors.lime : Colors.red.shade400,
                      barWidth: 2.5,
                      isStrokeCapRound: true,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          colors: [
                            GuColors.lime.withValues(alpha: 0.3),
                            GuColors.lime.withValues(alpha: 0.0),
                          ],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                  ],
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipColor: (_) => GuColors.ink,
                      getTooltipItems: (touchedSpots) {
                        return touchedSpots.map((LineBarSpot touchedSpot) {
                          return LineTooltipItem(
                            formatInr(touchedSpot.y, decimals: true),
                            GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
                          );
                        }).toList();
                      },
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
