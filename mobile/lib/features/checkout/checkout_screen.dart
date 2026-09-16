import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class _PayMode {
  const _PayMode({
    required this.id,
    required this.label,
    required this.desc,
    required this.icon,
  });
  final String id;
  final String label;
  final String desc;
  final IconData icon;
}

const _payModes = [
  _PayMode(
    id: 'neft',
    label: 'NEFT',
    desc: 'Transfer via NEFT to our bank account',
    icon: Icons.account_balance_rounded,
  ),
  _PayMode(
    id: 'imps',
    label: 'IMPS',
    desc: 'Instant bank transfer to our account',
    icon: Icons.bolt_rounded,
  ),
  _PayMode(
    id: 'upi',
    label: 'UPI Apps',
    desc: 'Copy UPI ID → pay in GPay / PhonePe / Paytm',
    icon: Icons.phone_android_rounded,
  ),
  _PayMode(
    id: 'qr',
    label: 'Scan QR Code',
    desc: 'Scan QR or pay using our UPI ID',
    icon: Icons.qr_code_2_rounded,
  ),
];

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
  String? _mode;
  final _utr = TextEditingController();
  bool _loading = false;
  String? _sessionId;

  @override
  void initState() {
    super.initState();
    final share = context.read<CatalogProvider>().byId(widget.shareId);
    _qty = share?.minQty ?? 1;
    _qtyCtrl = TextEditingController(text: '$_qty');
    _sessionId = 'm-${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _utr.dispose();
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
    if (_mode == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a payment method')),
      );
      return;
    }
    final utr = _utr.text.trim().toUpperCase().replaceAll(RegExp(r'\s+'), '');
    if (utr.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter the bank Transaction ID / UTR from payment SMS — not the UPI ID'),
        ),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final methodLabel = _payModes.firstWhere((m) => m.id == _mode).label;
      await GuApi.instance.post('saveOrder', {
        'shareId': share.id,
        'shareName': share.name,
        'shareTicker': share.ticker,
        'qty': _qty,
        'pricePerShare': share.price,
        'method': methodLabel,
        'orderSource': 'Online',
        'transactionId': utr,
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
    final title = _step == 0
        ? 'Quantity'
        : (_mode == null ? 'Payment' : 'Pay · ${_payModes.firstWhere((m) => m.id == _mode).label}');

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () {
            if (_step == 1 && _mode != null) {
              setState(() {
                _mode = null;
                _utr.clear();
              });
            } else if (_step > 0) {
              setState(() => _step = 0);
            } else {
              context.pop();
            }
          },
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Text(share.name, style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18)),
          Text(
            '${formatInr(share.price)} / share',
            style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 20),
          if (_step == 0) ...[
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
            _TotalRow(total: total),
            const SizedBox(height: 12),
            Text(
              'You can pay now — complete KYC later before demat transfer.',
              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
            ),
          ] else if (_mode == null) ...[
            Text(
              'Select Payment Method',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 20),
            ),
            const SizedBox(height: 4),
            Text(
              'Pay ${formatInr(total, decimals: true)} using any method below',
              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            ..._payModes.map((mode) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: GuColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => setState(() => _mode = mode.id),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: GuColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: GuColors.limeSoft,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(mode.icon, color: GuColors.limeDark),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  mode.label,
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  mode.desc,
                                  style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded, color: GuColors.muted),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
            const SizedBox(height: 8),
            _TotalRow(total: total),
          ] else ...[
            _PaymentInstructions(
              mode: _mode!,
              settings: settings,
              total: total,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _utr,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                LengthLimitingTextInputFormatter(30),
              ],
              onChanged: (v) {
                final next = v.toUpperCase().replaceAll(RegExp(r'\s+'), '');
                if (next != v) {
                  _utr.value = TextEditingValue(
                    text: next,
                    selection: TextSelection.collapsed(offset: next.length),
                  );
                }
              },
              decoration: const InputDecoration(
                labelText: 'Transaction ID / UTR *',
                hintText: 'e.g. 312345678901 from GPay / bank SMS',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Paste the Transaction ID / UTR from GPay / PhonePe / bank SMS (not our UPI ID). Confirm to submit your order for verification.',
              style: GoogleFonts.inter(color: GuColors.muted, fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => setState(() {
                _mode = null;
                _utr.clear();
              }),
              child: const Text('← Change method'),
            ),
            const SizedBox(height: 8),
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
                : _mode == null
                    ? 'Select a method above'
                    : 'Confirm payment & place order',
            onPressed: _step == 0
                ? () {
                    _commitQtyInput(minQty: share.minQty);
                    final user = context.read<AuthProvider>().user;
                    if (user == null) {
                      context.push('/auth?redirect=/checkout/${widget.shareId}');
                      return;
                    }
                    setState(() => _step = 1);
                  }
                : _mode == null
                    ? null
                    : _placeOrder,
          ),
        ),
      ),
    );
  }
}

