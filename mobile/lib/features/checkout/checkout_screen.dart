import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key, required this.shareId});
  final String shareId;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int _step = 0;
  late int _qty;
  String _mode = 'upi';
  final _utr = TextEditingController();
  bool _loading = false;
  String? _sessionId;

  @override
  void initState() {
    super.initState();
    final share = context.read<CatalogProvider>().byId(widget.shareId);
    _qty = share?.minQty ?? 1;
    _sessionId = 'm-${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _utr.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    final share = context.read<CatalogProvider>().byId(widget.shareId);
    final user = context.read<AuthProvider>().user;
    if (share == null) return;
    if (!share.isPurchasable) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This share is not available for purchase')),
      );
      return;
    }
    if (user == null) {
      context.push('/auth?redirect=/checkout/${widget.shareId}');
      return;
    }
    if (_utr.text.trim().length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid UTR / payment reference')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await GuApi.instance.post('saveOrder', {
        'shareId': share.id,
        'shareName': share.name,
        'shareTicker': share.ticker,
        'qty': _qty,
        'pricePerShare': share.price,
        'method': _mode.toUpperCase(),
        'orderSource': 'Online',
        'transactionId': _utr.text.trim(),
        'paymentConfirmed': true,
        'sessionId': _sessionId,
        'buyerName': user.name,
        'buyerEmail': user.email,
        'buyerPhone': user.phone,
      });
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Order placed'),
          content: const Text(
            'Payment submitted. Complete KYC in Profile if needed — we transfer shares after verification.',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                context.go('/app/portfolio');
              },
              child: const Text('View portfolio'),
            ),
          ],
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final share = context.watch<CatalogProvider>().byId(widget.shareId);
    if (share == null) {
      return const Scaffold(body: Center(child: Text('Share not found')));
    }
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
    final total = share.price * _qty;
    final settings = context.watch<CatalogProvider>().settings;

    return Scaffold(
      appBar: AppBar(title: Text(_step == 0 ? 'Quantity' : _step == 1 ? 'Payment' : 'Confirm UTR')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(share.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          Text('${formatInr(share.price)} / share', style: const TextStyle(color: GuColors.muted)),
          const SizedBox(height: 20),
          if (_step == 0) ...[
            const Text('Quantity', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              decoration: BoxDecoration(
                color: GuColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: GuColors.border),
              ),
              child: Row(
                children: [
                  _QtyBtn(
                    icon: Icons.remove_rounded,
                    enabled: _qty > share.minQty,
                    onTap: () {
                      final next = _qty - share.minQty;
                      setState(() => _qty = next < share.minQty ? share.minQty : next);
                    },
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          '$_qty',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                        ),
                        Text(
                          'shares',
                          style: TextStyle(fontSize: 12, color: GuColors.muted.withValues(alpha: 0.9)),
                        ),
                      ],
                    ),
                  ),
                  _QtyBtn(
                    icon: Icons.add_rounded,
                    enabled: true,
                    onTap: () => setState(() => _qty += share.minQty),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Min lot ${share.minQty} · − / + changes by ${share.minQty}',
              style: const TextStyle(color: GuColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            _TotalRow(total: total),
            const SizedBox(height: 12),
            const Text(
              'You can pay now — complete KYC later before demat transfer.',
              style: TextStyle(color: GuColors.muted, fontSize: 13),
            ),
          ] else if (_step == 1) ...[
            ...['upi', 'neft', 'imps', 'qr'].map((m) {
              return RadioListTile<String>(
                value: m,
                groupValue: _mode,
                onChanged: (v) => setState(() => _mode = v!),
                title: Text(m.toUpperCase()),
                activeColor: GuColors.lime,
              );
            }),
            if (settings?.upiId != null) _CopyRow(label: 'UPI ID', value: settings!.upiId!),
            if (settings?.bankName != null) _CopyRow(label: 'Bank', value: settings!.bankName!),
            if (settings?.accountName != null) _CopyRow(label: 'Account name', value: settings!.accountName!),
            if (settings?.accountNumber != null) _CopyRow(label: 'Account no.', value: settings!.accountNumber!),
            if (settings?.ifsc != null) _CopyRow(label: 'IFSC', value: settings!.ifsc!),
            if (_mode == 'qr' && settings?.qrUrl != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  settings!.qrUrl!,
                  height: 200,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Text(
                    'QR unavailable — use UPI ID above',
                    style: TextStyle(color: GuColors.muted),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 8),
            _TotalRow(total: total),
          ] else ...[
            TextField(
              controller: _utr,
              decoration: const InputDecoration(
                labelText: 'UTR / Payment reference',
                hintText: 'Enter after you pay',
              ),
            ),
            const SizedBox(height: 12),
            _TotalRow(total: total),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: GuPrimaryButton(
            loading: _loading,
            label: _step == 0
                ? 'Continue to payment'
                : _step == 1
                    ? 'I\'ve paid — enter UTR'
                    : 'Confirm order',
            onPressed: () {
              if (_step < 2) {
                setState(() => _step++);
              } else {
                _placeOrder();
              }
            },
          ),
        ),
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  const _TotalRow({required this.total});
  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GuColors.limeSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Text('Total payable', style: TextStyle(fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(formatInr(total, decimals: true), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        ],
      ),
    );
  }
}

class _CopyRow extends StatelessWidget {
  const _CopyRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label, style: const TextStyle(fontSize: 12, color: GuColors.muted)),
      subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing: IconButton(
        icon: const Icon(Icons.copy_rounded, size: 18),
        onPressed: () {
          Clipboard.setData(ClipboardData(text: value));
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copied')));
        },
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
