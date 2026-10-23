import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Outcome of the QR checkout: [success] when paid, otherwise [error] (empty = buyer just closed it).
typedef RazorpayQrResult = ({PaymentSuccessResponse? success, String error});

/// Razorpay's native Android SDK never shows UPI QR on a phone, but its web checkout does.
/// This screen runs the web checkout (UPI QR first) for buyers paying from another phone.
class RazorpayQrScreen extends StatefulWidget {
  const RazorpayQrScreen({super.key, required this.options});

  /// Same options as the native checkout (key, amount, order_id, prefill…).
  final Map<String, dynamic> options;

  @override
  State<RazorpayQrScreen> createState() => _RazorpayQrScreenState();
}

class _RazorpayQrScreenState extends State<RazorpayQrScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    final options = {
      ...widget.options,
      // Tested on mobile web: a QR-only block is rejected ("No appropriate payment method"), but
      // qrcode + intent + collect with other methods hidden shows UPI QR at the top, UPI apps below.
      'config': {
        'display': {
          'blocks': {
            'upi': {
              'name': 'Pay via UPI',
              'instruments': [
                {
                  'method': 'upi',
                  'flows': ['qrcode', 'intent', 'collect'],
                },
              ],
            },
          },
          'sequence': ['block.upi'],
          'hide': [
            for (final m in ['card', 'netbanking', 'wallet', 'paylater', 'emi', 'cardless_emi']) {'method': m},
          ],
          'preferences': {'show_default_blocks': true},
        },
      },
    };
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel('RzpBridge', onMessageReceived: _onMessage)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loading = false);
        },
        // GPay / PhonePe buttons use upi:// or intent:// links — hand them to the phone's UPI app
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          if (uri == null || uri.scheme == 'http' || uri.scheme == 'https' || uri.scheme == 'about') {
            return NavigationDecision.navigate;
          }
          launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ))
      ..loadHtmlString(_html(jsonEncode(options)), baseUrl: 'https://go-unlisted.com');
  }

  String _html(String optionsJson) => '''
<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head><body style="margin:0;background:#fff">
<script>
  function send(msg) { RzpBridge.postMessage(JSON.stringify(msg)); }
  var lastError = '';
  var s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onerror = function () { send({ type: 'closed', error: 'Could not load Razorpay. Check your internet and try again.' }); };
  s.onload = function () {
    var o = $optionsJson;
    o.handler = function (r) { send({ type: 'paid', data: r }); };
    o.modal = { ondismiss: function () { send({ type: 'closed', error: lastError }); } };
    var rzp = new Razorpay(o);
    rzp.on('payment.failed', function (r) { lastError = (r.error && r.error.description) || 'Payment failed'; });
    rzp.open();
  };
  document.head.appendChild(s);
</script>
</body></html>''';

  void _onMessage(JavaScriptMessage message) {
    if (_done || !mounted) return;
    final msg = jsonDecode(message.message) as Map<String, dynamic>;
    _done = true;
    if (msg['type'] == 'paid') {
      final data = Map<dynamic, dynamic>.from(msg['data'] as Map);
      Navigator.of(context).pop<RazorpayQrResult>((success: PaymentSuccessResponse.fromMap(data), error: ''));
    } else {
      Navigator.of(context).pop<RazorpayQrResult>((success: null, error: (msg['error'] ?? '').toString()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pay by UPI QR')),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
