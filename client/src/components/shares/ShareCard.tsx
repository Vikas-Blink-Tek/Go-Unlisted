import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';
import { isShareUnavailable } from '../../utils/inventory';
import { getShareCardTag } from '../../utils/shareCardTag';
import { BlurredRatesLock, useCanViewShareRates } from '../../utils/shareRates';
import ShareSparkline from './ShareSparkline';
import CompanyLogo from './CompanyLogo';
import SharePriceCompare from './SharePriceCompare';
import { getBulkPricingSummary } from '../../utils/bulkPricing';
import type { Share } from '../../types';

interface ShareCardProps {
  share: Share;
  onWatchlist?: () => void;
  isWatched?: boolean;
}

export default function ShareCard({ share, onWatchlist, isWatched }: ShareCardProps) {
  const navigate = useNavigate();
  const canViewRates = useCanViewShareRates();
  const changeSign = share.changePositive ? '▲' : '▼';
  const unavailable = isShareUnavailable(share.inventoryStatus);
  const tag = getShareCardTag(share);
  const sparkline = share.priceHistory?.['3M'] ?? [];
  const bulk = getBulkPricingSummary(share);

  return (
    <div
      className="share-card"
      onClick={() => navigate(`/shares/${share.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/shares/${share.id}`)}
      role="button"
      tabIndex={0}
    >
      <div className="share-card-top">
        <CompanyLogo share={share} />
        <span className={`share-card-tag share-card-tag--${tag.kind}`}>{tag.label}</span>
      </div>

      <div className="share-card-title-row">
        <div>
          <div className="company-name">{share.name}</div>
          <div className="company-ticker">{share.ticker}</div>
        </div>
        <button
          type="button"
          className={`share-watchlist-link${isWatched ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onWatchlist?.();
          }}
          aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2l3.09 6.26 6.91 1.01-5 4.87 1.18 6.88-6.18-3.25-6.18 3.25 1.18-6.88-5-4.87 6.91-1.01z" />
          </svg>
          Watchlist
        </button>
      </div>

      <div className="share-card-sector">
        <span className="share-card-sector-label">Sector</span>
        <span className="share-card-sector-value">{share.sector || 'Unlisted'}</span>
      </div>

      <BlurredRatesLock className="share-card-rates">
        {bulk ? (
          <SharePriceCompare share={share} variant="card" />
        ) : (
          <div className="share-price-row">
            <div>
              <div className="share-price">{formatCurrency(share.price)}</div>
              <div className="share-price-sub">per share</div>
            </div>
            {share.growth ? (
              <div className={`share-change ${share.changePositive ? 'pos' : 'neg'}`}>
                {changeSign} {share.growth}
              </div>
            ) : null}
          </div>
        )}

        <div className="share-meta">
          <span>Min: {share.minQty} shares</span>
          <span>Min Investment: {formatCurrency(share.price * share.minQty)}</span>
        </div>

        {share.growth && bulk ? (
          <div className={`share-change share-change--below ${share.changePositive ? 'pos' : 'neg'}`}>
            {changeSign} {share.growth}
          </div>
        ) : null}

        {sparkline.length > 0 ? (
          <div className="chart-mini">
            <ShareSparkline data={sparkline} positive={share.changePositive} />
          </div>
        ) : null}
      </BlurredRatesLock>

      <div className="share-card-footer" onClick={(e) => e.stopPropagation()}>
        {unavailable ? (
          <Link to="/contact" className="btn-buy btn-buy-muted" onClick={(e) => e.stopPropagation()}>
            Contact Us
          </Link>
        ) : canViewRates ? (
          <Link to={`/checkout/${share.id}`} className="btn-buy" onClick={(e) => e.stopPropagation()}>
            Buy Now
          </Link>
        ) : (
          <Link
            to="/login"
            state={{ from: `/checkout/${share.id}` }}
            className="btn-buy"
            onClick={(e) => e.stopPropagation()}
          >
            Login to Buy
          </Link>
        )}
        <Link to={`/shares/${share.id}`} className="btn-detail">
          Details
        </Link>
      </div>
    </div>
  );
}
