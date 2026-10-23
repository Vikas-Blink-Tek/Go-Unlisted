import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

/// Server-priced Razorpay order — the exact amount the buyer will be charged.
class _Quote {
  _Quote(Map<String, dynamic> j)
      : orderId = j['order_id'].toString(),
        amountPaise = (j['amount'] as num).toInt(),
        currency = (j['currency'] ?? 'INR').toString(),
        keyId = j['key_id'].toString(),
        shareName = (j['summary']?['share_name'] ?? '').toString(),
        qty = (j['summary']?['qty'] as num?)?.toInt() ?? 0,
        pricePerShare = (j['summary']?['price_per_share'] as num?)?.toDouble() ?? 0,
        basePrice = (j['summary']?['base_price'] as num?)?.toDouble() ?? 0,
        subtotal = (j['summary']?['subtotal'] as num?)?.toDouble() ?? 0,
        charges = [
          for (final c in (j['summary']?['charges'] as List? ?? const []))
            (name: c['name'].toString(), amount: (c['amount'] as num).toDouble()),
        ];

  final String orderId;
  final int amountPaise;
  final String currency;
  final String keyId;
  final String shareName;
  final int qty;
  final double pricePerShare;
  final double basePrice;
  final double subtotal;
  final List<({String name, double amount})> charges;

  double get total => amountPaise / 100;
  double get savings => (basePrice - pricePerShare) * qty;
}

