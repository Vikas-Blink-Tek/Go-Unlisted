export function normalizeWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function whatsappUrl(number: string, message?: string): string {
  const base = `https://wa.me/${normalizeWhatsAppNumber(number)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function initiateCheckoutMessage(name: string, shareName: string, qty: number, amount: string): string {
  const who = name && name !== 'Guest' ? name : 'there';
  return `Hi ${who}, you started checkout for ${shareName} (${qty} shares, ${amount}) on Go-Unlisted. Need help completing payment? Reply here and we'll assist.`;
}
