/** Fallback company contact — used until Admin → Site Settings is saved. */
export const SITE_CONTACT_DEFAULTS = {
  email: 'infogounlisted@gmail.com',
  /** Display format for phone on Contact / Footer */
  mobile: '+91 81694 49826',
  /** Digits for wa.me (with country code) */
  whatsapp: '918169449826',
  address: 'Malad West, Ijmima, Mumbai – 400064',
} as const;

export const SITE_BANK_DEFAULTS = {
  bank_name: 'Kotak Mahindra Bank',
  bank_ac_name: 'GOUNLISTED',
  bank_ac_no: '0053829665',
  bank_ifsc: 'KKBK0001364',
  bank_upi: 'gounlisted@kotak',
  bank_branch: 'MUM - ANDHERI - SAKIVIHAR ROAD',
  bank_address: 'HYDE PARK, MAROL, SAKI VIHAR ROAD, ANDHERI EAST, Mumbai 400072',
} as const;

export const SITE_DISCLAIMER_DEFAULT =
  'Trading in unlisted shares carries significant risk. GO UNLISTED is not a SEBI-registered broker.';

/** Format a phone for display; keeps +91 spacing when possible. */
export function formatSitePhoneDisplay(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return (raw || '').trim() || '—';
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
