export function isShareUnavailable(status?: string): boolean {
  return status === 'Out of Stock';
}

export function isShareOnRequest(status?: string): boolean {
  return status === 'On Request';
}

export function getInventoryBadge(status?: string): string | null {
  if (!status || status === 'In Stock') return null;
  return status;
}
