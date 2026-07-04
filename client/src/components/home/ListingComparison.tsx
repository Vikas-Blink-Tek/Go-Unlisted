import { useMemo, useRef } from 'react';
import CompanyLogo from '../shares/CompanyLogo';
import { formatCurrency } from '../../utils/format';
import type { Share } from '../../types';

interface ListingComparisonProps {
  shares: Share[];
}

export default function ListingComparison({ shares }: ListingComparisonProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      shares
        .filter((s) => s.listingPrice != null && s.listingPrice > 0 && s.price > 0)
        .map((s) => {
          const invest = s.price;
          const list = s.listingPrice as number;
          const gainPct = ((list - invest) / invest) * 100;
          const multiplier = list / invest;
          return { share: s, invest, list, gainPct, multiplier };
        })
        .sort((a, b) => b.gainPct - a.gainPct),
    [shares],
  );

  if (!items.length) return null;

  const scrollBy = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: 'smooth' });
  };

  return (
    <section className="section listing-compare-section">
      <div className="container">
        <div className="section-header">
          <div className="section-tag">IPO Track Record</div>
          <h2 className="section-title">Pre-IPO vs <span>Listing Price</span></h2>
          <p className="section-subtitle">
            See how past and listed names performed — invest price versus listing price.
          </p>
        </div>

        <div className="listing-compare-wrap">
          <button type="button" className="listing-compare-nav prev" onClick={() => scrollBy(-1)} aria-label="Previous">
            ‹
          </button>
          <div className="listing-compare-track" ref={trackRef}>
            {items.map(({ share, invest, list, gainPct, multiplier }) => (
              <article key={share.id} className="listing-compare-card">
                <div className="listing-compare-head">
                  <CompanyLogo share={share} className="listing-compare-logo" />
                  <div>
                    <div className="listing-compare-name">{share.name}</div>
                    <div className="listing-compare-sector">{share.sector}</div>
                  </div>
                </div>
                <div className="listing-compare-row invest">
                  <span className="listing-compare-label">Investing Price</span>
                  <span className="listing-compare-value">{formatCurrency(invest)}</span>
                </div>
                <div className="listing-compare-row list">
                  <span className="listing-compare-label">Listing Price</span>
                  <span className="listing-compare-value">{formatCurrency(list)}</span>
                </div>
                <div className={`listing-compare-gain ${gainPct >= 0 ? 'pos' : 'neg'}`}>
                  {gainPct >= 0 ? '+' : ''}
                  {gainPct.toFixed(0)}% · {multiplier.toFixed(1)}x
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="listing-compare-nav next" onClick={() => scrollBy(1)} aria-label="Next">
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
