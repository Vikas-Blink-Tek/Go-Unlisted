import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_config.dart';
import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';

class _Article {
  _Article({
    required this.title,
    required this.slug,
    required this.imageUrl,
    required this.category,
    required this.createdAt,
  });

  final String title;
  final String slug;
  final String imageUrl;
  final String category;
  final DateTime? createdAt;

  factory _Article.fromJson(Map<String, dynamic> j) => _Article(
        title: (j['title'] ?? '').toString(),
        slug: (j['slug'] ?? '').toString(),
        imageUrl: ApiConfig.resolveMediaUrl(j['image_url']?.toString()),
        category: (j['category'] ?? '').toString(),
        createdAt: DateTime.tryParse((j['created_at'] ?? '').toString().replaceFirst(' ', 'T')),
      );
}

/// News tab — the same published articles as the website's /articles page.
class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  List<_Article> _articles = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await GuApi.instance.get('getArticles');
      final raw = res['data'];
      final list = raw is List ? raw : const [];
      _articles = list
          .whereType<Map>()
          .map((e) => _Article.fromJson(Map<String, dynamic>.from(e)))
          .where((a) => a.title.isNotEmpty && a.slug.isNotEmpty)
          .toList();
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'Could not load news. Pull down to retry.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(_Article a) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/articles/${Uri.encodeComponent(a.slug)}');
    await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
  }

  String _date(DateTime? d) {
    if (d == null) return '';
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${m[d.month - 1]} ${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GuColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: GuColors.limeDark,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            children: [
              Text(
                'News',
                style: GoogleFonts.manrope(fontSize: 24, fontWeight: FontWeight.w800, color: GuColors.ink),
              ),
              const SizedBox(height: 4),
              Text(
                'Updates on unlisted & pre-IPO companies',
                style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted),
              ),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.only(top: 60),
                  child: Center(child: CircularProgressIndicator(color: GuColors.limeDark)),
                )
              else if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text(_error!, textAlign: TextAlign.center, style: GoogleFonts.inter(color: GuColors.muted)),
                )
              else if (_articles.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 40),
                  child: Text('No news yet.', textAlign: TextAlign.center, style: GoogleFonts.inter(color: GuColors.muted)),
                )
              else
                ..._articles.map((a) => _ArticleTile(article: a, date: _date(a.createdAt), onTap: () => _open(a))),
            ],
          ),
        ),
      ),
    );
  }
}

class _ArticleTile extends StatelessWidget {
  const _ArticleTile({required this.article, required this.date, required this.onTap});

  final _Article article;
  final String date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final meta = [article.category, date].where((s) => s.isNotEmpty).join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: GuColors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 84,
                    height: 64,
                    child: article.imageUrl.isEmpty
                        ? Container(
                            color: GuColors.limeSoft,
                            child: const Icon(Icons.article_outlined, color: GuColors.limeDark),
                          )
                        : CachedNetworkImage(
                            imageUrl: article.imageUrl,
                            fit: BoxFit.cover,
                            errorWidget: (context, error, stackTrace) => Container(color: GuColors.limeSoft),
                          ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        article.title,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.manrope(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: GuColors.ink,
                          height: 1.3,
                        ),
                      ),
                      if (meta.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(meta, style: GoogleFonts.inter(fontSize: 11.5, color: GuColors.muted)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
