import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/gu_api.dart';
import '../../core/theme/gu_theme.dart';
import '../../core/utils/format.dart';
import '../../providers/auth_provider.dart';
import '../../providers/catalog_provider.dart';
import '../../widgets/gu_widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Future<_AccountContacts?>? _contactsFuture;
  String? _loadedForUserId;

  Future<_AccountContacts?> _loadContacts() async {
    try {
      final res = await GuApi.instance.get('getAccountContacts');
      return _AccountContacts.fromJson(res);
    } catch (_) {
      return null;
    }
  }

  void _ensureContacts(AuthProvider auth) {
    if (!auth.isLoggedIn) {
      _contactsFuture = null;
      _loadedForUserId = null;
      return;
    }
    final id = auth.user?.id;
    if (id != null && id != _loadedForUserId) {
      _loadedForUserId = id;
      _contactsFuture = _loadContacts();
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final settings = context.watch<CatalogProvider>().settings;
    _ensureContacts(auth);

    if (!auth.isLoggedIn) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset('assets/brand/logo.png', width: 64, height: 64),
              const SizedBox(height: 16),
              const Text('Your GO UNLISTED account', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 8),
              const Text(
                'Login once — same credentials work on the website and app.',
                textAlign: TextAlign.center,
                style: TextStyle(color: GuColors.muted),
              ),
              const SizedBox(height: 20),
              GuPrimaryButton(label: 'Login / Sign up', onPressed: () => context.push('/auth')),
            ],
          ),
        ),
      );
    }

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          const GuBrandMark(compact: true),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: GuColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: GuColors.border),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: GuColors.lime,
                  child: Text(
                    (user!.name.isNotEmpty ? user.name[0] : 'U').toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                      Text(user.email, style: const TextStyle(color: GuColors.muted, fontSize: 13)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: user.isKycVerified ? GuColors.limeSoft : const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          'KYC · ${user.kycStatus}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: user.isKycVerified ? GuColors.limeDark : GuColors.warning,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ).guFadeSlide(),
          const SizedBox(height: 16),
          _Tile(
            icon: Icons.verified_user_outlined,
            title: 'KYC Verification',
            subtitle: 'PAN, demat & bank',
            onTap: () => context.push('/kyc'),
          ),
          _Tile(
            icon: Icons.pie_chart_outline_rounded,
            title: 'Portfolio & orders',
            subtitle: 'Track payments & transfers',
            onTap: () => context.go('/app/portfolio'),
          ),
          FutureBuilder<_AccountContacts?>(
            future: _contactsFuture,
            builder: (context, snap) {
              final contacts = snap.data;
              final settingsPhones = parseIndianPhoneList(settings?.phone);
              final companyPhones = (contacts?.companyPhones.isNotEmpty == true)
                  ? contacts!.companyPhones
                  : settingsPhones;
              final supportPhone = contacts?.supportPhone?.isNotEmpty == true
                  ? contacts!.supportPhone!
                  : (companyPhones.isNotEmpty ? companyPhones.first : settings?.whatsapp);
              final rmPhone = contacts?.rmPhone;
              final rmIsDesk = contacts?.rmIsDesk == true;
              final waPhone = contacts?.whatsapp ?? supportPhone;
              final extraPhones = companyPhones
                  .where((p) => p.isNotEmpty && p != supportPhone && p != rmPhone)
                  .toList();

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (rmPhone != null && rmPhone.isNotEmpty)
                    _Tile(
                      icon: Icons.support_agent_rounded,
                      title: rmIsDesk ? 'Relationship desk' : 'Relationship Manager',
                      subtitle: contacts?.rmName?.isNotEmpty == true && !rmIsDesk
                          ? '${contacts!.rmName} · ${formatIndianPhone(rmPhone)}'
                          : formatIndianPhone(rmPhone),
                      onTap: () => _call(rmPhone),
                    )
                  else if (snap.connectionState == ConnectionState.done)
                    _Tile(
                      icon: Icons.support_agent_rounded,
                      title: 'Relationship Manager',
                      subtitle: 'Not assigned yet',
                      onTap: () {},
                    ),
                  if (supportPhone != null && supportPhone.isNotEmpty)
                    _Tile(
                      icon: Icons.phone_in_talk_rounded,
                      title: 'Customer care',
                      subtitle: formatIndianPhone(supportPhone),
                      onTap: () => _call(supportPhone),
                    ),
                  for (var i = 0; i < extraPhones.length; i++)
                    _Tile(
                      icon: Icons.business_rounded,
                      title: 'Company line ${i + 2}',
                      subtitle: formatIndianPhone(extraPhones[i]),
                      onTap: () => _call(extraPhones[i]),
                    ),
                  if (waPhone != null && waPhone.isNotEmpty)
                    _Tile(
                      icon: Icons.chat_rounded,
                      title: 'WhatsApp support',
                      subtitle: 'Chat with us on WhatsApp',
                      onTap: () => _whatsapp(waPhone),
                    ),
                ],
              );
            },
          ),
          _Tile(
            icon: Icons.language_rounded,
            title: 'Open website',
            subtitle: 'gounlisted.in',
            onTap: () => launchUrl(Uri.parse('https://go-unlisted.com'), mode: LaunchMode.externalApplication),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () async {
              await auth.logout();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Signed out')));
              }
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _AccountContacts {
  const _AccountContacts({
    this.rmName,
    this.rmPhone,
    this.rmIsDesk = false,
    this.supportPhone,
    this.companyPhones = const [],
    this.whatsapp,
  });

  final String? rmName;
  final String? rmPhone;
  final bool rmIsDesk;
  final String? supportPhone;
  final List<String> companyPhones;
  final String? whatsapp;

  factory _AccountContacts.fromJson(Map<String, dynamic> j) {
    final rm = j['relationManager'];
    final support = j['support'];

    String? phoneOf(dynamic node) {
      if (node is! Map) return null;
      final p = (node['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
      if (p.length < 10) return null;
      return p.length > 10 ? p.substring(p.length - 10) : p;
    }

    String? nameOf(dynamic node) {
      if (node is! Map) return null;
      final n = (node['name'] ?? '').toString().trim();
      return n.isEmpty ? null : n;
    }

    String? waOf(dynamic node) {
      if (node is! Map) return null;
      final w = (node['whatsapp'] ?? node['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
      if (w.length < 10) return null;
      return w.length > 10 ? w.substring(w.length - 10) : w;
    }

    final phonesRaw = (support is Map) ? support['phones'] : null;
    final companyPhones = <String>[];
    if (phonesRaw is List) {
      for (final item in phonesRaw) {
        final d = item.toString().replaceAll(RegExp(r'\D'), '');
        if (d.length < 10) continue;
        final local = d.length > 10 ? d.substring(d.length - 10) : d;
        if (!companyPhones.contains(local)) companyPhones.add(local);
      }
    }

    final care = phoneOf(support);
    if (care != null && !companyPhones.contains(care)) {
      companyPhones.insert(0, care);
    }

    final isDesk = rm is Map && (rm['isDesk'] == true || rm['isDesk'] == 1 || rm['isDesk'] == '1');

    return _AccountContacts(
      rmName: nameOf(rm),
      rmPhone: phoneOf(rm),
      rmIsDesk: isDesk,
      supportPhone: care,
      companyPhones: companyPhones,
      whatsapp: waOf(support),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: GuColors.limeSoft,
          child: Icon(icon, color: GuColors.limeDark),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
