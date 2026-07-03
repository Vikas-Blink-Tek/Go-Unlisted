export const MPIN_REGEX = /^\d{4,6}$/;

export function isValidMpin(value: string) {
  return MPIN_REGEX.test(value);
}

export function mpinError(value: string) {
  if (!value) return 'MPIN is required';
  if (!isValidMpin(value)) return 'MPIN must be 4-6 digits';
  return '';
}
