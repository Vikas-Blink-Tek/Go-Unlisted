import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShares } from '../hooks/useShares';
import ShareCard from '../components/shares/ShareCard';
import CompanyLogo from '../components/shares/CompanyLogo';
import ReturnsCalculator from '../components/home/ReturnsCalculator';
import ListingComparison from '../components/home/ListingComparison';
import { formatCurrency } from '../utils/format';
import type { Share } from '../types';

function MarketActivityCard({ share }: { share: Share }) {
  const listingPrice =
    share.listingPrice != null && share.listingPrice > 0 ? share.listingPrice : null;
  const hasComparison = listingPrice != null;
  const gainPct = hasComparison ? ((listingPrice - share.price) / share.price) * 100 : null;

  return (
    <Link to={`/shares/${share.id}`} className="hero-card market-scroll-card market-compare-card">
      <div className="hero-card-top">
        <div className="hero-card-company">
          <CompanyLogo share={share} className="hero-logo-sm" />
          <div className="hero-card-company-text">
            <div className="hero-company-name">{share.name}</div>
            <div className="hero-sector">{share.sector} · {share.listingType || 'Pre-IPO'}</div>
          </div>
        </div>
      </div>

      <div className="market-compare-prices">
        <div className="market-compare-price-box pre">
          <span className="market-compare-label">Pre-IPO</span>
          <span className="market-compare-value">{formatCurrency(share.price)}</span>
        </div>
        <div className="market-compare-arrow" aria-hidden="true">→</div>
        <div className="market-compare-price-box list">
          <span className="market-compare-label">Listing</span>
          <span className={`market-compare-value${listingPrice == null ? ' market-compare-value--empty' : ''}`}>
            {listingPrice != null ? formatCurrency(listingPrice) : '—'}
          </span>
        </div>
      </div>

      {hasComparison && gainPct != null ? (
        <div className={`market-compare-gain ${gainPct >= 0 ? 'pos' : 'neg'}`}>
          {gainPct >= 0 ? '+' : ''}
          {gainPct.toFixed(0)}% · {(listingPrice / share.price).toFixed(1)}x
        </div>
      ) : (
        <div className="market-compare-hint">Set listing price in admin to show IPO comparison</div>
      )}
    </Link>
  );
}

/** Continuous upward scroll — always 2 cards visible, slower rotation. */
function MarketActivityScroller({ items }: { items: Share[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  pausedRef.current = paused;

  // Exactly 2 cards on screen (or 1 if only one starred)
  const visibleCount = Math.min(2, Math.max(1, items.length));
  // Slower: ~5.5s per card for a calm, professional loop
  const durationSec = Math.max(10, items.length * 5.5);

  const scrollItems = useMemo(() => [...items, ...items], [items]);
  const shouldScroll = items.length > visibleCount || items.length > 1;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0 || !shouldScroll) return;

    let raf = 0;
    let start = performance.now();
    let pausedAt = 0;

    const tick = (now: number) => {
      if (pausedRef.current) {
        if (!pausedAt) pausedAt = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (pausedAt) {
        start += now - pausedAt;
        pausedAt = 0;
      }
      const loopPx = track.scrollHeight / 2;
      if (loopPx > 0) {
        const progress = ((now - start) / 1000 / durationSec) % 1;
        track.style.transform = `translate3d(0, ${-progress * loopPx}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      track.style.transform = '';
    };
  }, [items, durationSec, shouldScroll]);

  return (
    <div
      className="market-scroll-viewport"
      style={{ ['--market-visible' as string]: String(visibleCount) }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={trackRef} className={`market-scroll-track${shouldScroll ? ' is-moving' : ''}`}>
        {scrollItems.map((share, i) => (
          <MarketActivityCard key={`${share.id}-${i}`} share={share} />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { shares } = useShares();
  /** Starred stocks — homepage Market Activity only */
  const starred = useMemo(
    () => shares.filter((s) => !!s.isFeatured),
    [shares],
  );
  /** Browseable listings — exclude starred (they stay on homepage hero only) */
  const catalogShares = useMemo(
    () => shares.filter((s) => !s.isFeatured),
    [shares],
  );

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
              <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>
                Market Activity
                {starred.length > 0 ? ` · ${starred.length} starred` : ''}
              </span>
              <div className="hero-ticker-live">LIVE</div>
            </div>

            {starred.length === 0 ? (
              <div className="market-scroll-empty">
                <p>No starred stocks yet</p>
                <span>Star listings in admin (★) to show them here</span>
              </div>
            ) : (
              <MarketActivityScroller items={starred} />
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
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold)' }}>
                  {new Set(catalogShares.map((s) => s.sector)).size}+
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ListingComparison shares={shares} />

      <section className="section" style={{ paddingTop: '3rem' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">Live Listings</div>
            <h2 className="section-title">Top Pre-IPO <span>Opportunities</span></h2>
            <p className="section-subtitle">
              Browse all listings — starred picks appear only in Market Activity above, not here.
            </p>
          </div>
          {catalogShares.length > 0 ? (
            <div className="shares-grid">
              {catalogShares.map((share) => (
                <ShareCard key={share.id} share={share} />
              ))}
            </div>
          ) : (
            <p className="section-subtitle" style={{ textAlign: 'center' }}>
              No stocks yet. Add listings in admin to show them here.
            </p>
          )}
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
