import { formatCurrency } from '../../utils/format';
import {
  formatTierQtyRange,
  getBulkPriceForQty,
  getBulkPricingSummary,
  getNextBulkTier,
  tierSaveLabel,
} from '../../utils/bulkPricing';
import type { Share } from '../../types';

type Props = {
  share: Share;
  variant?: 'card' | 'detail' | 'checkout';
  qty?: number;
  onViewAllTiers?: () => void;
  className?: string;
};

function saveLine(basePrice: number, bulkPrice: number) {
  const save = basePrice - bulkPrice;
  if (save <= 0) return null;
  const pct = basePrice > 0 ? Math.round((save / basePrice) * 100) : 0;
  return { save, pct };
}

/** Side-by-side regular vs bulk price — clear comparison for buyers. */
export default function SharePriceCompare({
  share,
  variant = 'card',
  qty = 0,
  onViewAllTiers,
  className = '',
}: Props) {
  const bulk = getBulkPricingSummary(share);

  if (variant === 'checkout' && bulk) {
    const activePrice = getBulkPriceForQty(share.price, qty, bulk.tiers);
    const applied = saveLine(share.price, activePrice);
    const nextTier = getNextBulkTier(qty, bulk.tiers);

    return (
      <div className={`price-compare price-compare--checkout${className ? ` ${className}` : ''}`}>
        <div className="price-compare-checkout-grid">
          <div className="price-compare-col">
            <span className="price-compare-label">Regular price</span>
            <span className="price-compare-value">{formatCurrency(share.price)}</span>
            <span className="price-compare-note">per share</span>
          </div>
          <div className="price-compare-arrow" aria-hidden>→</div>
          <div className="price-compare-col price-compare-col--bulk">
            <span className="price-compare-label">Your price ({qty.toLocaleString('en-IN')} shares)</span>
            <span className="price-compare-value price-compare-value--bulk">{formatCurrency(activePrice)}</span>
            <span className="price-compare-note">per share</span>
            {applied && (
              <span className="price-compare-save">
                Save {formatCurrency(applied.save)} ({applied.pct}%)
              </span>
            )}
          </div>
        </div>
        {!applied && bulk && (
          <p className="price-compare-hint">
            Buy <strong>{bulk.minQtyForBest.toLocaleString('en-IN')}+</strong> shares for bulk rate{' '}
            <strong>{formatCurrency(bulk.bestPrice)}</strong>/share.
          </p>
        )}
        {nextTier && (
          <p className="price-compare-hint">
            Add <strong>{(nextTier.minQty - qty).toLocaleString('en-IN')}</strong> more for{' '}
            <strong>{formatCurrency(nextTier.price)}</strong>/share ({tierSaveLabel(share.price, nextTier.price)}).
          </p>
        )}
        {onViewAllTiers && (
          <button type="button" className="price-compare-link" onClick={onViewAllTiers}>
            View all bulk slabs →
          </button>
        )}
      </div>
    );
  }

  if (!bulk) return null;

  const best = saveLine(share.price, bulk.bestPrice)!;

  if (variant === 'detail') {
    return (
      <div className={`price-compare price-compare--detail${className ? ` ${className}` : ''}`}>
        <div className="price-compare-detail-head">
          <h3>Price comparison</h3>
          <p>Regular rate vs bulk rate — discount is automatic when you order higher quantity.</p>
        </div>

        <div className="price-compare-highlight">
          <div className="price-compare-col">
            <span className="price-compare-label">Regular price</span>
            <span className="price-compare-value price-compare-value--strike">{formatCurrency(share.price)}</span>
            <span className="price-compare-note">Min lot: {share.minQty.toLocaleString('en-IN')} shares</span>
          </div>
          <div className="price-compare-arrow" aria-hidden>→</div>
          <div className="price-compare-col price-compare-col--bulk">
            <span className="price-compare-label">Best bulk price</span>
            <span className="price-compare-value price-compare-value--bulk">{formatCurrency(bulk.bestPrice)}</span>
            <span className="price-compare-note">{bulk.minQtyForBest.toLocaleString('en-IN')}+ shares</span>
            <span className="price-compare-save">
              You save {formatCurrency(best.save)} ({best.pct}%)
            </span>
          </div>
        </div>

        <table className="price-compare-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>Regular / share</th>
              <th>Bulk / share</th>
              <th>Discount</th>
            </tr>
          </thead>
          <tbody>
            {bulk.tiers.map((tier, idx) => {
              const next = bulk.tiers[idx + 1];
              const line = saveLine(share.price, tier.price);
              return (
                <tr key={`${tier.minQty}-${tier.price}`}>
                  <td>{formatTierQtyRange(tier, next)}</td>
                  <td className="price-compare-table-regular">{formatCurrency(share.price)}</td>
                  <td className="price-compare-table-bulk">{formatCurrency(tier.price)}</td>
                  <td className="price-compare-table-save">
                    {line ? `${formatCurrency(line.save)} (${line.pct}%)` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // card (listing)
  return (
    <div className={`price-compare price-compare--card${className ? ` ${className}` : ''}`}>
      <div className="price-compare-col">
        <span className="price-compare-label">Regular</span>
        <span className="price-compare-value">{formatCurrency(share.price)}</span>
        <span className="price-compare-note">/ share</span>
      </div>
      <div className="price-compare-arrow" aria-hidden>→</div>
      <div className="price-compare-col price-compare-col--bulk">
        <span className="price-compare-label">Bulk ({bulk.minQtyForBest.toLocaleString('en-IN')}+)</span>
        <span className="price-compare-value price-compare-value--bulk">{formatCurrency(bulk.bestPrice)}</span>
        <span className="price-compare-save">Save {best.pct}%</span>
      </div>
    </div>
  );
}
