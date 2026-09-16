/** SEBI draft prospectus status — admin updates per listing. */
export const DRHP_STATUSES = [
  'Not Filed',
  'DRHP Pending',
  'DRHP Filed',
  'DRHP Approved',
] as const;

export type DrhpStatus = (typeof DRHP_STATUSES)[number];

export function normalizeDrhpStatus(raw?: string | null): DrhpStatus {
  const value = (raw || '').trim();
  if ((DRHP_STATUSES as readonly string[]).includes(value)) {
    return value as DrhpStatus;
  }
  const key = value.toLowerCase();
  if (key === 'pending' || key === 'drhp pending') return 'DRHP Pending';
  if (key === 'filed' || key === 'yes' || key === 'drhp filed') return 'DRHP Filed';
  if (key === 'approved' || key === 'drhp approved') return 'DRHP Approved';
  return 'Not Filed';
}

export function drhpStatusKind(status: string): 'none' | 'pending' | 'filed' | 'approved' {
  const n = normalizeDrhpStatus(status);
  if (n === 'DRHP Approved') return 'approved';
  if (n === 'DRHP Filed') return 'filed';
  if (n === 'DRHP Pending') return 'pending';
  return 'none';
}
