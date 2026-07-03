import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PriceChart from '../components/shares/PriceChart';
import { useShares } from '../hooks/useShares';
import { formatCurrency } from '../utils/format';
import { getInventoryBadge, isShareOnRequest, isShareUnavailable } from '../utils/inventory';
import type { ChartPeriod } from '../types';

export default function ShareDetailPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { getShareById } = useShares();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ChartPeriod>('3M');

  const share = shareId ? getShareById(shareId) : null;

  if (!share) {
    return (
      <div className="detail-page-wrap">
        <div className="no-results">
          <p>Share not found.</p>
          <Link to="/shares" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Back to Listings</Link>
        </div>
      </div>
    );
  }

  const handleBuy = () => {
    if (isShareUnavailable(share.inventoryStatus)) return;
    navigate(`/checkout/${share.id}`);
  };

  const unavailable = isShareUnavailable(share.inventoryStatus);
  const onRequest = isShareOnRequest(share.inventoryStatus);
  const invBadge = getInventoryBadge(share.inventoryStatus);

  return (
    <div className="view" id="view-detail">
      <div className="detail-page-wrap">
        <button type="button" className="detail-back" onClick={() => navigate('/shares')}>
          ← Back to Listings
        </button>

        <div className="detail-hero-row">
          <div className="detail-hero-left">
            <span className="detail-ticker-lg">{share.ticker}</span>
            <span className="detail-chip chip-sector">{share.sector}</span>
          </div>
          <div className="detail-hero-price">
            <strong>{formatCurrency(share.price)}</strong>
            <span className={`detail-yoy ${share.changePositive ? 'pos' : 'neg'}`}>{share.growth} YoY</span>
          </div>
        </div>

        <div className="detail-company-header" style={{ marginBottom: '1rem' }}>
          <div className="detail-logo" style={{ background: share.logoGradient }}>{share.logoInitials}</div>
          <div>
            <h1 className="detail-title">{share.name}</h1>
            <div className="detail-subtitle">
              {share.ticker}
              {invBadge && <span className={`inventory-badge inventory-${invBadge.toLowerCase().replace(/\s+/g, '-')}`} style={{ marginLeft: 8 }}>{invBadge}</span>}
            </div>
          </div>
        </div>

        <p className="detail-desc">{share.description}</p>

        {(share.keyHighlights?.length || share.ipoTimeline) && (
          <div className="detail-extra-block">
            {share.ipoTimeline && (
              <div className="detail-ipo-banner">
                <span className="detail-ipo-label">{share.listingType || 'Pre-IPO'}</span>
                <strong>{share.ipoTimeline}</strong>
                {share.lockInMonths ? <span className="detail-ipo-lock">· {share.lockInMonths}mo post-IPO lock-in may apply</span> : null}
              </div>
            )}
            {share.keyHighlights && share.keyHighlights.length > 0 && (
              <ul className="detail-highlights">
                {share.keyHighlights.map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
          </div>
        )}

        <ul className="detail-meta-list">
          <li><span>Founded</span><strong>{share.founded}</strong></li>
          <li><span>Revenue</span><strong>{share.revenue}</strong></li>
          <li><span>Valuation</span><strong>{share.valuation}</strong></li>
          <li><span>Min Investment</span><strong>{formatCurrency(share.price * share.minQty)}</strong></li>
          {share.inventoryStatus && <li><span>Availability</span><strong>{share.inventoryStatus}</strong></li>}
        </ul>

        {share.riskNotes && (
          <div className="detail-risk-box">
            <strong>Investment risks</strong>
            <p>{share.riskNotes}</p>
          </div>
        )}

        <div className="chart-section">
          <div className="chart-header">
            <div className="chart-title">Price Performance</div>
            <div className="chart-tabs">
              {(['3M', '6M', '1Y'] as ChartPeriod[]).map((p) => (
                <button key={p} type="button" className={`chart-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <PriceChart share={share} period={period} />
        </div>

        <div className="detail-invest-cta">
          <div>
            <h3>Ready to invest in {share.name}?</h3>
            <p>
              Min. {share.minQty} shares · {formatCurrency(share.price * share.minQty)} + 1% platform fee
              {onRequest && ' · Delivery timeline on request'}
            </p>
          </div>
          {unavailable ? (
            <Link to="/contact" className="btn btn-outline btn-lg">Contact Us for Availability</Link>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={handleBuy}>
              Invest Now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
