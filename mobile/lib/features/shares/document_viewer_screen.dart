import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:pdfx/pdfx.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/gu_theme.dart';

/// Shows an uploaded document (company balance sheet) inside the app.
/// Handing an https PDF link to Android often fails ("can't open file" / Chrome just downloads it),
/// so PDFs are downloaded and rendered here; images are shown with pinch-zoom.
class DocumentViewerScreen extends StatefulWidget {
  const DocumentViewerScreen({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<DocumentViewerScreen> createState() => _DocumentViewerScreenState();
}

class _DocumentViewerScreenState extends State<DocumentViewerScreen> {
  PdfControllerPinch? _pdf;
  String? _error;

  bool get _isImage => RegExp(r'\.(jpe?g|png|webp)$', caseSensitive: false).hasMatch(Uri.parse(widget.url).path);

  @override
  void initState() {
    super.initState();
    if (!_isImage) _loadPdf();
  }

  @override
  void dispose() {
    _pdf?.dispose();
    super.dispose();
  }

  Future<void> _loadPdf() async {
    setState(() => _error = null);
    try {
      final res = await http.get(Uri.parse(widget.url)).timeout(const Duration(seconds: 60));
      final bytes = res.bodyBytes;
      final isPdf = bytes.length > 4 && String.fromCharCodes(bytes.sublist(0, 4)) == '%PDF';
      if (res.statusCode != 200 || !isPdf) {
        throw Exception('HTTP ${res.statusCode}');
      }
      if (!mounted) return;
      setState(() => _pdf = PdfControllerPinch(document: PdfDocument.openData(bytes)));
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load the balance sheet. Check your internet and try again.');
    }
  }

  Future<void> _openInBrowser() async {
    final ok = await launchUrl(Uri.parse(widget.url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No app found to open this file.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Open in browser',
            icon: const Icon(Icons.open_in_new_rounded),
            onPressed: _openInBrowser,
          ),
        ],
      ),
      backgroundColor: const Color(0xFFF1F5F9),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isImage) {
      return InteractiveViewer(
        maxScale: 6,
        child: Center(
          child: Image.network(
            widget.url,
            loadingBuilder: (_, child, progress) =>
                progress == null ? child : const Center(child: CircularProgressIndicator()),
            errorBuilder: (_, _, _) => _ErrorView(
              message: 'Could not load the balance sheet image.',
              onRetry: () => setState(() {}),
              onOpenInBrowser: _openInBrowser,
            ),
          ),
        ),
      );
    }
    if (_error != null) {
      return _ErrorView(message: _error!, onRetry: _loadPdf, onOpenInBrowser: _openInBrowser);
    }
    final pdf = _pdf;
    if (pdf == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 14),
            Text('Loading balance sheet…', style: GoogleFonts.inter(color: GuColors.muted)),
          ],
        ),
      );
    }
    return Stack(
      children: [
        PdfViewPinch(
          controller: pdf,
          onDocumentError: (_) => setState(() {
            _pdf = null;
            _error = 'This file could not be displayed. Try opening it in the browser.';
          }),
        ),
        Positioned(
          bottom: 16,
          left: 0,
          right: 0,
          child: Center(
            child: ValueListenableBuilder<int>(
              valueListenable: pdf.pageListenable,
              builder: (_, page, _) => pdf.pagesCount == null
                  ? const SizedBox.shrink()
                  : Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(999)),
                      child: Text(
                        'Page $page of ${pdf.pagesCount}',
                        style: GoogleFonts.inter(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry, required this.onOpenInBrowser});

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onOpenInBrowser;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.description_outlined, size: 48, color: GuColors.muted),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: GoogleFonts.inter(color: GuColors.text, height: 1.4)),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
            TextButton(onPressed: onOpenInBrowser, child: const Text('Open in browser')),
          ],
        ),
      ),
    );
  }
}
