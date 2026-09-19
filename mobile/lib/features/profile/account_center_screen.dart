import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import 'profile_widgets.dart';

class AccountCenterScreen extends StatefulWidget {
  const AccountCenterScreen({super.key});

  @override
  State<AccountCenterScreen> createState() => _AccountCenterScreenState();
}

class _AccountCenterScreenState extends State<AccountCenterScreen> {
  Future<_Contacts?>? _contactsFuture;

  @override
  void initState() {
    super.initState();
    _contactsFuture = _load();
  }

  Future<_Contacts?> _load() async {
    try {
      final res = await GuApi.instance.get('getAccountContacts');
      return _Contacts.fromJson(res);
    } catch (_) {
      return null;
    }
  }

  Future<void> _call(String? phone) async {
    final uri = indianPhoneTelUri(phone);
    if (uri == null) return;
    await launchUrl(uri);
  }

  Future<void> _whatsapp(String? phone) async {
    final uri = whatsappUri(phone, message: 'Hi, I need help with my Go-Unlisted account.');
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _showAccountDetails(BuildContext context, dynamic user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: GuColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Account Details', style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w800, color: GuColors.ink)),
                const SizedBox(height: 24),
                _DetailRow(label: 'User name', value: user.name.isNotEmpty ? user.name : 'Not provided'),
                const SizedBox(height: 16),
                _DetailRow(label: 'Number', value: user.phone.trim().isNotEmpty ? formatIndianPhone(user.phone) : 'Not provided'),
                const SizedBox(height: 16),
                _DetailRow(label: 'E-mail', value: user.email.isNotEmpty ? user.email : 'Not provided'),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    );
  }

