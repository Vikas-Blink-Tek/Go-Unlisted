/** Build NPCI UPI collect URL — opens GPay, PhonePe, Paytm, etc. on mobile. */
export type UpiPayParams = {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
};

function formatUpiAmount(amount: number): string {
  const n = Math.round(amount * 100) / 100;
  return n.toFixed(2);
}

export function buildUpiPayUrl({ vpa, payeeName, amount, note }: UpiPayParams): string {
  const pa = vpa.trim();
  const pn = payeeName.trim().slice(0, 50);
  const am = formatUpiAmount(amount);
  const params = new URLSearchParams({
    pa,
    pn,
    am,
    cu: 'INR',
  });
  if (note?.trim()) {
    params.set('tn', note.trim().slice(0, 80));
  }
  return `upi://pay?${params.toString()}`;
}

/** Android Chrome: intent URL can open a specific UPI app or the system picker. */
export function buildAndroidUpiIntentUrl(params: UpiPayParams, packageName?: string): string {
  const base = buildUpiPayUrl(params).replace(/^upi:\/\//, '');
  const pkg = packageName ? `package=${packageName};` : '';
  return `intent://${base}#Intent;scheme=upi;${pkg}end`;
}

export const UPI_APPS = [
  { id: 'any', label: 'Any UPI app', sublabel: 'GPay, PhonePe, Paytm…', packageName: undefined as string | undefined },
  { id: 'gpay', label: 'Google Pay', sublabel: 'GPay', packageName: 'com.google.android.apps.nbu.paisa.user' },
  { id: 'phonepe', label: 'PhonePe', sublabel: 'PhonePe', packageName: 'com.phonepe.app' },
  { id: 'paytm', label: 'Paytm', sublabel: 'Paytm', packageName: 'net.one97.paytm' },
] as const;

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** Open UPI payment in the user's app. Returns false if VPA missing. */
export function openUpiPay(params: UpiPayParams, preferredPackage?: string): boolean {
  const vpa = params.vpa.trim();
  if (!vpa) return false;

  const url =
    isAndroid() && preferredPackage
      ? buildAndroidUpiIntentUrl(params, preferredPackage)
      : buildUpiPayUrl(params);

  // Use location on mobile — more reliable than window.open for custom schemes
  window.location.href = url;
  return true;
}
