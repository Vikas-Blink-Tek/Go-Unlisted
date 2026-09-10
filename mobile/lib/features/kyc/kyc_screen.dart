import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gu_widgets.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final _pan = TextEditingController();
  final _demat = TextEditingController();
  final _bank = TextEditingController();
  final _account = TextEditingController();
  final _ifsc = TextEditingController();
  bool _loading = false;
  bool _uploading = false;
  bool _loadingProof = false;
  String? _proofPath;
  Uint8List? _proofBytes;
  String? _proofContentType;

  @override
  void initState() {
    super.initState();
    final u = context.read<AuthProvider>().user;
    if (u != null) {
      _pan.text = u.kycPan ?? '';
      _demat.text = u.kycDemat ?? '';
      _bank.text = u.bankName ?? '';
      _account.text = u.bankAccount ?? '';
      _ifsc.text = u.ifsc ?? '';
      _proofPath = u.kycDematProof;
      if (u.hasDematProof) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _loadProofPreview());
      }
    }
  }

  @override
  void dispose() {
    _pan.dispose();
    _demat.dispose();
    _bank.dispose();
    _account.dispose();
    _ifsc.dispose();
    super.dispose();
  }

  Future<void> _loadProofPreview() async {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;
    setState(() => _loadingProof = true);
    try {
      final result = await GuApi.instance.fetchKycProof(
        userId: user.id,
        filePath: _proofPath,
      );
      if (!mounted) return;
      setState(() {
        _proofBytes = result.bytes;
        _proofContentType = result.contentType;
      });
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _loadingProof = false);
    }
  }

  Future<void> _pickAndUploadProof() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final bytes = file.bytes;
    if (!mounted) return;
    if (bytes == null || bytes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not read file. Try another document.')),
      );
      return;
    }
    if (bytes.length > 5 * 1024 * 1024) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('File must be under 5MB')),
      );
      return;
    }

    setState(() => _uploading = true);
    try {
      final res = await GuApi.instance.uploadProofBytes(
        bytes,
        filename: file.name.isEmpty ? 'cmr.jpg' : file.name,
      );
      final url = (res['url'] ?? '').toString();
      if (!mounted) return;
      setState(() {
        _proofPath = url.isEmpty ? _proofPath : url;
        _proofBytes = Uint8List.fromList(bytes);
        _proofContentType = file.extension?.toLowerCase() == 'pdf'
            ? 'application/pdf'
            : 'image/${file.extension ?? 'jpeg'}';
      });
      await context.read<AuthProvider>().refreshUser();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('CMR / demat proof uploaded'), backgroundColor: GuColors.limeDark),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    if (_proofPath == null || _proofPath!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload CMR / demat proof before submitting')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await GuApi.instance.post('updateKyc', {
        'pan': _pan.text.trim().toUpperCase(),
        'demat': _demat.text.trim(),
        'bankName': _bank.text.trim(),
        'bankAccount': _account.text.trim(),
        'ifsc': _ifsc.text.trim().toUpperCase(),
        'kycDematProof': _proofPath,
      });
      await context.read<AuthProvider>().refreshUser();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('KYC submitted for review'), backgroundColor: GuColors.limeDark),
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _isPdf => (_proofContentType ?? '').contains('pdf') || (_proofPath ?? '').toLowerCase().endsWith('.pdf');

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final verified = user?.isKycVerified == true;
    final reject = user?.kycRejectReason?.trim();

    return Scaffold(
      appBar: AppBar(title: const Text('KYC Verification')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: verified ? GuColors.limeSoft : const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              verified
                  ? 'KYC Verified — you\'re ready for demat transfers.'
                  : 'Status: ${user?.kycStatus ?? 'Not Submitted'}. Submit details anytime — buying is not blocked.',
              style: TextStyle(
                color: verified ? GuColors.limeDark : GuColors.warning,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (reject != null && reject.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('Rejection note: $reject', style: const TextStyle(color: Colors.red, fontSize: 13)),
          ],
          const SizedBox(height: 20),

          // Always show saved KYC details + document when present
          _sectionTitle('Your details'),
          _ReadonlyRow(label: 'PAN', value: user?.kycPan),
          _ReadonlyRow(label: 'Demat', value: user?.kycDemat),
          _ReadonlyRow(label: 'Bank', value: user?.bankName),
          _ReadonlyRow(label: 'Account', value: user?.bankAccount),
          _ReadonlyRow(label: 'IFSC', value: user?.ifsc),
          const SizedBox(height: 16),

          _sectionTitle('Uploaded documents'),
          const Text(
            'CMR / Client Master Report or demat screenshot from your broker.',
            style: TextStyle(color: GuColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 12),
          if (_loadingProof)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(color: GuColors.lime)),
            )
          else if (_proofBytes != null && !_isPdf)
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Image.memory(
                _proofBytes!,
                height: 220,
                width: double.infinity,
                fit: BoxFit.contain,
              ),
            )
          else if (_proofBytes != null && _isPdf)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: GuColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: GuColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.picture_as_pdf_rounded, color: GuColors.navy, size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _proofPath?.split('/').last ?? 'CMR document.pdf',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  TextButton(onPressed: _loadProofPreview, child: const Text('Reload')),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: GuColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: GuColors.border),
              ),
              child: const Text(
                'No document on file yet. Upload your CMR / demat proof below.',
                style: TextStyle(color: GuColors.muted),
              ),
            ),
          const SizedBox(height: 12),
          if (!verified)
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickAndUploadProof,
              icon: _uploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: GuColors.lime),
                    )
                  : const Icon(Icons.upload_file_rounded),
              label: Text(_proofPath == null ? 'Upload CMR / demat proof' : 'Replace document'),
            ),

          if (!verified) ...[
            const SizedBox(height: 28),
            _sectionTitle('Update & submit'),
            TextField(
              controller: _pan,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'PAN'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _demat,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
                LengthLimitingTextInputFormatter(16),
              ],
              decoration: const InputDecoration(labelText: 'Demat (16 letters/digits)'),
            ),
            const SizedBox(height: 12),
            TextField(controller: _bank, decoration: const InputDecoration(labelText: 'Bank name')),
            const SizedBox(height: 12),
            TextField(
              controller: _account,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Account number'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _ifsc,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: 'IFSC'),
            ),
            const SizedBox(height: 24),
            GuPrimaryButton(label: 'Submit for approval', loading: _loading, onPressed: _submit),
          ],
        ],
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(t, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
      );
}

class _ReadonlyRow extends StatelessWidget {
  const _ReadonlyRow({required this.label, required this.value});
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 88,
            child: Text(label, style: const TextStyle(color: GuColors.muted, fontSize: 13)),
          ),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
        ],
      ),
    );
  }
}
