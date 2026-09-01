import { formatCurrency } from '../../utils/format';
import {
  formatTierQtyRange,
  getBulkPricingSummary,
  getBulkPriceForQty,
  getNextBulkTier,
  tierSaveLabel,
} from '../../utils/bulkPricing';
import type { Share } from '../../types';

type Props = {
  share?: Share;
  variant?: 'badge' | 'card' | 'detail' | 'banner' | 'checkout';
  qty?: number;
  onViewTiers?: () => void;
  bulkCount?: number;
  className?: string;
};

export default function BulkDiscountCallout({
  share,
  variant = 'card',
  qty = 0,
  onViewTiers,
  bulkCount = 0,
  className = '',
}: Props) {
  if (variant === 'banner') {
    if (bulkCount <= 0) return null;
    return (
      <div className={`bulk-discount-banner${className ? ` ${className}` : ''}`}>
        <div className="bulk-discount-banner-icon" aria-hidden>🏷️</div>
        <div className="bulk-discount-banner-body">
          <strong>Buy more, save more</strong>
          <p>
            {bulkCount} {bulkCount === 1 ? 'stock offers' : 'stocks offer'} bulk-order discounts — higher quantity means
            lower per-share price. Look for the <span className="bulk-discount-banner-tag">BULK SAVE</span> badge on listings.
          </p>
        </div>
      </div>
    );
  }

  if (!share) return null;
  const bulk = getBulkPricingSummary(share);
  if (!bulk) return null;

  if (variant === 'badge') {
    return (
      <div className={`bulk-discount-badge${className ? ` ${className}` : ''}`}>
        <span className="bulk-discount-badge-tag">BULK SAVE</span>
        <span>Up to {bulk.maxSavePct}% off</span>
      </div>
    );
  }

  if (variant === 'checkout') {
    const activePrice = getBulkPriceForQty(share.price, qty, bulk.tiers);
    const hasDiscount = activePrice < share.price;
    const nextTier = getNextBulkTier(qty, bulk.tiers);

    return (
      <div className={`bulk-discount-checkout${className ? ` ${className}` : ''}`}>
        <div className="bulk-discount-checkout-head">
          <span className="bulk-discount-checkout-icon" aria-hidden>🏷️</span>
          <div>
            <strong>Bulk order discount</strong>
            <p>Order higher quantity — pay less per share automatically at checkout.</p>
          </div>
        </div>

        {hasDiscount ? (
          <div className="bulk-discount-checkout-active">
            You&apos;re saving{' '}
            <strong>{formatCurrency(share.price - activePrice)}</strong> per share (
            {tierSaveLabel(share.price, activePrice)}) at {qty.toLocaleString('en-IN')} shares.
          </div>
        ) : (
          <div className="bulk-discount-checkout-hint">
            Buy <strong>{bulk.minQtyForBest.toLocaleString('en-IN')}+</strong> shares to unlock up to{' '}
            <strong>{bulk.maxSavePct}%</strong> off per share.
          </div>
        )}

        {nextTier && (
          <div className="bulk-discount-checkout-next">
            Add <strong>{(nextTier.minQty - qty).toLocaleString('en-IN')}</strong> more shares to get{' '}
            <strong>{formatCurrency(nextTier.price)}</strong>/share ({tierSaveLabel(share.price, nextTier.price)}).
          </div>
        )}

        {onViewTiers && (
          <button type="button" className="bulk-discount-checkout-link" onClick={onViewTiers}>
            View all bulk slabs →
          </button>
        )}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={`bulk-discount-detail${className ? ` ${className}` : ''}`}>
        <div className="bulk-discount-detail-head">
          <span className="bulk-discount-detail-icon" aria-hidden>🏷️</span>
          <div>
            <div className="bulk-discount-detail-title">Bulk order = lower price per share</div>
            <p>
              Increase quantity and your per-share rate drops automatically. Save up to{' '}
              <strong>{bulk.maxSavePct}%</strong> when you buy <strong>{bulk.minQtyForBest.toLocaleString('en-IN')}+</strong>{' '}
              shares.
            </p>
          </div>
        </div>
        <ul className="bulk-discount-tier-chips">
          {bulk.tiers.map((tier, idx) => {
            const next = bulk.tiers[idx + 1];
            const save = tierSaveLabel(share.price, tier.price);
            return (
              <li key={`${tier.minQty}-${tier.price}`}>
                <span className="bulk-discount-tier-qty">{formatTierQtyRange(tier, next)}</span>
                <span className="bulk-discount-tier-save">{save || 'Special rate'}</span>
              </li>
            );
          })}
        </ul>
        <p className="bulk-discount-detail-foot">
          Discount applies at checkout — no coupon needed. Login to see exact rates.
        </p>
      </div>
    );
  }

  // card (listing)
  const topTiers = bulk.tiers.slice(0, 2);
  return (
    <div
      className={`bulk-discount-card${className ? ` ${className}` : ''}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="bulk-discount-card-tag">BULK SAVE</span>
      <div className="bulk-discount-card-text">
        <strong>Buy more, pay less</strong>
        <span>
          Up to {bulk.maxSavePct}% off from {bulk.minQtyForBest.toLocaleString('en-IN')}+ shares
        </span>
      </div>
      {topTiers.length > 0 && (
        <div className="bulk-discount-card-slabs">
          {topTiers.map((tier) => {
            const save = tierSaveLabel(share.price, tier.price);
            return (
              <span key={`${tier.minQty}-${tier.price}`} className="bulk-discount-card-slab">
                {tier.minQty.toLocaleString('en-IN')}+ → {save}
              </span>
            );
          })}
          {bulk.tiers.length > 2 && (
            <span className="bulk-discount-card-slab bulk-discount-card-slab-more">+ more slabs</span>
          )}
        </div>
      )}
    </div>
  );
}
