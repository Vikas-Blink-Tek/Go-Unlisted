/** Canonical order statuses (ops pipeline). */
export const ORDER_STATUS = {
  PENDING_VERIFICATION: 'Pending Verification',
  TRANSFER_PENDING: 'Transfer Pending',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
} as const;

export function getOrderStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') && s.includes('transfer')) return 'Shares transferring to your demat';
  if (s.includes('transfer')) return 'Shares transferring to your demat';
  if (s.includes('pending') || s === 'initiated') return 'Payment under review';
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
  if (s.includes('pending') && s.includes('transfer')) return 'Pending Share Transfer';
  if (s.includes('transfer')) return 'Pending Share Transfer';
  if (s.includes('pending') || s === 'initiated') return 'Pending';
  if (s.includes('complete')) return 'Order Complete';
  if (s.includes('confirm') || s.includes('verif')) return 'Pending Share Transfer';
  if (s.includes('reject')) return 'Rejected';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('refund')) return 'Refunded';
  return status;
}

export function getOrderStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'status-confirmed';
  // Share transfer still pending — show as pending (not green complete)
  if (s.includes('transfer') || ((s.includes('confirm') || s.includes('verif')) && !s.includes('pending'))) {
    return 'status-pending';
  }
  if (s.includes('pending') || s.includes('initiated')) return 'status-pending';
  if (s.includes('cancel') || s.includes('reject') || s.includes('refund')) return 'status-cancelled';
  return '';
}

export const PENDING_ORDER_STATUSES = ['pending verification', 'pending'];

export function isPendingOrder(status: string): boolean {
  const s = status.toLowerCase();
  if (s.includes('transfer')) return false;
  return PENDING_ORDER_STATUSES.some((p) => s.includes(p)) || s === 'initiated';
}

/** Payment verified — waiting for off-market demat transfer (or legacy Confirmed). */
export function isTransferPendingOrder(status: string): boolean {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('cancel') || s.includes('reject') || s.includes('refund')) return false;
  if (s.includes('transfer')) return true;
  // Legacy: Verified/Confirmed before Transfer Pending existed
  return s.includes('confirm') || s.includes('verif');
}

export function canMarkOrderComplete(status: string): boolean {
  return isTransferPendingOrder(status);
}

export function canUndoOrderComplete(status: string): boolean {
  return status.toLowerCase().includes('complete');
}

export function canViewInvoice(status: string): boolean {
  const s = status.toLowerCase();
  if (/cancel|reject|refund/.test(s)) return false;
  if (isPendingOrder(s)) return false;
  return s.includes('confirm') || s.includes('verif') || s.includes('transfer') || s.includes('complete');
}
