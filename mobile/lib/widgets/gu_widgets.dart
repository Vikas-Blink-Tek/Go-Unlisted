import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_config.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';

/// Soft press scale — premium tactile feedback on cards.
class GuPressable extends StatefulWidget {
  const GuPressable({
    super.key,
    required this.child,
    required this.onTap,
    this.borderRadius,
  });

  final Widget child;
  final VoidCallback onTap;
  final BorderRadius? borderRadius;

  @override
  State<GuPressable> createState() => _GuPressableState();
}

class _GuPressableState extends State<GuPressable> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // Listener for press feedback — does not compete with parent scroll gestures.
    // GestureDetector with only onTap lets horizontal ListViews scroll smoothly.
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _pressed ? 0.972 : 1,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOutCubic,
          child: AnimatedOpacity(
            opacity: _pressed ? 0.92 : 1,
            duration: const Duration(milliseconds: 140),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

class GuPrimaryButton extends StatelessWidget {
  const GuPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 54,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: onPressed == null || loading ? null : GuColors.brandGradient,
        color: onPressed == null || loading ? GuColors.lime.withValues(alpha: 0.45) : null,
        boxShadow: onPressed == null || loading ? null : GuColors.softLift,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: loading ? null : onPressed,
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(
                    label,
                    style: GoogleFonts.manrope(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class GuBrandMark extends StatelessWidget {
  const GuBrandMark({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 40 : 48,
          height: compact ? 40 : 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: GuColors.softLift,
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RichText(
              text: TextSpan(
                style: GoogleFonts.manrope(
                  fontSize: compact ? 22 : 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
                children: const [
                  TextSpan(text: 'GO ', style: TextStyle(color: GuColors.lime)),
                  TextSpan(text: 'UNLISTED', style: TextStyle(color: GuColors.navy)),
                ],
              ),
            ),
            if (!compact)
              Text(
                'Pre-IPO · Unlisted',
                style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted, fontWeight: FontWeight.w600),
              ),
          ],
        ),
      ],
    );
  }
}

String getShareCardTag(GuShare share) {
  if (share.isTrackRecordOnly) return 'Sample';
  if (share.featured) return 'Best Seller';
  if (share.isTop10) return 'Trending';
  final status = (share.inventoryStatus ?? 'In Stock').trim();
  if (status == 'Out of Stock') return 'Out of Stock';
  if (status == 'On Request') return 'On Request';
  if (status == 'Limited') return 'Limited';
  return 'Active';
}

Color shareCardTagColor(String label) {
  switch (label) {
    case 'Trending':
      return const Color(0xFFDB2777);
    case 'Limited':
    case 'On Request':
      return const Color(0xFFD97706);
    case 'Out of Stock':
      return const Color(0xFFDC2626);
    case 'Listed':
    case 'Sample':
      return const Color(0xFF64748B);
    default:
      return const Color(0xFFE11D48);
  }
}

Color _drhpColor(String status) {
  switch (status) {
    case 'DRHP Approved':
      return const Color(0xFF15803D);
    case 'DRHP Filed':
      return const Color(0xFF1D4ED8);
    case 'DRHP Pending':
      return const Color(0xFFB45309);
    default:
      return GuColors.muted;
  }
}

/// Full-width catalog row — scannable, thumb-friendly.
class ShareListTile extends StatelessWidget {
  const ShareListTile({super.key, required this.share});

  final GuShare share;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final tag = getShareCardTag(share);
    return GuPressable(
      onTap: () => context.push('/shares/${share.id}'),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GuColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: GuColors.border),
          boxShadow: GuColors.softCard,
        ),
        child: Row(
          children: [
            GuLogoBubble(
              name: share.name,
              colorHex: share.sectorColor,
              logoUrl: share.logoUrl,
              logoInitials: share.logoInitials,
              size: 52,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    share.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: GuColors.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        share.ticker,
                        style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(width: 8),
                      Flexible(child: GuSectorChip(label: share.sector.isEmpty ? 'Unlisted' : share.sector)),
                    ],
                  ),
                  if (share.showDrhpStatus) ...[
                    const SizedBox(height: 6),
                    Text(
                      share.displayDrhpStatus,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: _drhpColor(share.displayDrhpStatus),
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    'Min lot ${share.minQty}',
                    style: GoogleFonts.inter(fontSize: 11, color: GuColors.mutedSoft),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  tag,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: shareCardTagColor(tag),
                  ),
                ),
                const SizedBox(height: 6),
                if (auth.canViewPrices)
                  Text(formatInr(share.price), style: GuTheme.price(context, size: 16))
                else
                  const GuBlurredPrice(compact: true),
                const SizedBox(height: 6),
                Icon(Icons.chevron_right_rounded, color: GuColors.lime.withValues(alpha: 0.8)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ShareCard extends StatelessWidget {
  const ShareCard({
    super.key,
    required this.share,
    this.horizontal = false,
    this.onTap,
  });

  final GuShare share;
  final bool horizontal;
  /// Override default detail navigation (e.g. Market Activity → share list).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (!horizontal) return ShareListTile(share: share);

    final auth = context.watch<AuthProvider>();
    final tag = getShareCardTag(share);
    return SizedBox(
      width: 200,
      height: 248,
      child: GuPressable(
        onTap: onTap ?? () => context.push('/shares/${share.id}'),
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
          decoration: BoxDecoration(
            color: GuColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: GuColors.border),
            // Single soft shadow — dual softCard is expensive while the marquee moves.
            boxShadow: const [
              BoxShadow(
                color: Color(0x14003478),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GuLogoBubble(
                    name: share.name,
                    colorHex: share.sectorColor,
                    logoUrl: share.logoUrl,
                    logoInitials: share.logoInitials,
                    size: 40,
                  ),
                  const Spacer(),
                  Text(
                    tag,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: shareCardTagColor(tag),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                share.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.manrope(fontWeight: FontWeight.w700, fontSize: 14, color: GuColors.ink, height: 1.2),
              ),
              const SizedBox(height: 4),
              Text(
                'SECTOR',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                  color: GuColors.muted,
                ),
              ),
              Text(
                share.sector.isEmpty ? 'Unlisted' : share.sector,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: GuColors.ink),
              ),
              const Spacer(),
              if ((share.listingPrice ?? 0) > 0) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: GuColors.limeSoft,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: GuColors.lime.withValues(alpha: 0.35)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'LISTING PRICE',
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                          color: GuColors.limeDark,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        formatInr(share.listingPrice!),
                        style: GoogleFonts.manrope(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          height: 1.05,
                          color: GuColors.limeDark,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Invest ${auth.canViewPrices ? formatInr(share.price) : '••••'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: GuColors.muted,
                  ),
                ),
              ] else
                Row(
                  children: [
                    Expanded(
                      child: auth.canViewPrices
                          ? Text(formatInr(share.price), style: GuTheme.price(context, size: 18))
                          : const GuBlurredPrice(compact: true),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class GuLogoBubble extends StatefulWidget {
  const GuLogoBubble({
    super.key,
    required this.name,
    this.colorHex,
    this.logoUrl,
    this.logoInitials,
    this.size = 48,
  });

  final String name;
  final String? colorHex;
  final String? logoUrl;
  final String? logoInitials;
  final double size;

  @override
  State<GuLogoBubble> createState() => _GuLogoBubbleState();
}

class _GuLogoBubbleState extends State<GuLogoBubble> {
  bool _imgFailed = false;

  @override
  void didUpdateWidget(covariant GuLogoBubble oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.logoUrl != widget.logoUrl) {
      _imgFailed = false;
    }
  }

  String get _label {
    final fromField = (widget.logoInitials ?? '').replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
    if (fromField.isNotEmpty) return fromField.substring(0, fromField.length.clamp(0, 3)).toUpperCase();
    return initials(widget.name);
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final src = ApiConfig.resolveMediaUrl(widget.logoUrl);
    final showImg = src.isNotEmpty && !_imgFailed;

    Color color = GuColors.lime;
    final colorHex = widget.colorHex;
    if (colorHex != null && colorHex.startsWith('#') && colorHex.length >= 7) {
      try {
        color = Color(int.parse(colorHex.substring(1, 7), radix: 16) + 0xFF000000);
      } catch (_) {}
    }

    final radius = BorderRadius.circular(size * 0.28);

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: showImg ? Colors.white : null,
        gradient: showImg
            ? null
            : LinearGradient(
                colors: [color, Color.lerp(color, GuColors.navy, 0.25)!],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        borderRadius: radius,
        border: showImg ? Border.all(color: GuColors.border) : null,
        boxShadow: [
          BoxShadow(
            color: (showImg ? GuColors.navy : color).withValues(alpha: showImg ? 0.08 : 0.28),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: showImg
          ? Image.network(
              src,
              width: size,
              height: size,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
              errorBuilder: (_, error, stackTrace) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && !_imgFailed) setState(() => _imgFailed = true);
                });
                return const SizedBox.shrink();
              },
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return Center(
                  child: SizedBox(
                    width: size * 0.28,
                    height: size * 0.28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: GuColors.lime.withValues(alpha: 0.7),
                    ),
                  ),
                );
              },
            )
          : Text(
              _label,
              style: GoogleFonts.manrope(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.28,
              ),
            ),
    );
  }
}

class GuSectorChip extends StatelessWidget {
  const GuSectorChip({super.key, required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: GuColors.blueSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: GoogleFonts.inter(color: GuColors.blue, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class GuBlurredPrice extends StatelessWidget {
  const GuBlurredPrice({super.key, this.compact = false});
  final bool compact;

  /// Cheap locked-price affordance — avoids ImageFiltered blur (janky while scrolling).
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '₹ •••••',
          style: GuTheme.price(context, size: compact ? 14 : 18).copyWith(
            letterSpacing: 1.1,
            color: GuColors.ink.withValues(alpha: 0.38),
          ),
        ),
        const SizedBox(width: 4),
        const Icon(Icons.lock_rounded, size: 13, color: GuColors.muted),
      ],
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction, this.subtitle});

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
          if (actionLabel != null)
            TextButton(
              onPressed: onAction,
              child: Text(
                actionLabel!,
                style: GoogleFonts.manrope(color: GuColors.blue, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }
}

class GuPageBackground extends StatelessWidget {
  const GuPageBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF8FBF5), Color(0xFFF4F7F2), Color(0xFFEEF4F9)],
          stops: [0, 0.45, 1],
        ),
      ),
      child: child,
    );
  }
}

extension GuAnimateList on Widget {
  Widget guFadeSlide({int delayMs = 0}) {
    return animate(delay: delayMs.ms)
        .fadeIn(duration: 420.ms, curve: Curves.easeOutCubic)
        .slideY(begin: 0.05, end: 0, duration: 420.ms, curve: Curves.easeOutCubic)
        .scale(begin: const Offset(0.98, 0.98), end: const Offset(1, 1), duration: 420.ms, curve: Curves.easeOutCubic);
  }
}
