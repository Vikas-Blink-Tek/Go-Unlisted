import { useState } from 'react';

const faqs = [
  {
    q: 'What are unlisted shares?',
    a: 'Unlisted shares are stocks of companies that are not yet traded on public stock exchanges like NSE or BSE. Investors buy them in the over-the-counter (OTC) market to build early positions in high-growth companies before their IPO.',
  },
  {
    q: 'Is investing in unlisted shares legal and compliant in India?',
    a: 'Yes, buying and selling unlisted shares is completely legal in India. Transactions are processed via NSDL/CDSL Demat-to-Demat transfers, adhering to the standard regulations for off-market equity transfers.',
  },
  {
    q: 'How does the purchase and transfer process work?',
    a: 'Browse a listing, place your order, and pay via bank transfer or UPI. Enter your UTR at checkout so we can verify payment within 24 hours. Complete KYC in your dashboard (PAN, demat, bank). Once verified, shares transfer to your demat in 2–3 business days.',
  },
  {
    q: 'When do I need to complete KYC?',
    a: 'You can browse and pay first. After checkout, submit PAN, demat and bank details in your dashboard. Our team reviews KYC before initiating the share transfer — this keeps the process fast while staying compliant.',
  },
  {
    q: 'Can I sell my shares before the company\'s IPO?',
    a: 'Yes, unlisted shares can be sold in the OTC market to other buyers or back through our platform. However, please note that SEBI mandates a 1-year lock-in period from the listing date on pre-IPO shares once the company goes public.',
  },
];

const features = [
  { title: 'SEBI Compliant', desc: 'We follow all applicable SEBI regulations for unlisted securities facilitation and investor protection.' },
  { title: 'Real-time Prices', desc: 'Share prices are updated by our expert team based on market intelligence and OTC transaction data.' },
  { title: 'KYC Verified', desc: 'All buyers are identity-verified with PAN and Demat details ensuring a safe trading ecosystem.' },
  { title: 'Fast Settlement', desc: 'Share transfers are initiated within 2–3 business days of confirmed payment.' },
  { title: 'Research Driven', desc: 'In-depth company financials, growth metrics and price history charts for informed decisions.' },
  { title: 'Low Minimum', desc: 'Start investing with as few as 5 shares. Accessible Pre-IPO investing for every budget.' },
];

export default function AboutPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="view active" id="view-about">
      <div className="about-hero">
        <h1>About <span className="nav-logo-text"><span className="logo-go">GO</span> <span className="logo-unlisted">UNLISTED</span></span></h1>
        <p>We&apos;re on a mission to democratize Pre-IPO investing — giving every Indian investor access to shares of tomorrow&apos;s public companies, today.</p>
      </div>

      <div className="about-mission">
        <div>
          <div className="section-tag">Our Mission</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.75rem 0', lineHeight: 1.3 }}>
            Bridging the Gap Between <span className="text-gold">Retail Investors</span> and Pre-IPO Opportunities
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.8, marginBottom: '1.25rem' }}>
            Until now, Pre-IPO shares were exclusive to high-net-worth individuals and institutions. GO UNLISTED breaks down those barriers — enabling anyone with a Demat account to invest in India&apos;s most exciting unlisted companies before their IPO.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.8 }}>
            We operate on a transparent commission-based model. Our team of experts curates and verifies every listing, ensuring you invest in only the most credible opportunities.
          </p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '2rem' }}>
          {[
            ['Verified Listings Only', 'Every company is thoroughly due-diligenced before listing on our platform.'],
            ['Secure Transactions', 'Pay via NEFT, RTGS, IMPS or UPI. We verify your UTR and confirm before transfer.'],
            ['Transparent Pricing', 'Clear 1% platform commission. No hidden charges or management fees.'],
            ['Dedicated Support', 'Dedicated relationship managers for every investor query and concern.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ color: 'var(--gold)', fontWeight: 700 }}>✓</div>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-features" style={{ marginTop: 0 }}>
        {features.map((f) => (
          <div key={f.title} className="about-feature">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="container faq-section">
        <div className="section-header">
          <div className="section-tag">Frequently Asked Questions</div>
          <h2 className="section-title">Common <span>Questions</span></h2>
          <p className="section-subtitle">Everything you need to know about investing in unlisted shares on our platform.</p>
        </div>
        <div className="faq-grid">
          {faqs.map((f, i) => (
            <div key={f.q} className={`faq-item ${openFaq === i ? 'open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="faq-question">
                <span>{f.q}</span>
                <span className="faq-question-icon">{openFaq === i ? '−' : '+'}</span>
              </div>
              {openFaq === i && <div className="faq-answer">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
