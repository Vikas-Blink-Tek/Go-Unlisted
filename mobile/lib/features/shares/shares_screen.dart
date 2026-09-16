import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../models/models.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class SharesScreen extends StatelessWidget {
  const SharesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final top10 = catalog.top10Shares;
    final items = catalog.filtered;
    final totalCount = top10.length + items.length;
    final filtersActive = catalog.query.trim().isNotEmpty || catalog.sector != 'All';

    return GuPageBackground(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Shares', style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 4),
                  Text(
                    '$totalCount companies · live from website',
                    style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    onChanged: catalog.setQuery,
                    decoration: InputDecoration(
                      hintText: 'Search company, ticker, sector…',
                      prefixIcon: const Icon(Icons.search_rounded, color: GuColors.limeDark),
                      suffixIcon: catalog.query.isEmpty
                          ? null
                          : IconButton(
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () => catalog.setQuery(''),
                            ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 40,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                scrollDirection: Axis.horizontal,
                itemCount: catalog.sectors.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final s = catalog.sectors[i];
                  final active = catalog.sector == s;
                  return GestureDetector(
                    onTap: () => catalog.setSector(s),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        gradient: active ? GuColors.brandGradient : null,
                        color: active ? null : GuColors.surface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: active ? Colors.transparent : GuColors.border),
                        boxShadow: active ? GuColors.softLift : null,
                      ),
                      child: Text(
                        s,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: active ? Colors.white : GuColors.text,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: catalog.loading && totalCount == 0
                  ? const Center(child: CircularProgressIndicator(color: GuColors.lime))
                  : totalCount == 0
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.search_off_rounded, size: 48, color: GuColors.lime.withValues(alpha: 0.5)),
                                const SizedBox(height: 12),
                                Text('No matches', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 18)),
                                const SizedBox(height: 6),
                                Text(
                                  'Try another sector or clear search',
                                  style: GoogleFonts.inter(color: GuColors.muted),
                                ),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: GuColors.lime,
                          onRefresh: catalog.load,
                          child: ListView(
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                            children: [
                              if (top10.isNotEmpty) ...[
                                _SectionTitle(
                                  icon: Icons.emoji_events_rounded,
                                  title: 'Top 10 Shares',
                                ),
                                const SizedBox(height: 12),
                                ..._shareTiles(top10),
                                if (items.isNotEmpty || filtersActive) const SizedBox(height: 20),
                              ],
                              if (filtersActive && items.isNotEmpty) ...[
                                _SectionTitle(
                                  title: catalog.query.isNotEmpty
                                      ? 'Results for “${catalog.query.trim()}”'
                                      : 'Matching listings',
                                  trailing: '($totalCount)',
                                ),
                                const SizedBox(height: 12),
                              ],
                              if (items.isNotEmpty) ..._shareTiles(items, startDelay: top10.length),
                            ],
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _shareTiles(List<GuShare> shares, {int startDelay = 0}) {
    final out = <Widget>[];
    for (var i = 0; i < shares.length; i++) {
      if (i > 0) out.add(const SizedBox(height: 12));
      out.add(ShareListTile(share: shares[i]).guFadeSlide(delayMs: ((startDelay + i) % 8) * 28));
    }
    return out;
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    this.icon,
    this.trailing,
  });

  final String title;
  final IconData? icon;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, color: GuColors.limeDark, size: 22),
          const SizedBox(width: 8),
        ],
        Expanded(
          child: Text(
            title,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: GuColors.ink,
            ),
          ),
        ),
        if (trailing != null)
          Text(
            trailing!,
            style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted, fontWeight: FontWeight.w500),
          ),
      ],
    );
  }
}
