export const COMMISSION_RATE = 0.01;

export function formatCurrency(amount: number) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

const IST = 'Asia/Kolkata';

/** MySQL datetimes from our API are India wall-clock (IST). */
export function parseDbDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s.replace(' ', 'T')}+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00+05:30`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(isoString?: string) {
  const d = parseDbDateTime(isoString);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoString?: string, includeSeconds = false) {
  const d = parseDbDateTime(isoString);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  });
}

export function generateOrderId() {
  return (
    'GU' +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substring(2, 5).toUpperCase()
  );
}

export function generateSessionId() {
  return 'SES' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function formatIndianPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return phone || '—';
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function validatePAN(pan: string) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

export function validateDemat(demat: string) {
  return /^\d{16}$/.test(demat);
}

export function calcOrderTotal(pricePerShare: number, qty: number) {
  const subtotal = pricePerShare * qty;
  const fee = Math.round(subtotal * COMMISSION_RATE);
  return subtotal + fee;
}
