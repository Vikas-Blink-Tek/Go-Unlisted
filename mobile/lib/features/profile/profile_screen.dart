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
import '../../widgets/gu_widgets.dart';
import 'profile_widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Future<_HubContacts?>? _contactsFuture;
  String? _loadedForUserId;

  Future<_HubContacts?> _loadContacts() async {
    try {
      final res = await GuApi.instance.get('getAccountContacts');
      return _HubContacts.fromJson(res);
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final settings = context.watch<CatalogProvider>().settings;
    _ensureContacts(auth);

    if (!auth.isLoggedIn) {
      return GuPageBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Image.asset('assets/brand/logo.png', width: 64, height: 64),
                const SizedBox(height: 16),
                Text(
                  'Your GO UNLISTED account',
                  style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                const SizedBox(height: 8),
                Text(
                  'Login once — same credentials work on the website and app.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: GuColors.muted),
                ),
                const SizedBox(height: 20),
                GuPrimaryButton(label: 'Login / Sign up', onPressed: () => context.push('/auth')),
              ],
            ),
          ),
        ),
      );
    }

    return GuPageBackground(
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: Text(
                'Profile',
                style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 28, color: GuColors.ink),
              ),
            ),
            const ProfileSectionLabel('Your account'),
            ProfileGroupedCard(
              children: [
                ProfileMenuTile(
                  icon: Icons.manage_accounts_outlined,
                  title: 'Account Center',
                  showDivider: false,
                  onTap: () => context.push('/profile/account'),
                ),
              ],
            ),
            const ProfileSectionLabel('Your verification'),
            ProfileGroupedCard(
              children: [
                ProfileMenuTile(
                  icon: Icons.verified_user_outlined,
                  title: 'View Your KYC',
                  trailing: ProfileKycBadge(status: user!.kycStatus),
                  showDivider: false,
                  onTap: () => context.push('/kyc'),
                ),
              ],
            ),
            const ProfileSectionLabel('Activity'),
            ProfileGroupedCard(
              children: [
                ProfileMenuTile(
                  icon: Icons.receipt_long_outlined,
                  title: 'Order History',
                  showDivider: false,
                  onTap: () => context.go('/app/portfolio'),
                ),
              ],
            ),
            const ProfileSectionLabel('Company'),
            ProfileGroupedCard(
              children: [
                ProfileMenuTile(
                  icon: Icons.info_outline_rounded,
                  title: 'About Us',
                  showDivider: false,
                  onTap: () => context.push('/profile/about'),
                ),
              ],
            ),
            const ProfileSectionLabel('Support'),
            FutureBuilder<_HubContacts?>(
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

                return ProfileGroupedCard(
                  children: [
                    ProfileMenuTile(
                      icon: Icons.person_add_alt_1_outlined,
                      title: 'Connect Account Manager',
                      subtitle: rmPhone != null && rmPhone.isNotEmpty
                          ? formatIndianPhone(rmPhone)
                          : (supportPhone != null ? formatIndianPhone(supportPhone) : 'Call desk'),
                      onTap: () {
                        final phone = (rmPhone != null && rmPhone.isNotEmpty) ? rmPhone : supportPhone;
                        _call(phone);
                      },
                    ),
                    ProfileMenuTile(
                      icon: Icons.help_outline_rounded,
                      title: 'FAQs',
                      showDivider: false,
                      onTap: () => context.push('/profile/faqs'),
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
      ),
    );
  }
}

class _HubContacts {
  _HubContacts({
    this.rmPhone,
    this.supportPhone,
    this.companyPhones = const [],
  });

  final String? rmPhone;
  final String? supportPhone;
  final List<String> companyPhones;

  factory _HubContacts.fromJson(Map<String, dynamic> j) {
    String? phoneOf(dynamic node) {
      if (node is! Map) return null;
      final p = (node['phone'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
      if (p.length < 10) return null;
      return p.substring(p.length - 10);
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

    return _HubContacts(
      rmPhone: phoneOf(rm),
      supportPhone: phoneOf(support),
      companyPhones: company,
    );
  }
}
