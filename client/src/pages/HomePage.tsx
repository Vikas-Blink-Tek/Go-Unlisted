import { Link } from 'react-router-dom';
import { useShares } from '../hooks/useShares';
import ShareCard from '../components/shares/ShareCard';
import ReturnsCalculator from '../components/home/ReturnsCalculator';
import ShareSparkline from '../components/shares/ShareSparkline';
import { formatCurrency } from '../utils/format';

export default function HomePage() {
  const { shares, getShareById } = useShares();
  const phonepe = getShareById('phonepe');
  const zepto = getShareById('zepto');
  const featuredList = shares.filter((s) => s.isFeatured);
  const featured = featuredList.length ? featuredList.slice(0, 4) : shares.slice(0, 4);

  return (
    <div className="view active" id="view-home">
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-grid" />
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <div className="hero-eyebrow-dot" />
              India&apos;s #1 Pre-IPO Investment Platform
            </div>

            <h1 className="hero-title">
              Invest Before<br />
              They Go <span className="grad">Public</span><br />
              &amp; <span className="line-blue">Profit Big</span>
            </h1>

            <p className="hero-desc">
              Access exclusive unlisted shares of India&apos;s most promising companies — before they list on stock exchanges. Join 500+ smart investors already building wealth.
            </p>

            <div className="hero-trust">
              <div className="hero-trust-item">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>
                SEBI Compliant
              </div>
              <div className="hero-trust-item">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" /></svg>
                Secure Payments
              </div>
              <div className="hero-trust-item">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
                KYC Verified
              </div>
            </div>

            <div className="hero-cta">
              <Link to="/shares" className="btn btn-primary btn-lg">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                Explore Shares
              </Link>
              <Link to="/about" className="btn btn-ghost" style={{ gap: 8 }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                How It Works
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value">₹4.2<span>Cr+</span></div>
                <div className="hero-stat-label">Total Invested</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">6<span>+</span></div>
                <div className="hero-stat-label">Active Listings</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">500<span>+</span></div>
                <div className="hero-stat-label">Happy Investors</div>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-ticker-bar">
              <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>Market Activity</span>
              <div className="hero-ticker-live">LIVE</div>
            </div>

            {phonepe && (
              <Link to={`/shares/${phonepe.id}`} className="hero-card">
                <div className="hero-card-top">
                  <div className="hero-card-company">
                    <div className="hero-logo-sm" style={{ background: phonepe.logoGradient }}>PP</div>
                    <div>
                      <div className="hero-company-name">PhonePe</div>
                      <div className="hero-sector">Fintech · Pre-IPO</div>
                    </div>
                  </div>
                  <div className="hero-price-badge">{formatCurrency(phonepe.price)}</div>
                </div>
                <div className="hero-chart-wrap">
                  <ShareSparkline data={phonepe.priceHistory['3M']} positive={phonepe.changePositive} height={60} />
                </div>
                <div className="hero-card-bottom">
                  <div className="hero-card-meta">Min {phonepe.minQty} shares · {formatCurrency(phonepe.price * phonepe.minQty)}</div>
                  <div className="hero-change pos">▲ +4.1%</div>
                </div>
              </Link>
            )}

            {zepto && (
              <Link to={`/shares/${zepto.id}`} className="hero-card">
                <div className="hero-card-top">
                  <div className="hero-card-company">
                    <div className="hero-logo-sm" style={{ background: zepto.logoGradient }}>ZP</div>
                    <div>
                      <div className="hero-company-name">Zepto</div>
                      <div className="hero-sector">Quick Commerce · Pre-IPO</div>
                    </div>
                  </div>
                  <div className="hero-price-badge">{formatCurrency(zepto.price)}</div>
                </div>
                <div className="hero-chart-wrap">
                  <ShareSparkline data={zepto.priceHistory['3M']} positive={zepto.changePositive} height={60} />
                </div>
                <div className="hero-card-bottom">
                  <div className="hero-card-meta">Min {zepto.minQty} shares · {formatCurrency(zepto.price * zepto.minQty)}</div>
                  <div className="hero-change pos">▲ +3.2%</div>
                </div>
              </Link>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Avg. Return</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--green-light)' }}>+47%</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>IPO Hits</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--blue-light)' }}>12/14</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(122,193,66,0.08)', border: '1px solid rgba(122,193,66,0.2)', borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Sectors</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>5+</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: '3rem' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">★ Featured Listings</div>
            <h2 className="section-title">Top Pre-IPO <span>Opportunities</span></h2>
            <p className="section-subtitle">Handpicked high-growth companies approaching their IPO. Limited shares available — act before they list.</p>
          </div>
          <div className="shares-grid">
            {featured.map((share) => (
              <ShareCard key={share.id} share={share} />
            ))}
          </div>
          <div className="text-center mt-3">
            <Link to="/shares" className="btn btn-outline" style={{ padding: '11px 28px' }}>View All Listings →</Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">Simple Process</div>
            <h2 className="section-title">How <span>It Works</span></h2>
            <p className="section-subtitle">Four simple steps to start your Pre-IPO investment journey.</p>
          </div>
          <div className="steps-grid">
            {[
              { n: '01', t: 'Browse & Buy', d: 'Explore Pre-IPO listings and place your order via bank transfer or UPI.' },
              { n: '02', t: 'Pay & Submit UTR', d: 'Transfer the exact amount and enter your UTR at checkout so we can verify within 24 hours.' },
              { n: '03', t: 'Complete KYC', d: 'Submit PAN, demat and bank details in your dashboard — we verify before share transfer.' },
              { n: '04', t: 'Shares Credited', d: 'Once payment and KYC are confirmed, shares transfer to your demat in 2–3 business days.' },
            ].map((s) => (
              <div key={s.n} className="step-card">
                <div className="step-num">{s.n}</div>
                <div className="step-title">{s.t}</div>
                <p className="step-desc">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ReturnsCalculator shares={shares} />
    </div>
  );
}
