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
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: Text('No orders yet — browse shares to get started', style: TextStyle(color: GuColors.muted))),
              )
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
                        '${o.qty} shares · ${formatInr(o.totalPaid, decimals: true)}',
                        style: const TextStyle(color: GuColors.muted),
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
