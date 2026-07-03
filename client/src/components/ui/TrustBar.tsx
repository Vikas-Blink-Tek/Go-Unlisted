const items = [
  '🔒 Bank-Grade Security',
  '📊 Live Price Discovery',
  '✅ SEBI Compliant Process',
  '⚡ Instant KYC Tracking',
  '💎 Pre-IPO Access from ₹5,000',
  '📈 500+ Active Investors',
  '🏆 Curated Unlisted Deals',
  '🔄 Buy & Sell Seamlessly',
];

export default function TrustBar() {
  const doubled = [...items, ...items];
  return (
    <div className="trust-bar">
      <div className="trust-ticker">
        {doubled.map((item, i) => (
          <span key={i} className="trust-item">{item}</span>
        ))}
      </div>
    </div>
  );
}
