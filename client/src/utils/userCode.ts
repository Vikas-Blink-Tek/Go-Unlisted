/** Direct website signups / orders without employee referral. */
export const DEFAULT_USER_CODE = 'GU00';

export function displayUserCode(code?: string | null): string {
  const normalized = (code || '').trim().toUpperCase();
  return normalized || DEFAULT_USER_CODE;
}
