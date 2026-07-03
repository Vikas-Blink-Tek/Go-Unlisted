export const COMMISSION_RATE = 0.01;

export function formatCurrency(amount: number) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

export function formatDate(isoString?: string) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(isoString?: string) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
