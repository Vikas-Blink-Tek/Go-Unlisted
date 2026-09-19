import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme/gu_theme.dart';
import '../models/models.dart';
import '../providers/offers_provider.dart';

class FestivalSlider extends StatefulWidget {
  const FestivalSlider({super.key});

  @override
  State<FestivalSlider> createState() => _FestivalSliderState();
}

class _FestivalSliderState extends State<FestivalSlider> {
  late final PageController _pageController;
  Timer? _autoScrollTimer;
  Timer? _countdownTimer;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();

    // Ticking countdown timer updates UI every second
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OffersProvider>().load().then((_) {
        _startAutoScroll();
      });
    });
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    final offers = context.read<OffersProvider>().validOffers;
    if (offers.length <= 1) return;

    _autoScrollTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_currentPage + 1) % offers.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _countdownTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OffersProvider>();
    final offers = provider.validOffers;

    if (offers.isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 220,
            child: PageView.builder(
              controller: _pageController,
              itemCount: offers.length,
              onPageChanged: (index) {
                setState(() => _currentPage = index);
              },
              itemBuilder: (context, index) {
                final offer = offers[index];
                return _FestivalCard(offer: offer);
              },
            ),
          ),
          if (offers.length > 1) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainContextMainAxisAlignment.center,
              children: List.generate(offers.length, (i) {
                final active = i == _currentPage;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: active ? 22 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    color: active ? GuColors.lime : Colors.black.withValues(alpha: 0.15),
                  ),
                );
              }),
            ),
          ],
        ],
      ),
    );
  }
}

class MainContextMainAxisAlignment {
  static const MainAxisAlignment center = MainAxisAlignment.center;
}

class _FestivalCard extends StatelessWidget {
  const _FestivalCard({required this.offer});

  final GuFestivalOffer offer;

  String _formatCountdown(DateTime? target) {
    if (target == null) return '';
    final diff = target.difference(DateTime.now());
    if (diff.isNegative || diff.inSeconds <= 0) return 'Ended';

    final days = diff.inDays;
    final hours = diff.inHours % 24;
    final minutes = diff.inMinutes % 60;
    final seconds = diff.inSeconds % 60;

    final hStr = hours.toString().padLeft(2, '0');
    final mStr = minutes.toString().padLeft(2, '0');
    final sStr = seconds.toString().padLeft(2, '0');

    if (days > 0) {
      return '${days}d : ${hStr}h : ${mStr}m : ${sStr}s';
    }
    return '${hStr}h : ${mStr}m : ${sStr}s';
  }

  void _handleAction(BuildContext context) {
    final link = offer.linkUrl?.trim();
    if (link != null && link.isNotEmpty) {
      if (link.startsWith('http://') || link.startsWith('https://')) {
        launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication);
        return;
      }
      if (link.startsWith('/')) {
        context.go(link);
        return;
      }
    }
    // Default: navigate to browse shares
    context.go('/app/shares');
  }

  void _copyCoupon(BuildContext context, String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Coupon "$code" copied to clipboard!'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF0F172A),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final countdownStr = _formatCountdown(offer.endsAt);
    final hasImage = offer.resolvedImageUrl.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF061A3A),
            Color(0xFF003478),
            Color(0xFF084C38),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF003478).withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image with dark overlay gradient
          if (hasImage)
            CachedNetworkImage(
              imageUrl: offer.resolvedImageUrl,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => const SizedBox(),
            ),

          // Gradient overlay for contrast
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF071428).withValues(alpha: hasImage ? 0.90 : 0.7),
                  const Color(0xFF00224E).withValues(alpha: hasImage ? 0.82 : 0.6),
                  const Color(0xFF0B3A2C).withValues(alpha: hasImage ? 0.88 : 0.7),
                ],
              ),
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Top Row: Tagline + Countdown Timer
                Row(
                  children: [
                    if (offer.tagline != null && offer.tagline!.isNotEmpty)
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: GuColors.lime.withValues(alpha: 0.25),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: GuColors.lime, width: 1),
                          ),
                          child: Text(
                            '✨ ${offer.tagline}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.manrope(
                              color: const Color(0xFFA5F36A),
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    if (countdownStr.isNotEmpty && countdownStr != 'Ended') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withValues(alpha: 0.25),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.redAccent.withValues(alpha: 0.7)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Colors.redAccent,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              countdownStr,
                              style: const TextStyle(
                                color: Colors.white,
                                fontFamily: 'monospace',
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),

                // Middle: Title + Discount + Description
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      offer.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.manrope(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (offer.discountText != null && offer.discountText!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: Text(
                              offer.discountText!,
                              style: GoogleFonts.manrope(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: GuColors.lime,
                              ),
                            ),
                          ),
                        if (offer.description != null && offer.description!.isNotEmpty)
                          Expanded(
                            child: Text(
                              offer.description!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 11.5,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),

                // Bottom: Action Button & Optional Coupon
                Row(
                  children: [
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: GuColors.lime,
                        foregroundColor: const Color(0xFF082208),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () => _handleAction(context),
                      child: Text(
                        'Grab Deal →',
                        style: GoogleFonts.manrope(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    if (offer.couponCode != null && offer.couponCode!.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: () => _copyCoupon(context, offer.couponCode!),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                              style: BorderStyle.solid,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                offer.couponCode!,
                                style: GoogleFonts.manrope(
                                  color: const Color(0xFFA5F36A),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 11.5,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(
                                Icons.copy_rounded,
                                size: 12,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
