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
