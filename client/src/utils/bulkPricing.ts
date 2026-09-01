import type { Share } from '../types';

export type BulkTier = { minQty: number; price: number };

export type BulkPricingSummary = {
  tiers: BulkTier[];
  bestPrice: number;
  minQtyForBest: number;
  maxSavePerShare: number;
  maxSavePct: number;
};

export function getBulkPricingSummary(
  share: Pick<Share, 'price' | 'discountTiers'>,
): BulkPricingSummary | null {
  if (!share.discountTiers?.length) return null;

  const tiers = [...share.discountTiers].sort((a, b) => a.minQty - b.minQty);
  const base = share.price;
  let bestPrice = base;
  let minQtyForBest = tiers[0]?.minQty ?? 0;

  for (const tier of tiers) {
    if (tier.price < bestPrice) {
      bestPrice = tier.price;
      minQtyForBest = tier.minQty;
    }
  }

  if (bestPrice >= base) return null;

  const maxSavePerShare = base - bestPrice;
  const maxSavePct = base > 0 ? Math.round((maxSavePerShare / base) * 100) : 0;

  return {
    tiers,
    bestPrice,
    minQtyForBest,
    maxSavePerShare,
    maxSavePct,
  };
}

/** Price per share for a given quantity (applies best matching tier). */
export function getBulkPriceForQty(
  basePrice: number,
  qty: number,
  tiers?: BulkTier[],
): number {
  if (!tiers?.length || qty <= 0) return basePrice;
  const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
  for (const tier of sorted) {
    if (qty >= tier.minQty) return tier.price;
  }
  return basePrice;
}

export function tierSaveLabel(basePrice: number, tierPrice: number): string {
  if (basePrice <= 0 || tierPrice >= basePrice) return '';
  const pct = Math.round(((basePrice - tierPrice) / basePrice) * 100);
  return pct > 0 ? `${pct}% off` : '';
}

export function formatTierQtyRange(tier: BulkTier, nextTier?: BulkTier): string {
  if (nextTier) {
    return `${tier.minQty.toLocaleString('en-IN')} – ${(nextTier.minQty - 1).toLocaleString('en-IN')} shares`;
  }
  return `${tier.minQty.toLocaleString('en-IN')}+ shares`;
}

/** Next tier the buyer can unlock by increasing quantity. */
export function getNextBulkTier(qty: number, tiers: BulkTier[]): BulkTier | null {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  return sorted.find((t) => t.minQty > qty) ?? null;
}
