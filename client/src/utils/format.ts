export const COMMISSION_RATE = 0.01;

export function formatCurrency(amount: number) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

const IST = 'Asia/Kolkata';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse MySQL / API datetimes. Our API returns India wall-clock (IST) strings
 * like "2026-07-09 16:12:00" — treat them as IST, never as UTC.
 */
export function parseDbDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s.replace(' ', 'T')}+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+$/.test(s)) {
    return new Date(`${s.split('.')[0].replace(' ', 'T')}+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00+05:30`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format IST wall-clock from API without re-converting timezones. */
function formatIstWallClock(value: string, includeSeconds = false): string | null {
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const year = m[1];
  const month = MONTHS_SHORT[Number(m[2]) - 1];
  const day = m[3];
  const hour24 = Number(m[4]);
  const minute = m[5];
  const second = m[6] || '00';
  if (!month || Number.isNaN(hour24)) return null;
  const ampm = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 || 12;
  const hh = String(hour12).padStart(2, '0');
  const time = includeSeconds ? `${hh}:${minute}:${second} ${ampm}` : `${hh}:${minute} ${ampm}`;
  return `${day} ${month} ${year}, ${time}`;
}

export function formatDate(isoString?: string) {
  const wall = isoString?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (wall) {
    const month = MONTHS_SHORT[Number(wall[2]) - 1];
    if (month) return `${wall[3]} ${month} ${wall[1]}`;
  }
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
  if (!isoString) return '—';
  const direct = formatIstWallClock(isoString, includeSeconds);
  if (direct) return direct;
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

/** Resolve order timestamp from API field variants. */
export function getOrderDate(order?: { date?: string; createdAt?: string; created_at?: string; initiatedAt?: string } | null): string | undefined {
  if (!order) return undefined;
  return order.date || order.createdAt || order.created_at || order.initiatedAt;
}

export function generateOrderId() {
  // Server assigns short sequential IDs (GU0001, GU0002…) on saveOrder when omitted.
  return '';
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

/** Title-case person / company names for admin display (e.g. "sonam gond" → "Sonam Gond"). */
export function formatPersonName(name?: string | null): string {
  const raw = (name || '').trim();
  if (!raw) return 'Guest';
  return raw
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      // Keep short all-caps tokens (e.g. LLP, PVT) as-is when already uppercase
      if (part.length <= 4 && part === part.toUpperCase() && /[A-Z]/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

export function validatePAN(pan: string) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase());
}

export function validateDemat(demat: string) {
  return /^\d{16}$/.test(demat);
}

/** True only when Site Settings explicitly enable extra charges (`'1'`). Missing/`'0'` = off. */
export function invoiceChargesEnabled(settings?: Record<string, unknown> | null): boolean {
  if (!settings) return false;
  const raw = settings.enable_invoice_charges;
  if (raw === undefined || raw === null || raw === '') return false;
  return String(raw) !== '0' && raw !== false && String(raw).toLowerCase() !== 'false';
}

function parseInvoiceCharges(settings?: Record<string, unknown> | null): Array<{ name?: string; type?: string; value?: number; price?: number }> {
  if (!settings) return [];
  try {
    const parsed = JSON.parse(String(settings.invoice_custom_charges || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcOrderTotal(pricePerShare: number, qty: number, settings?: any) {
  const subtotal = roundMoney(pricePerShare * qty);

  // No settings / charges off → total = share value only (never invent 1% fee)
  if (!invoiceChargesEnabled(settings)) return subtotal;

  let totalCharges = 0;
  const charges = parseInvoiceCharges(settings);
  for (const c of charges) {
    const val = Number(c.value ?? c.price) || 0;
    if ((c.type || 'flat') === 'percentage') {
      totalCharges += roundMoney((subtotal * val) / 100);
    } else {
      totalCharges += roundMoney(val);
    }
  }

  return roundMoney(subtotal + totalCharges);
}

export function calcOrderChargesBreakdown(pricePerShare: number, qty: number, settings?: any): { name: string; amount: number }[] {
  const subtotal = roundMoney(pricePerShare * qty);
  const breakdown: { name: string; amount: number }[] = [];

  if (!invoiceChargesEnabled(settings)) return breakdown;

  for (const c of parseInvoiceCharges(settings)) {
    const val = Number(c.value ?? c.price) || 0;
    let amt = 0;
    let label = c.name || 'Charge';
    if ((c.type || 'flat') === 'percentage') {
      amt = roundMoney((subtotal * val) / 100);
      label = `${label} (${val}%)`;
    } else {
      amt = roundMoney(val);
    }
    if (amt > 0) breakdown.push({ name: label, amount: amt });
  }

  return breakdown;
}
