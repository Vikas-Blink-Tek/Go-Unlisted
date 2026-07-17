export function getOrderStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s === 'initiated') return 'Payment under review';
  if (s.includes('transfer initiated')) return 'Shares transferring to your demat';
  if (s.includes('complete')) return 'Complete — shares transferred';
  if (s.includes('confirm') || s.includes('verif')) return 'Payment verified — transfer starting';
  if (s.includes('reject')) return "Payment not matched — we'll contact you";
  if (s.includes('cancel')) return 'Order cancelled';
  if (s.includes('refund')) return 'Refund processed';
  return status;
}

/** Short labels for admin tables — avoid long buyer-facing copy wrapping in pills. */
export function getAdminOrderStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s === 'initiated') return 'Pending';
  if (s.includes('transfer initiated')) return 'Transferring';
  if (s.includes('complete')) return 'Completed';
  if (s.includes('confirm') || s.includes('verif')) return 'Verified';
  if (s.includes('reject')) return 'Rejected';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('refund')) return 'Refunded';
  return status;
}

export function getOrderStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('confirm') || s.includes('verif') || s.includes('complete') || s.includes('transfer')) return 'status-confirmed';
  if (s.includes('pending') || s.includes('initiated')) return 'status-pending';
  if (s.includes('cancel') || s.includes('reject') || s.includes('refund')) return 'status-cancelled';
  return '';
}

export const PENDING_ORDER_STATUSES = ['pending verification', 'pending', 'initiated'];

export function isPendingOrder(status: string): boolean {
  const s = status.toLowerCase();
  return PENDING_ORDER_STATUSES.some((p) => s.includes(p));
}

export function canMarkOrderComplete(status: string): boolean {
  const s = status.toLowerCase();
  if (s.includes('complete')) return false;
  if (/cancel|reject|refund|pending|initiated/.test(s)) return false;
  return s.includes('confirm') || s.includes('verif') || s.includes('transfer');
}

export function canViewInvoice(status: string): boolean {
  const s = status.toLowerCase();
  if (/cancel|reject|refund|pending|initiated/.test(s)) return false;
  return true;
}
