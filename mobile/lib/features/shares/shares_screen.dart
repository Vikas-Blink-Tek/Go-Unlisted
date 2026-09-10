import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/theme/gu_theme.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class SharesScreen extends StatelessWidget {
  const SharesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final items = catalog.filtered;

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
                    '${items.length} companies · live from website',
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
              child: catalog.loading && items.isEmpty
                  ? const Center(child: CircularProgressIndicator(color: GuColors.lime))
                  : items.isEmpty
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
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                            itemCount: items.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 12),
                            itemBuilder: (_, i) => ShareListTile(share: items[i]).guFadeSlide(delayMs: (i % 8) * 28),
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
