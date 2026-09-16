/** SEBI draft prospectus status — admin sets only on selected listings. */
export const DRHP_STATUSES = [
  'Not Filed',
  'DRHP Pending',
  'DRHP Filed',
  'DRHP Approved',
] as const;

export type DrhpStatus = (typeof DRHP_STATUSES)[number];

/** Public badge only for these — rest of catalog shows nothing. */
export const DRHP_PUBLIC_STATUSES = [
  'DRHP Pending',
  'DRHP Filed',
  'DRHP Approved',
] as const;

export function normalizeDrhpStatus(raw?: string | null): DrhpStatus {
  const value = (raw || '').trim();
  if ((DRHP_STATUSES as readonly string[]).includes(value)) {
    return value as DrhpStatus;
  }
  const key = value.toLowerCase();
  if (key === 'pending' || key === 'drhp pending') return 'DRHP Pending';
  if (key === 'filed' || key === 'yes' || key === 'drhp filed') return 'DRHP Filed';
  if (key === 'approved' || key === 'drhp approved') return 'DRHP Approved';
  if (key === 'hidden' || key === "don't show" || key === 'dont show') return 'Not Filed';
  return 'Not Filed';
}

/** True only when admin chose a public DRHP state for this listing. */
export function isDrhpVisible(raw?: string | null): boolean {
  const n = normalizeDrhpStatus(raw);
  return (DRHP_PUBLIC_STATUSES as readonly string[]).includes(n);
}

export function drhpStatusKind(status: string): 'none' | 'pending' | 'filed' | 'approved' {
  const n = normalizeDrhpStatus(status);
  if (n === 'DRHP Approved') return 'approved';
  if (n === 'DRHP Filed') return 'filed';
  if (n === 'DRHP Pending') return 'pending';
  return 'none';
}

export function drhpAdminLabel(status: string): string {
  const n = normalizeDrhpStatus(status);
  if (n === 'Not Filed') return "Don't show";
  return n;
}
