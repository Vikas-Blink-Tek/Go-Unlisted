import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.isLoggedIn) context.read<PortfolioProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final portfolio = context.watch<PortfolioProvider>();

    if (!auth.isLoggedIn) {
      return _Gate(
        title: 'Your portfolio',
        body: 'Login to track orders and share transfers.',
        cta: 'Login',
        onTap: () => context.push('/auth'),
      );
    }

    return SafeArea(
      child: RefreshIndicator(
        color: GuColors.lime,
        onRefresh: () => portfolio.load(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            Text(
              'Portfolio',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text('${portfolio.orders.length} orders', style: const TextStyle(color: GuColors.muted)),
            const SizedBox(height: 16),
            if (portfolio.loading && portfolio.orders.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator(color: GuColors.lime)),
              )
            else if (portfolio.orders.isEmpty)
              _PortfolioEmptyDemo(onBrowse: () => context.go('/app/shares'))
            else
              ...portfolio.orders.map((o) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: GuColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: GuColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(o.shareName, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: GuColors.blue.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              o.status,
                              style: const TextStyle(fontSize: 11, color: GuColors.blue, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        formatTradeCalc(
                          name: o.shareName,
                          pricePerShare: o.unitPrice,
                          qty: o.qty,
                          total: o.totalPaid,
                        ),
                        style: const TextStyle(color: GuColors.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ).guFadeSlide();
              }),
          ],
        ),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate({required this.title, required this.body, required this.cta, required this.onTap});
  final String title;
  final String body;
  final String cta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline_rounded, size: 48, color: GuColors.lime),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: const TextStyle(color: GuColors.muted)),
            const SizedBox(height: 20),
            GuPrimaryButton(label: cta, onPressed: onTap),
          ],
        ),
      ),
    );
  }
}

class _PortfolioEmptyDemo extends StatelessWidget {
  const _PortfolioEmptyDemo({required this.onBrowse});
  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: GuColors.border),
        boxShadow: GuColors.softCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: GuColors.limeSoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: const Text(
                'DEMO PREVIEW',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: GuColors.limeDark,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Your portfolio will look like this',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: 8),
          const Text(
            'Sample layout only — not real positions. Buy a share and submit UTR to see live orders here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: GuColors.muted, height: 1.45, fontSize: 13),
          ),
          const SizedBox(height: 16),
          ...[
            (
              name: 'Sample Pre-IPO Co.',
              price: 850,
              qty: 100,
              status: 'Transfer Pending',
            ),
            (
              name: 'Example Unlisted Ltd.',
              price: 850,
              qty: 50,
              status: 'Completed',
            ),
          ].map((row) {
            return Opacity(
              opacity: 0.75,
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: GuColors.border, style: BorderStyle.solid),
                  color: GuColors.bgWarm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(row.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        Text(
                          row.status,
                          style: const TextStyle(fontSize: 11, color: GuColors.blue, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatTradeCalc(
                        name: row.name,
                        pricePerShare: row.price,
                        qty: row.qty,
                      ),
                      style: const TextStyle(color: GuColors.muted, fontSize: 12.5, height: 1.35),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 8),
          const Text(
            '1. Browse & pay  ·  2. Submit UTR  ·  3. Track here',
            textAlign: TextAlign.center,
            style: TextStyle(color: GuColors.muted, fontSize: 12),
          ),
          const SizedBox(height: 16),
          GuPrimaryButton(label: 'Explore Shares', onPressed: onBrowse),
        ],
      ),
    );
  }
}
