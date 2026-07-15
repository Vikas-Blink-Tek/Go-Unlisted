import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PriceChart from '../components/shares/PriceChart';
import CompanyLogo from '../components/shares/CompanyLogo';
import { useShares } from '../hooks/useShares';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getInventoryBadge, isShareOnRequest, isShareUnavailable } from '../utils/inventory';
import type { ChartPeriod } from '../types';

export default function ShareDetailPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { getShareById } = useShares();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
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
    if (!user) {
      navigate('/login', { state: { from: `/share/${share.id}` } });
      return;
    }
    if (user.kycStatus !== 'Verified') {
      showToast('KYC Verification is required to purchase stocks.', 'error');
      navigate('/dashboard?tab=kyc');
      return;
    }
    navigate(`/checkout/${share.id}`);
  };

  const unavailable = isShareUnavailable(share.inventoryStatus);
  const onRequest = isShareOnRequest(share.inventoryStatus);
  const invBadge = getInventoryBadge(share.inventoryStatus);

  /** All key-data fields optional except price & lot — empty shows N/A (client request) */
  const na = (v?: string | number | null) => {
    if (v === null || v === undefined || v === '') return 'N/A';
    return String(v);
  };
  const fundamentals: { label: string; value: string }[] = [
    { label: 'Indicative price', value: formatCurrency(share.price) },
    { label: 'Lot size', value: share.minQty.toLocaleString('en-IN') },
    { label: '52-wk high', value: na(share.week52High) },
    { label: '52-wk low', value: na(share.week52Low) },
    { label: 'Market cap', value: na(share.marketCap || share.valuation) },
    { label: 'P/E ratio', value: na(share.peRatio) },
    { label: 'P/B ratio', value: na(share.pbRatio) },
    { label: 'Debt / Equity', value: na(share.debtEquity) },
    { label: 'ROE', value: na(share.roe) },
    { label: 'Book value', value: na(share.bookValue) },
    { label: 'Face value', value: na(share.faceValue) },
    { label: 'ISIN', value: na(share.isin) },
  ];

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
            {share.growth && <span className={`detail-yoy ${share.changePositive ? 'pos' : 'neg'}`}>{share.growth} YoY</span>}
          </div>
        </div>

        <div className="detail-company-header" style={{ marginBottom: '1rem' }}>
          <CompanyLogo share={share} className="detail-logo" />
          <div>
            <h1 className="detail-title">{share.name}</h1>
            <div className="detail-subtitle">
              {share.ticker}
              {share.listingType && <span style={{ marginLeft: 8 }}>{share.listingType}</span>}
              {invBadge && <span className={`inventory-badge inventory-${invBadge.toLowerCase().replace(/\s+/g, '-')}`} style={{ marginLeft: 8 }}>{invBadge}</span>}
            </div>
          </div>
        </div>

        <p className="detail-desc">{share.description}</p>

        {share.keyHighlights && share.keyHighlights.length > 0 && (
          <div className="detail-extra-block">
            <ul className="detail-highlights">
              {share.keyHighlights.map((h) => <li key={h}>{h}</li>)}
            </ul>
          </div>
        )}

        <div className="detail-fundamentals">
          <div className="detail-fundamentals-label">Key Data</div>
          <div className="detail-fundamentals-grid">
            {fundamentals.map((f) => (
              <div key={f.label} className="detail-fundamentals-item">
                <span>{f.label}</span>
                <strong className={f.value === 'N/A' ? 'is-na' : undefined}>{f.value}</strong>
              </div>
            ))}
          </div>
        </div>

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