enum _PayStatus { idle, paying, verifying, cancelled, failed }

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.shareId});
  final String shareId;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int _step = 0;
  late int _qty;
  late final TextEditingController _qtyCtrl;
  late final Razorpay _razorpay;
  late final String _sessionId;
  _Quote? _quote;
  String? _quoteError;
  _PayStatus _status = _PayStatus.idle;
  String _failure = '';
  String _orderId = '';
  String _paymentId = '';

  bool get _busy => _status == _PayStatus.paying || _status == _PayStatus.verifying;

  @override
  void initState() {
    super.initState();
    final share = context.read<CatalogProvider>().byId(widget.shareId);
    _qty = share?.minQty ?? 1;
    _qtyCtrl = TextEditingController(text: '$_qty');
    _sessionId = 'm-${DateTime.now().millisecondsSinceEpoch}';
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    _qtyCtrl.dispose();
    super.dispose();
  }

  void _setQty(int value, {required int minQty}) {
    final next = value < minQty ? minQty : value;
    setState(() => _qty = next);
    final text = '$next';
    if (_qtyCtrl.text != text) {
      _qtyCtrl.value = TextEditingValue(
        text: text,
        selection: TextSelection.collapsed(offset: text.length),
      );
    }
  }

  void _commitQtyInput({required int minQty}) {
    final parsed = int.tryParse(_qtyCtrl.text.trim());
    if (parsed == null || parsed < minQty) {
      _setQty(minQty, minQty: minQty);
      return;
    }
    _setQty(parsed, minQty: minQty);
  }

  /// Same bulk-tier rule as the website and server.
  double _priceFor(GuShare share, int qty) {
    final tiers = [...share.discountTiers]..sort((a, b) => b.minQty.compareTo(a.minQty));
    for (final t in tiers) {
      if (qty >= t.minQty) return t.price;
    }
    return share.price;
  }

  Future<void> _loadQuote() async {
    setState(() {
      _quote = null;
      _quoteError = null;
    });
    try {
      final res = await GuApi.instance.post('razorpayCreateOrder', {
        'shareId': widget.shareId,
        'qty': _qty,
      });
      if (mounted) setState(() => _quote = _Quote(res));
    } on ApiException catch (e) {
      if (mounted) setState(() => _quoteError = e.message);
    } catch (_) {
      if (mounted) setState(() => _quoteError = 'Could not load payment details. Check your internet and try again.');
    }
  }

  void _goToPayment(GuShare share) {
    _commitQtyInput(minQty: share.minQty);
    final user = context.read<AuthProvider>().user;
    if (user == null) {
      context.push('/auth?redirect=/checkout/${widget.shareId}');
      return;
    }
    setState(() {
      _step = 1;
      _status = _PayStatus.idle;
    });
    _loadQuote();
    final price = _priceFor(share, _qty);
    GuApi.instance.post('saveInitiatedCheckout', {
      'sessionId': _sessionId,
      'shareId': share.id,
      'shareName': share.name,
      'shareTicker': share.ticker,
      'buyerName': user.name,
      'buyerEmail': user.email,
      'buyerPhone': user.phone,
      'qty': _qty,
      'pricePerShare': price,
      'totalAmount': price * _qty,
      'paymentMode': 'Razorpay',
    }).catchError((_) => <String, dynamic>{}); // tracking only — never blocks checkout
  }

  void _openRazorpay() {
    final quote = _quote;
    final user = context.read<AuthProvider>().user;
    if (quote == null || user == null) return;
    setState(() => _status = _PayStatus.paying);
    _razorpay.open({
      'key': quote.keyId,
      'amount': quote.amountPaise,
      'currency': quote.currency,
      'order_id': quote.orderId,
      'name': 'GO UNLISTED',
      'description': '${quote.qty} × ${quote.shareName}',
      'prefill': {'name': user.name, 'email': user.email, 'contact': user.phone},
      'theme': {'color': '#0072BC'},
      'retry': {'enabled': true, 'max_count': 3},
    });
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse r) async {
    final share = context.read<CatalogProvider>().byId(widget.shareId);
    final user = context.read<AuthProvider>().user;
    final quote = _quote;
    final paymentId = r.paymentId ?? '';
    setState(() => _status = _PayStatus.verifying);
    try {
      // Server checks the Razorpay signature before creating the order
      final res = await GuApi.instance.post('saveOrder', {
        'shareId': widget.shareId,
        'shareName': share?.name ?? quote?.shareName ?? '',
        'shareTicker': share?.ticker ?? '',
        'qty': quote?.qty ?? _qty,
        'orderSource': 'Online',
        'buyerName': user?.name ?? '',
        'buyerEmail': user?.email ?? '',
        'buyerPhone': user?.phone ?? '',
        'razorpayPaymentId': paymentId,
        'razorpayOrderId': r.orderId ?? '',
        'razorpaySignature': r.signature ?? '',
      });
      GuApi.instance.post('deleteInitiatedCheckout', {'sessionId': _sessionId}).catchError((_) => <String, dynamic>{});
      if (!mounted) return;
      setState(() {
        _orderId = (res['orderId'] ?? '').toString();
        _paymentId = paymentId;
        _status = _PayStatus.idle;
        _step = 2;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : 'Could not confirm your order.';
      setState(() {
        _status = _PayStatus.failed;
        _failure = msg.contains(paymentId)
            ? msg
            : '$msg Your payment ID is $paymentId — share it with support and we will place your order.';
      });
    }
  }

  void _onPaymentError(PaymentFailureResponse r) {
    if (!mounted) return;
    if (r.code == Razorpay.PAYMENT_CANCELLED) {
      setState(() => _status = _PayStatus.cancelled);
      return;
    }
    setState(() {
      _status = _PayStatus.failed;
      _failure = _readableError(r);
    });
  }

  void _onExternalWallet(ExternalWalletResponse r) {
    if (!mounted) return;
    setState(() => _status = _PayStatus.idle);
  }

  /// Android SDK sends the Razorpay error as a JSON string — pull out its description.
  String _readableError(PaymentFailureResponse r) {
    final raw = r.message ?? '';
    try {
      final parsed = jsonDecode(raw);
      final err = parsed is Map ? parsed['error'] : null;
      final desc = err is Map ? err['description'] : null;
      if (desc is String && desc.isNotEmpty) return desc;
    } catch (_) {
      // Not JSON — use as-is
    }
    if (r.code == Razorpay.NETWORK_ERROR) return 'Network error. Check your internet and try again.';
    return raw.isNotEmpty ? raw : 'Payment failed. Please try again.';
  }

  void _back() {
    if (_busy) return;
    if (_step == 1) {
      setState(() {
        _step = 0;
        _quote = null;
      });
    } else {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final share = context.watch<CatalogProvider>().byId(widget.shareId);
    if (share == null) {
      return const Scaffold(body: Center(child: Text('Share not found')));
    }
    if (_step == 2) return _buildSuccess(share);
    if (!share.isPurchasable) {
      return Scaffold(
        appBar: AppBar(title: const Text('Checkout')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(share.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 12),
              Text(
                share.isExchangeListed
                    ? 'This company is exchange-listed. GO UNLISTED only offers unlisted & pre-IPO shares — purchase is not available.'
                    : 'This share is not available for purchase right now.',
                style: const TextStyle(color: GuColors.muted, height: 1.45),
              ),
              const SizedBox(height: 24),
              GuPrimaryButton(
                label: 'Back to shares',
                onPressed: () => context.go('/app/shares'),
              ),
            ],
          ),
        ),
      );
    }

    final price = _priceFor(share, _qty);
    final quote = _quote;

    return PopScope(
      canPop: _step == 0 && !_busy,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Stack(
        children: [
          Scaffold(
            appBar: AppBar(
              title: Text(_step == 0 ? 'Quantity' : 'Review & Pay'),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: _busy ? null : _back,
              ),
            ),
            body: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _StepDots(step: _step),
                const SizedBox(height: 18),
                Text(share.name, style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18)),
                Text(
                  '${formatInr(price)} / share',
                  style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
                ),
                const SizedBox(height: 20),
                if (_step == 0) ..._buildQuantity(share, price) else ..._buildReview(quote),
              ],
            ),
            bottomNavigationBar: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: _step == 0
                    ? GuPrimaryButton(label: 'Continue to payment', onPressed: () => _goToPayment(share))
                    : GuPrimaryButton(
                        loading: _busy,
                        label: quote == null
                            ? 'Preparing payment…'
                            : (_status == _PayStatus.failed || _status == _PayStatus.cancelled)
                                ? 'Retry · ${formatInr(quote.total, decimals: true)}'
                                : 'Pay ${formatInr(quote.total, decimals: true)}',
                        onPressed: quote == null ? null : _openRazorpay,
                      ),
              ),
            ),
          ),
          if (_status == _PayStatus.verifying) const _VerifyingOverlay(),
        ],
      ),
    );
  }

  List<Widget> _buildQuantity(GuShare share, double price) {
    final value = price * _qty;
    final savings = (share.price - price) * _qty;
    return [
      Text('No. Of Shares', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      const SizedBox(height: 12),
      TextField(
        controller: _qtyCtrl,
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.done,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(8),
        ],
        style: GoogleFonts.manrope(fontSize: 28, fontWeight: FontWeight.w800, height: 1.1),
        textAlign: TextAlign.center,
        decoration: InputDecoration(
          hintText: 'Enter quantity',
          filled: true,
          fillColor: GuColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: GuColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: GuColors.limeDark, width: 1.5),
          ),
          suffixText: 'shares',
          suffixStyle: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
        ),
        onChanged: (v) {
          final parsed = int.tryParse(v.trim());
          if (parsed != null && parsed >= share.minQty) {
            setState(() => _qty = parsed);
          }
        },
        onEditingComplete: () {
          _commitQtyInput(minQty: share.minQty);
          FocusScope.of(context).unfocus();
        },
        onTapOutside: (_) {
          _commitQtyInput(minQty: share.minQty);
          FocusScope.of(context).unfocus();
        },
      ),
      const SizedBox(height: 10),
      Row(
        children: [
          _QtyBtn(
            icon: Icons.remove_rounded,
            enabled: _qty > share.minQty,
            onTap: () => _setQty(_qty - 1, minQty: share.minQty),
          ),
          const SizedBox(width: 10),
          _QtyBtn(
            icon: Icons.add_rounded,
            enabled: true,
            onTap: () => _setQty(_qty + 1, minQty: share.minQty),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Minimum purchase quantity is ${share.minQty} shares.',
              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12, height: 1.35),
            ),
          ),
        ],
      ),
      const SizedBox(height: 16),
      _Card(
        children: [
          _Row(label: 'Shares value ($_qty × ${formatInr(share.price, decimals: true)})', value: formatInr(share.price * _qty, decimals: true)),
          if (savings > 0)
            _Row(label: 'Bulk discount', value: '− ${formatInr(savings, decimals: true)}', valueColor: GuColors.limeDark),
          const Divider(height: 16),
          _Row(label: 'Subtotal', value: formatInr(value, decimals: true)),
          const SizedBox(height: 4),
          Text(
            'Any platform fees are shown on the next step before you pay.',
            style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12),
          ),
        ],
      ),
      const SizedBox(height: 12),
      Text(
        'You can pay now — complete KYC later before demat transfer.',
        style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
      ),
    ];
  }

  List<Widget> _buildReview(_Quote? quote) {
    if (_quoteError != null) {
      return [
        _Banner(
          error: true,
          title: 'Could not start payment',
          message: _quoteError!,
          action: TextButton(onPressed: _loadQuote, child: const Text('Try again')),
        ),
      ];
    }
    if (quote == null) {
      return const [
        Padding(
          padding: EdgeInsets.symmetric(vertical: 48),
          child: Column(
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 14),
              Text('Preparing secure payment…', style: TextStyle(color: GuColors.muted)),
            ],
          ),
        ),
      ];
    }
    return [
      _Card(
        children: [
          Text(
            'ORDER SUMMARY',
            style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: GuColors.muted),
          ),
          const SizedBox(height: 10),
          _Row(
            label: 'Shares value (${quote.qty} × ${formatInr(quote.basePrice, decimals: true)})',
            value: formatInr(quote.subtotal + (quote.savings > 0 ? quote.savings : 0), decimals: true),
          ),
          if (quote.savings > 0)
            _Row(
              label: 'Bulk discount applied',
              value: '− ${formatInr(quote.savings, decimals: true)}',
              valueColor: GuColors.limeDark,
            ),
          for (final c in quote.charges) _Row(label: c.name, value: formatInr(c.amount, decimals: true)),
          const Divider(height: 20),
          Row(
            children: [
              Text('Total payable', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(
                formatInr(quote.total, decimals: true),
                style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 22, color: GuColors.ink),
              ),
            ],
          ),
        ],
      ),
      if (_status == _PayStatus.failed) ...[
        const SizedBox(height: 14),
        _Banner(error: true, title: 'Payment not completed', message: _failure),
      ],
      if (_status == _PayStatus.cancelled) ...[
        const SizedBox(height: 14),
        const _Banner(message: 'Payment cancelled. No money was deducted — tap Retry to pay.'),
      ],
      const SizedBox(height: 18),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('Pay with', style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12)),
          for (final m in const ['UPI', 'Cards', 'Netbanking', 'Wallets'])
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: GuColors.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: GuColors.border),
              ),
              child: Text(m, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
      const SizedBox(height: 16),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock_rounded, size: 14, color: GuColors.muted),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              '100% secure payment by Razorpay. Order confirmed instantly.',
              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12),
            ),
          ),
        ],
      ),
    ];
  }

  Widget _buildSuccess(GuShare share) {
    final quote = _quote;
    final user = context.watch<AuthProvider>().user;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go('/app/portfolio');
      },
      child: Scaffold(
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
            children: [
              Center(
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: const BoxDecoration(shape: BoxShape.circle, gradient: GuColors.brandGradient),
                  child: const Icon(Icons.check_rounded, color: Colors.white, size: 48),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Payment successful!',
                textAlign: TextAlign.center,
                style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 24),
              ),
              const SizedBox(height: 8),
              Text(
                'Your order is confirmed. Shares show in your portfolio while we complete the demat transfer.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: GuColors.muted, height: 1.45),
              ),
              const SizedBox(height: 24),
              _Card(
                children: [
                  _Row(label: 'Order ID', value: _orderId, copy: true),
                  _Row(label: 'Company', value: share.name),
                  if (quote != null) _Row(label: 'Quantity', value: '${quote.qty} shares'),
                  if (quote != null) _Row(label: 'Amount paid', value: formatInr(quote.total, decimals: true)),
                  _Row(label: 'Payment ID', value: _paymentId, copy: true),
                  const _Row(label: 'Status', value: 'Share transfer pending', valueColor: GuColors.blue),
                ],
              ),
              if (user != null && !user.isKycVerified) ...[
                const SizedBox(height: 14),
                const _Banner(message: 'Complete your KYC in Profile so we can transfer the shares to your demat account.'),
              ],
              const SizedBox(height: 24),
              GuPrimaryButton(label: 'View portfolio', onPressed: () => context.go('/app/portfolio')),
              const SizedBox(height: 8),
              TextButton(onPressed: () => context.go('/app/shares'), child: const Text('Continue exploring')),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepDots extends StatelessWidget {
  const _StepDots({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    const labels = ['Quantity', 'Review & Pay', 'Done'];
    return Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Expanded(child: Container(height: 2, color: i <= step ? GuColors.limeDark : GuColors.border)),
          Column(
            children: [
              CircleAvatar(
                radius: 12,
                backgroundColor: i <= step ? GuColors.limeDark : GuColors.border,
                child: i < step
                    ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                    : Text('${i + 1}', style: TextStyle(fontSize: 12, color: i == step ? Colors.white : GuColors.muted)),
              ),
              const SizedBox(height: 4),
              Text(labels[i], style: GoogleFonts.inter(fontSize: 11, color: i == step ? GuColors.ink : GuColors.muted)),
            ],
          ),
        ],
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.valueColor, this.copy = false});
  final String label;
  final String value;
  final Color? valueColor;
  final bool copy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13))),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13, color: valueColor ?? GuColors.ink),
            ),
          ),
          if (copy && value.isNotEmpty)
            InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copied')));
              },
              child: const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Icon(Icons.copy_rounded, size: 16, color: GuColors.muted),
              ),
            ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.message, this.title, this.error = false, this.action});
  final String message;
  final String? title;
  final bool error;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final color = error ? GuColors.danger : GuColors.blue;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Text(title!, style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: color)),
          if (title != null) const SizedBox(height: 4),
          Text(message, style: GoogleFonts.inter(fontSize: 13, height: 1.45, color: GuColors.text)),
          ?action,
        ],
      ),
    );
  }
}

class _VerifyingOverlay extends StatelessWidget {
  const _VerifyingOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black54,
        child: Center(
          child: Material(
            color: GuColors.surface,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text('Confirming your payment…', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text("Please don't close the app.", style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  const _QtyBtn({required this.icon, required this.enabled, required this.onTap});
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? GuColors.limeSoft : GuColors.border.withValues(alpha: 0.35),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: 52,
          height: 52,
          child: Icon(
            icon,
            size: 26,
            color: enabled ? GuColors.limeDark : GuColors.muted,
          ),
        ),
      ),
    );
  }
}
