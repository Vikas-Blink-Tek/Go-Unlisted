/** Exchange-listed / IPO-done — not sold as unlisted inventory. */
export function isExchangeListedShare(share: {
  listingType?: string | null;
  listingPrice?: number | null;
}): boolean {
  const type = (share.listingType || '').trim().toLowerCase();
  if (type === 'listed' || type === 'exchange listed' || type === 'nse listed' || type === 'bse listed') {
    return true;
  }
  return share.listingPrice != null && share.listingPrice > 0;
}

export function isShareUnavailable(status?: string): boolean {
  return status === 'Out of Stock';
}

/** Investor may place an online / app order. */
export function isSharePurchasable(share: {
  inventoryStatus?: string | null;
  listingType?: string | null;
  listingPrice?: number | null;
  purchasable?: boolean;
  isFeatured?: boolean;
  price?: number | null;
  ratesVisible?: boolean | null;
}): boolean {
  // API already computed purchasability from real base price (before guest rate mask).
  if (share.purchasable === false) return false;
  if (isShareUnavailable(share.inventoryStatus || undefined)) return false;
  // Featured = Market Activity sample / dummy — not for checkout
  if (share.isFeatured) return false;
  if (isExchangeListedShare(share)) return false;
  // Guests get price masked to 0 — don't treat that as non-purchasable.
  if (share.purchasable === true) return true;
  if (share.ratesVisible === false) return true;
  if (share.price != null && share.price <= 0) return false;
  return true;
}

export function isShareOnRequest(status?: string): boolean {
  return status === 'On Request';
}

export function getInventoryBadge(status?: string): string | null {
  if (!status || status === 'In Stock') return null;
  return status;
}
