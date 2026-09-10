import type { Share } from '../types';
import { isShareUnavailable } from './inventory';

export type ShareCardTag = {
  label: string;
  kind: 'best-seller' | 'trending' | 'active' | 'limited' | 'on-request' | 'out-of-stock';
};

/**
 * UnlistedZone-style ribbon on share cards:
 * Featured → Best Seller, Top 10 → Trending, else inventory status.
 */
export function getShareCardTag(share: Pick<Share, 'isFeatured' | 'isTop10' | 'inventoryStatus'>): ShareCardTag {
  if (share.isFeatured) {
    return { label: 'Best Seller', kind: 'best-seller' };
  }
  if (share.isTop10) {
    return { label: 'Trending', kind: 'trending' };
  }
  const status = (share.inventoryStatus || 'In Stock').trim();
  if (isShareUnavailable(status) || status === 'Out of Stock') {
    return { label: 'Out of Stock', kind: 'out-of-stock' };
  }
  if (status === 'On Request') {
    return { label: 'On Request', kind: 'on-request' };
  }
  if (status === 'Limited') {
    return { label: 'Limited', kind: 'limited' };
  }
  return { label: 'Active', kind: 'active' };
}
