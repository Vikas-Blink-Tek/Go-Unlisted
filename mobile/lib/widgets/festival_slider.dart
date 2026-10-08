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

/// Deal artwork is uploaded at 1800×600 (3:1) — shown uncropped, details in a strip below.
const double kDealBannerRatio = 3;
const double kDealInfoStripHeight = 118;

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
          LayoutBuilder(
            builder: (context, constraints) => SizedBox(
              height: (constraints.maxWidth - 4) / kDealBannerRatio + kDealInfoStripHeight,
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

  static final _festive = RegExp('festiv', caseSensitive: false);

  /// Client positions every promo as a "Best Deal" — never surface festival wording.
  String get _tagline {
    final t = (offer.tagline ?? '').trim();
    if (t.isEmpty || _festive.hasMatch(t)) return '⭐ Best Deal';
    if (RegExp(r'^[⭐🔥⏳⚡✨💥💎]', unicode: true).hasMatch(t)) return t;
    return '⭐ $t';
  }

  String get _discountText {
    final d = (offer.discountText ?? '').trim();
    return _festive.hasMatch(d) ? 'BEST PRICE' : d;
  }

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

  static const _siteHosts = {'go-unlisted.com', 'www.go-unlisted.com', 'gounlisted.in', 'www.gounlisted.in'};

  /// Admin pastes website links (full URL or path). Map them to in-app screens so guests
  /// and logged-in users both land on the stock — only foreign sites open the browser.
  void _handleAction(BuildContext context) {
    var link = (offer.linkUrl ?? '').trim();
    if (RegExp(r'^(www\.)?[a-z0-9-]+\.[a-z]{2,}(/|$)', caseSensitive: false).hasMatch(link)) {
      link = 'https://$link';
    }
    if (link.startsWith('http://') || link.startsWith('https://')) {
      final uri = Uri.tryParse(link);
      if (uri == null) {
        context.go('/app/shares');
        return;
      }
      if (!_siteHosts.contains(uri.host.toLowerCase())) {
        launchUrl(uri, mode: LaunchMode.externalApplication);
        return;
      }
      link = uri.path;
    }
    if (link.isNotEmpty && !link.startsWith('/')) link = '/$link';

    final segments = link.split('/').where((s) => s.isNotEmpty).toList();
    if (segments.length >= 2 && segments[0] == 'shares') {
      context.push('/shares/${segments[1]}');
    } else if (segments.isEmpty) {
      context.go('/app');
    } else if (segments[0] == 'shares') {
      context.go('/app/shares');
    } else if (segments[0] == 'dashboard') {
      context.go('/app/portfolio');
    } else {
      context.go('/app/shares');
    }
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
    final showTimer = countdownStr.isNotEmpty && countdownStr != 'Ended';

    Widget badge(String text, Color bg, Color fg, {bool mono = false}) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: mono
              ? TextStyle(color: fg, fontFamily: 'monospace', fontSize: 10.5, fontWeight: FontWeight.w800)
              : GoogleFonts.manrope(color: fg, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.3),
        ),
      );
    }

    final badges = Row(
      children: [
        Flexible(child: badge(_tagline.toUpperCase(), const Color(0xFFFACC15), const Color(0xFF1C1917))),
        if (showTimer) ...[
          const SizedBox(width: 6),
          Flexible(child: badge('ENDS IN $countdownStr', const Color(0xFFDC2626), Colors.white, mono: true)),
        ],
      ],
    );

    final titleRow = Row(
      children: [
        Flexible(
          child: Text(
            offer.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.manrope(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.2,
            ),
          ),
        ),
        if (_discountText.isNotEmpty) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
            decoration: BoxDecoration(color: const Color(0xFF9FF562), borderRadius: BorderRadius.circular(6)),
            child: Text(
              _discountText,
              maxLines: 1,
              style: GoogleFonts.manrope(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF0F2A0A)),
            ),
          ),
        ],
      ],
    );

    final actionRow = Row(
      children: [
        Expanded(
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: GuColors.lime,
              foregroundColor: const Color(0xFF082208),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              minimumSize: const Size(0, 34),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => _handleAction(context),
            child: Text('Claim Best Deal →', style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 12.5)),
          ),
        ),
        if (offer.couponCode != null && offer.couponCode!.isNotEmpty) ...[
          const SizedBox(width: 8),
          InkWell(
            onTap: () => _copyCoupon(context, offer.couponCode!),
            borderRadius: BorderRadius.circular(10),
            child: Container(
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
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
                  Icon(Icons.copy_rounded, size: 12, color: Colors.white.withValues(alpha: 0.8)),
                ],
              ),
            ),
          ),
        ],
      ],
    );

    final strip = Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [badges, titleRow, actionRow],
      ),
    );

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF071933), Color(0xFF0C2B53), Color(0xFF0A2F2B)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF003478).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasImage)
            AspectRatio(
              aspectRatio: kDealBannerRatio,
              child: GestureDetector(
                onTap: () => _handleAction(context),
                child: CachedNetworkImage(
                  imageUrl: offer.resolvedImageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (context, error, stackTrace) => const SizedBox(),
                ),
              ),
            ),
          Expanded(child: strip),
        ],
      ),
    );
  }
}
