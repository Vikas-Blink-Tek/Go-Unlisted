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

/**
 * Split stored mobile setting into individual numbers.
 * Admin may save multiple phones as comma / newline / semicolon separated.
 * Existing single-number values keep working unchanged.
 */
export function parseSitePhones(raw?: string | null): string[] {
  const text = (raw || '').trim();
  if (!text) return [];
  const parts = text
    .split(/[,;\n|]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.replace(/\D/g, '').slice(-10) || p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Persist phone list back into the single `mobile` settings value. */
export function serializeSitePhones(phones: string[]): string {
  return phones.map((p) => p.trim()).filter(Boolean).join(', ');
}

/** First phone — WhatsApp sync, primary tel:, float fallback. */
export function primarySitePhone(raw?: string | null): string {
  return parseSitePhones(raw)[0] || '';
}

/** Format a single phone for display; keeps +91 spacing when possible. */
export function formatSitePhoneDisplay(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return (raw || '').trim() || '—';
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

/** Format all stored phones for one-line display (footer preview, invoices). */
export function formatSitePhonesDisplay(raw?: string | null): string {
  const phones = parseSitePhones(raw);
  if (phones.length === 0) return '—';
  return phones.map(formatSitePhoneDisplay).join(' · ');
}

/** Digits for tel: href from a single phone string. */
export function sitePhoneTelHref(raw?: string | null): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length >= 10) return `+91${digits.slice(-10)}`;
  return digits ? `+${digits}` : '';
}
