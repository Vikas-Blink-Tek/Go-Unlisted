/** Direct website signups / orders without employee referral. */
export const DEFAULT_USER_CODE = 'GU00';

/**
 * Employee codes are GUE001, GUE002…
 * Legacy mistakes like GU002 (missing E) → GUE002.
 * Do not alter GU00 (direct) or order-style IDs (GU0001 = 4+ digits).
 */
export function canonicalizeEmployeeUserCode(code?: string | null): string {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized || normalized === DEFAULT_USER_CODE) return normalized;
  const m = /^GU(\d{3})$/.exec(normalized);
  if (m) return `GUE${m[1]}`;
  return normalized;
}

export function displayUserCode(code?: string | null): string {
  const normalized = canonicalizeEmployeeUserCode(code);
  return normalized || DEFAULT_USER_CODE;
}
