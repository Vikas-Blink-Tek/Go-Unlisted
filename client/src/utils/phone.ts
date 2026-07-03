/** Normalize to 10-digit Indian mobile (strip country code / leading 0). */
export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

/** Valid Indian mobile: 10 digits starting with 6–9. */
export function isValidIndianMobile(raw: string): boolean {
  const p = normalizeIndianPhone(raw);
  return /^[6-9]\d{9}$/.test(p);
}