  void _confirmDeleteAccount(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) {
        bool deleting = false;
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: GuColors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: GuColors.danger, size: 26),
                  const SizedBox(width: 8),
                  Text(
                    'Delete Account?',
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18, color: GuColors.ink),
                  ),
                ],
              ),
              content: Text(
                'Are you sure you want to delete your GO UNLISTED account permanently? All your personal details, KYC verification documents, and purchase history will be erased. This action cannot be undone.',
                style: GoogleFonts.inter(fontSize: 13.5, height: 1.45, color: GuColors.muted),
              ),
              actions: [
                TextButton(
                  onPressed: deleting ? null : () => Navigator.of(ctx).pop(),
                  child: Text('Cancel', style: GoogleFonts.manrope(fontWeight: FontWeight.w700, color: GuColors.muted)),
                ),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: GuColors.danger,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: deleting
                      ? null
                      : () async {
                          setDialogState(() => deleting = true);
                          final auth = context.read<AuthProvider>();
                          final success = await auth.deleteAccount();
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          if (!context.mounted) return;
                          if (success) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Your account has been deleted successfully.'),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            context.go('/auth');
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(auth.error ?? 'Failed to delete account. Try again.'),
                                backgroundColor: GuColors.danger,
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                  child: deleting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text('Delete Account', style: GoogleFonts.manrope(fontWeight: FontWeight.w700)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final settings = context.watch<CatalogProvider>().settings;

    return ProfileSubScaffold(
      title: 'Account Center',
      subtitle: 'Manage your profile, verification, and support contacts within GO UNLISTED.',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 32),
        children: [
          if (user != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Material(
                color: GuColors.surface,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => _showAccountDetails(context, user),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: GuColors.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: GuColors.lime,
                          child: Text(
                            (user.name.isNotEmpty ? user.name[0] : 'U').toUpperCase(),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.name.isNotEmpty ? user.name : 'Investor',
                                style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 16),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                user.phone.trim().isNotEmpty
                                    ? formatIndianPhone(user.phone)
                                    : (user.email.isNotEmpty ? user.email : '—'),
                                style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: GuColors.mutedSoft),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          const ProfileSectionLabel('More from GO UNLISTED'),
          FutureBuilder<_Contacts?>(
            future: _contactsFuture,
            builder: (context, snap) {
              final c = snap.data;
              final settingsPhones = parseIndianPhoneList(settings?.phone);
              final companyPhones =
                  (c?.companyPhones.isNotEmpty == true) ? c!.companyPhones : settingsPhones;
              final supportPhone = c?.supportPhone?.isNotEmpty == true
                  ? c!.supportPhone!
                  : (companyPhones.isNotEmpty ? companyPhones.first : settings?.whatsapp);
              final rmPhone = c?.rmPhone;
              final waPhone = c?.whatsapp ?? supportPhone;

              return ProfileGroupedCard(
                children: [
                  ProfileMenuTile(
                    icon: Icons.badge_outlined,
                    title: 'Contact account manager',
                    subtitle: rmPhone != null && rmPhone.isNotEmpty
                        ? (c?.rmName?.isNotEmpty == true && c?.rmIsDesk != true
                            ? '${c!.rmName} · ${formatIndianPhone(rmPhone)}'
                            : formatIndianPhone(rmPhone))
                        : 'Relationship desk / RM',
                    onTap: () {
                      if (rmPhone != null && rmPhone.isNotEmpty) {
                        _call(rmPhone);
                      } else if (supportPhone != null) {
                        _call(supportPhone);
                      }
                    },
                  ),
                  ProfileMenuTile(
                    icon: Icons.chat_bubble_outline_rounded,
                    title: 'WhatsApp support',
                    onTap: () => _whatsapp(waPhone),
                  ),
                  ProfileMenuTile(
                    icon: Icons.logout_rounded,
                    title: 'Log out',
                    showDivider: true,
                    onTap: () async {
                      await auth.logout();
                      if (context.mounted) context.go('/auth');
                    },
                  ),
                  ProfileMenuTile(
                    icon: Icons.delete_forever_rounded,
                    title: 'Delete account',
                    iconColor: GuColors.danger,
                    textColor: GuColors.danger,
                    showDivider: false,
                    onTap: () => _confirmDeleteAccount(context),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 28),
          Text(
            'Always getting better  ·  Version 1.0.0',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 12, color: GuColors.mutedSoft),
          ),
        ],
      ),
    );
  }
}

class _Contacts {
  _Contacts({
    this.rmName,
    this.rmPhone,
    this.rmIsDesk,
    this.supportPhone,
    this.whatsapp,
    this.companyPhones = const [],
  });

  final String? rmName;
  final String? rmPhone;
  final bool? rmIsDesk;
  final String? supportPhone;
  final String? whatsapp;
  final List<String> companyPhones;

  factory _Contacts.fromJson(Map<String, dynamic> j) {
    String? phoneOf(dynamic node) {
      if (node is! Map) return null;
      final p = (node['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
      if (p.length < 10) return null;
      return p.substring(p.length - 10);
    }

    String? nameOf(dynamic node) {
      if (node is! Map) return null;
      final n = (node['name'] ?? '').toString().trim();
      return n.isEmpty ? null : n;
    }

    final support = j['support'];
    final rm = j['relationshipManager'] ?? j['rm'];
    final phonesRaw = (support is Map) ? support['phones'] : null;
    final company = <String>[];
    if (phonesRaw is List) {
      for (final item in phonesRaw) {
        final digits = item.toString().replaceAll(RegExp(r'\D'), '');
        if (digits.length >= 10) company.add(digits.substring(digits.length - 10));
      }
    }
    final wa = (support is Map)
        ? (support['whatsapp'] ?? support['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '')
        : '';

    return _Contacts(
      rmName: nameOf(rm),
      rmPhone: phoneOf(rm),
      rmIsDesk: rm is Map && (rm['isDesk'] == true || rm['desk'] == true),
      supportPhone: phoneOf(support),
      whatsapp: wa.length >= 10 ? wa.substring(wa.length - 10) : null,
      companyPhones: company,
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;
  
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13, color: GuColors.muted, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Text(value, style: GoogleFonts.inter(fontSize: 16, color: GuColors.ink, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

