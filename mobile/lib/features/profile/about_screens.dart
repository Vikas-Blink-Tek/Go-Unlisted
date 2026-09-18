import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/gu_theme.dart';
import 'profile_content.dart';
import 'profile_widgets.dart';

class AboutHubScreen extends StatelessWidget {
  const AboutHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ProfileSubScaffold(
      title: 'About Us',
      subtitle: GuProfileCopy.aboutIntro,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
        children: [
          const ProfileSectionLabel('Company'),
          ProfileGroupedCard(
            children: [
              ProfileMenuTile(
                icon: Icons.info_outline_rounded,
                title: 'About GO UNLISTED',
                subtitle: 'Who we are and what we do',
                onTap: () => context.push('/profile/about/company'),
              ),
              ProfileMenuTile(
                icon: Icons.track_changes_rounded,
                title: 'Vision & Mission',
                subtitle: 'Our principles and long-term goals',
                showDivider: false,
                onTap: () => context.push('/profile/about/vision'),
              ),
            ],
          ),
          const ProfileSectionLabel('Legal'),
          ProfileGroupedCard(
            children: [
              ProfileMenuTile(
                icon: Icons.shield_outlined,
                title: 'Privacy Policy',
                subtitle: 'How we protect your data',
                onTap: () => context.push('/profile/legal/privacy'),
              ),
              ProfileMenuTile(
                icon: Icons.warning_amber_rounded,
                title: 'Declaration of Risk',
                subtitle: 'Risks of unlisted investing',
                onTap: () => context.push('/profile/legal/risk'),
              ),
              ProfileMenuTile(
                icon: Icons.description_outlined,
                title: 'Terms & Conditions',
                subtitle: 'Rules for using the platform',
                showDivider: false,
                onTap: () => context.push('/profile/legal/terms'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class AboutCompanyScreen extends StatelessWidget {
  const AboutCompanyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ProfileSubScaffold(
      title: 'About GO UNLISTED',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
        children: [
          _H('Who We Are'),
          _P(GuProfileCopy.whoWeAre),
          const SizedBox(height: 24),
          _H('What We Do'),
          _P(GuProfileCopy.whatWeDoIntro),
          const SizedBox(height: 10),
          ...GuProfileCopy.whatWeDoBullets.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: GuColors.limeDark)),
                  Expanded(child: _P(b)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _H('Why We Exist'),
          _P(GuProfileCopy.whyWeExist),
        ],
      ),
    );
  }
}

class VisionMissionScreen extends StatelessWidget {
  const VisionMissionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ProfileSubScaffold(
      title: 'Vision & Mission',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
        children: [
          _H('Introduction'),
          _P(GuProfileCopy.visionIntro),
          const SizedBox(height: 24),
          _H('Mission Pillars'),
          const SizedBox(height: 8),
          ...GuProfileCopy.missionPillars.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.$1,
                    style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 15.5, color: GuColors.ink),
                  ),
                  const SizedBox(height: 4),
                  _P(p.$2),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class FaqsScreen extends StatefulWidget {
  const FaqsScreen({super.key});

  @override
  State<FaqsScreen> createState() => _FaqsScreenState();
}

class _FaqsScreenState extends State<FaqsScreen> {
  final _open = <String>{};

  @override
  Widget build(BuildContext context) {
    return ProfileSubScaffold(
      title: 'FAQs',
      subtitle: 'Quick answers about Pre-IPO investing, KYC, and using GO UNLISTED.',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 40),
        children: [
          for (final cat in GuProfileCopy.faqCategories) ...[
            ProfileSectionLabel(cat.title),
            ProfileGroupedCard(
              children: [
                for (var i = 0; i < cat.items.length; i++)
                  _FaqRow(
                    question: cat.items[i].q,
                    answer: cat.items[i].a,
                    open: _open.contains('${cat.title}-$i'),
                    showDivider: i < cat.items.length - 1,
                    onTap: () {
                      final key = '${cat.title}-$i';
                      setState(() {
                        if (_open.contains(key)) {
                          _open.remove(key);
                        } else {
                          _open.add(key);
                        }
                      });
                    },
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _FaqRow extends StatelessWidget {
  const _FaqRow({
    required this.question,
    required this.answer,
    required this.open,
    required this.onTap,
    required this.showDivider,
  });

  final String question;
  final String answer;
  final bool open;
  final VoidCallback onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    question,
                    style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w600, color: GuColors.ink, height: 1.35),
                  ),
                ),
                Icon(
                  open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                  color: GuColors.muted,
                ),
              ],
            ),
          ),
        ),
        if (open)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            child: Text(
              answer,
              style: GoogleFonts.inter(fontSize: 13.5, height: 1.5, color: GuColors.muted),
            ),
          ),
        if (showDivider) const Divider(height: 1, indent: 16, color: GuColors.border),
      ],
    );
  }
}

class LegalDocScreen extends StatelessWidget {
  const LegalDocScreen({super.key, required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return ProfileSubScaffold(
      title: title,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
        children: [
          Text(
            body,
            style: GoogleFonts.inter(fontSize: 14.5, height: 1.55, color: GuColors.text),
          ),
        ],
      ),
    );
  }
}

class _H extends StatelessWidget {
  const _H(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: GoogleFonts.manrope(fontWeight: FontWeight.w800, fontSize: 18, color: GuColors.ink),
      ),
    );
  }
}

class _P extends StatelessWidget {
  const _P(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(fontSize: 14.5, height: 1.55, color: GuColors.text),
    );
  }
}