class _PaymentInstructions extends StatelessWidget {
  const _PaymentInstructions({
    required this.mode,
    required this.settings,
    required this.total,
  });

  final String mode;
  final GuSettings? settings;
  final double total;

  @override
  Widget build(BuildContext context) {
    if (mode == 'neft' || mode == 'imps') {
      final label = mode == 'neft' ? 'NEFT' : 'IMPS';
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Transfer the exact amount via $label to the account below. Use your registered bank account only.',
            style: GoogleFonts.inter(fontSize: 13, height: 1.45, color: GuColors.text),
          ),
          const SizedBox(height: 14),
          _BankDetailsCard(settings: settings, total: total),
        ],
      );
    }

    if (mode == 'upi') {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PayStepList(
            steps: [
              'Copy our UPI ID below.',
              'Open GPay, PhonePe, or Paytm and send ${formatInr(total, decimals: true)} to that UPI ID.',
              'After payment, enter the Transaction ID / UTR below and tap Confirm payment & place order.',
            ],
          ),
          const SizedBox(height: 14),
          _UpiIdCard(settings: settings, total: total),
        ],
      );
    }

    // QR
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PayStepList(
          steps: [
            'Scan the QR in any UPI app, or copy the UPI ID.',
            'Pay ${formatInr(total, decimals: true)} to ${settings?.accountName ?? 'GO UNLISTED'}.',
            'Enter the Transaction ID / UTR below to complete your order.',
          ],
        ),
        const SizedBox(height: 14),
        if (settings?.qrUrl != null)
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                settings!.qrUrl!,
                height: 220,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => Text(
                  'QR unavailable — use UPI ID below',
                  style: GoogleFonts.inter(color: GuColors.muted),
                ),
              ),
            ),
          ),
        const SizedBox(height: 12),
        _UpiIdCard(settings: settings, total: total),
      ],
    );
  }
}

class _PayStepList extends StatelessWidget {
  const _PayStepList({required this.steps});
  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < steps.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${i + 1}.',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: GuColors.limeDark,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  steps[i],
                  style: GoogleFonts.inter(fontSize: 13, height: 1.45, color: GuColors.text),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _BankDetailsCard extends StatelessWidget {
  const _BankDetailsCard({required this.settings, required this.total});
  final GuSettings? settings;
  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bank Account Details',
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 15),
          ),
          const SizedBox(height: 8),
          if (settings?.bankName != null) _CopyRow(label: 'Bank Name', value: settings!.bankName!),
          if (settings?.accountName != null) _CopyRow(label: 'Account Name', value: settings!.accountName!),
          if (settings?.accountNumber != null) _CopyRow(label: 'Account No.', value: settings!.accountNumber!),
          if (settings?.ifsc != null) _CopyRow(label: 'IFSC Code', value: settings!.ifsc!),
          if (settings?.branch != null) _CopyRow(label: 'Branch', value: settings!.branch!),
          const SizedBox(height: 8),
          _AmountBox(total: total),
        ],
      ),
    );
  }
}

class _UpiIdCard extends StatelessWidget {
  const _UpiIdCard({required this.settings, this.total});
  final GuSettings? settings;
  final double? total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GuColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: GuColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Merchant UPI', style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted)),
          if (settings?.accountName != null) ...[
            const SizedBox(height: 4),
            Text(
              settings!.accountName!,
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
            ),
          ],
          if (settings?.upiId != null) ...[
            const SizedBox(height: 8),
            SelectableText(
              settings!.upiId!,
              style: GoogleFonts.robotoMono(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: settings!.upiId!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('UPI ID copied — open GPay / PhonePe and pay')),
                );
              },
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: const Text('Copy UPI ID'),
            ),
          ],
          if (total != null) ...[
            const SizedBox(height: 12),
            _AmountBox(total: total!),
          ],
        ],
      ),
    );
  }
}

class _AmountBox extends StatelessWidget {
  const _AmountBox({required this.total});
  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: GuColors.limeSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Text('Transfer exactly', style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted)),
          const Spacer(),
          Text(
            formatInr(total, decimals: true),
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18),
          ),
        ],
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
          Text('Total payable', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(
            formatInr(total, decimals: true),
            style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18),
          ),
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
      dense: true,
      title: Text(label, style: GoogleFonts.inter(fontSize: 12, color: GuColors.muted)),
      subtitle: Text(value, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
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
