/** One order can be paid in parts — split "A/B", "A, B", "A B" or one-per-line into UTRs (mirrors api normalizePaymentRefs). */
export function normalizePaymentRefs(raw: string): { ok: boolean; value: string; parts: string[]; error: string } {
  const parts = Array.from(new Set(raw.toUpperCase().split(/[\s,/;|+]+/).filter(Boolean)));
  if (parts.length === 0) return { ok: true, value: '', parts, error: '' };
  if (parts.length > 8) return { ok: false, value: '', parts, error: 'Maximum 8 payment references per order' };
  const bad = parts.find((p) => p.length < 6 || p.length > 30 || !/^[A-Z0-9\-_.]+$/.test(p));
  if (bad) return { ok: false, value: '', parts, error: `Invalid payment reference "${bad}" — each UTR must be 6–30 letters/numbers` };
  return { ok: true, value: parts.join(' / '), parts, error: '' };
}
