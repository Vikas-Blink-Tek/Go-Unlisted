import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/gu_theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/gu_widgets.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

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
