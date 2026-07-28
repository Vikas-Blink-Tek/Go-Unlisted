export function kycBadgeClass(status?: string) {
  if (status === 'Verified') return 'verified';
  if (status === 'Under Review') return 'pending';
  if (status === 'Rejected') return 'rejected';
  return 'not-submitted';
}

export function kycBadgeLabel(status?: string) {
  if (status === 'Verified') return 'KYC';
  if (status === 'Under Review') return 'Review';
  if (status === 'Rejected') return 'Rejected';
  return 'No KYC';
}

export function userInitials(name?: string, email?: string) {
  if (name?.trim()) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.[0]?.toUpperCase() || '?';
}

export function isPdfProof(path?: string | null): boolean {
  return !!path && /\.pdf$/i.test(path);
}

/** Authenticated CMR / demat proof URL (admin or owning user session). */
export function kycProofViewUrl(opts: { userId?: string; path?: string | null }): string | null {
  const params = new URLSearchParams({ action: 'viewKycProof' });
  if (opts.userId) {
    params.set('userId', opts.userId);
    return `/api/api.php?${params.toString()}`;
  }
  const path = (opts.path || '').replace(/^\//, '').trim();
  if (!path) return null;
  params.set('file', path);
  return `/api/api.php?${params.toString()}`;
}
