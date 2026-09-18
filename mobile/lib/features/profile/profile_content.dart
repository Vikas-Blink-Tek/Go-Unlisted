// Static copy for Profile / About / FAQs — adapted from website About + legal pages.

class GuProfileCopy {
  static const aboutIntro =
      'Learn about GO UNLISTED and review the policies that govern your investment journey.';

  static const whoWeAre =
      'GO UNLISTED is a compliance-driven platform specializing in pre-IPO and unlisted equity opportunities. We bridge the gap between retail investors and high-value private companies, offering access to markets traditionally dominated by institutions.';

  static const whatWeDoIntro = 'Our mission is to democratize Pre-IPO investing by providing:';

  static const whatWeDoBullets = [
    'Curated, verified unlisted & Pre-IPO listings',
    'Research-backed company insights and price history',
    'Transparent checkout with clear charges',
    'Fast demat settlement after payment & KYC verification',
  ];

  static const whyWeExist =
      'Retail investors deserve the same early access as institutional players. GO UNLISTED enables individuals with a demat account to participate confidently in India\'s most exciting unlisted companies before IPO.';

  static const visionIntro =
      'GO UNLISTED aims to redefine access to Pre-IPO investing through transparency, curated inventory, and investor-first support. Our mission centres on empowering individuals to build long-term wealth with unlisted equity.';

  static const missionPillars = [
    (
      'Verified listings only',
      'Every company is reviewed before it appears on the platform.',
    ),
    (
      'Secure transactions',
      'Pay via NEFT, IMPS, UPI or QR. We verify your UTR before transfer.',
    ),
    (
      'Transparent pricing',
      'Checkout shows share value clearly — no hidden surprises.',
    ),
    (
      'Dedicated support',
      'Relationship desk and customer care for every investor query.',
    ),
    (
      'Compliant settlement',
      'Off-market demat transfers via CDSL/NSDL after KYC checks.',
    ),
  ];

  static const faqCategories = <({String title, List<({String q, String a})> items})>[
    (
      title: 'KYC & ACCOUNT SETUP',
      items: [
        (
          q: 'When do I need to complete KYC?',
          a:
              'You can browse and pay first. After checkout, submit PAN, demat and bank details in your dashboard. Our team reviews KYC before initiating the share transfer.',
        ),
        (
          q: 'How do I complete my KYC?',
          a:
              'Open Profile → View Your KYC (or KYC Verification). Enter PAN, 16-digit demat, bank details, and upload CMR/CML from your broker.',
        ),
        (
          q: 'What are Client ID and DP ID?',
          a:
              'Your demat account has a DP ID and Client ID (together often shown as a 16-digit number on CDSL/NSDL). Use the full demat ID from your CMR/CML.',
        ),
        (
          q: 'Why was my KYC rejected?',
          a:
              'Common reasons: PAN mismatch, demat not matching name, unclear CMR/CML photo, or bank details incomplete. Fix the fields shown in the reject reason and resubmit.',
        ),
      ],
    ),
    (
      title: 'ORDERS & SHARE TRANSFER',
      items: [
        (
          q: 'How do pre-IPO / unlisted orders work?',
          a:
              'Browse a listing, choose quantity, pay via UPI/NEFT/QR, then enter your Transaction ID / UTR. Order moves to Transfer Pending while ops verifies payment and completes demat transfer.',
        ),
        (
          q: 'What do the order statuses mean?',
          a:
              'Transfer Pending: payment submitted, transfer in progress. Completed: shares credited. Rejected / Cancelled / Refunded: see ops notes in your portfolio.',
        ),
        (
          q: 'How long does a share transfer take?',
          a:
              'Typically 24–72 hours after payment verification and KYC clearance, via off-market demat transfer.',
        ),
        (
          q: 'Where will my shares reflect?',
          a:
              'In your demat account (NSDL/CDSL). Track order status in Portfolio on the app or website.',
        ),
      ],
    ),
    (
      title: 'UNLISTED INVESTING',
      items: [
        (
          q: 'What are unlisted shares?',
          a:
              'Shares of companies not traded on NSE/BSE. You buy OTC / off-market at the platform\'s indicative price to build early positions before a potential IPO.',
        ),
        (
          q: 'Is investing in unlisted shares legal in India?',
          a:
              'Yes. Transactions are processed via NSDL/CDSL demat-to-demat (off-market) transfers when documented correctly.',
        ),
        (
          q: 'Can I sell before IPO?',
          a:
              'Unlisted shares can sometimes be sold OTC, subject to demand and lock-in rules. Pre-IPO allotments often have a lock-in after listing (commonly 6 months).',
        ),
      ],
    ),
  ];

  static const privacyBody = '''
GO UNLISTED collects account details (name, email, phone), KYC documents (PAN, demat, bank), and order/payment references to process investments and comply with applicable rules.

We use this information to verify identity, settle demat transfers, communicate order status, and improve our services. We do not sell your personal data.

Access is limited to authorised operations staff. You may contact support to update or correct account information.

By using the app or website you consent to this processing as described in our full Privacy Policy on gounlisted.in.''';

  static const riskBody = '''
Investing in unlisted and Pre-IPO securities involves significant risk, including:

• Illiquidity — exit may be difficult before listing
• No guarantee of IPO or listing gains
• Limited public financial disclosures vs listed stocks
• Possible loss of capital
• Regulatory and lock-in constraints after listing

GO UNLISTED is not a SEBI-registered broker. Past track records (Market Activity / listing comparisons) are illustrative and not a promise of future returns.

Invest only what you can afford to lose. Read the full Risk Disclosure on the website before investing.''';

  static const termsBody = '''
By using GO UNLISTED (website or app) you agree to our Terms & Conditions.

You must provide accurate KYC and payment details. Bank account and demat must belong to the same person. Third-party payments are not accepted.

Orders are subject to inventory, payment verification, and KYC clearance. Indicative prices are set by the platform and may change.

Use of the platform is at your own risk. See the full Terms & Conditions and Disclaimer on gounlisted.in for complete legal terms.''';
}
