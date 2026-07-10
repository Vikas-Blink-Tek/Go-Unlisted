/** Match admin list search including partial mobile numbers (digits only) and UTR refs. */
export function matchesAdminSearch(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const q = query.trim();
  if (!q) return true;

  const ql = q.toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const qNorm = q.replace(/\s+/g, '').toUpperCase();
  // Indian mobiles often typed with 91 / +91 — also match last 10 digits
  const qMobile = qDigits.length >= 10 ? qDigits.slice(-10) : '';

  return fields.some((field) => {
    if (!field) return false;
    if (field.toLowerCase().includes(ql)) return true;
    if (qNorm.length >= 2) {
      const fieldNorm = field.replace(/\s+/g, '').toUpperCase();
      if (fieldNorm.includes(qNorm)) return true;
    }
    if (qDigits.length >= 3) {
      const fieldDigits = field.replace(/\D/g, '');
      if (!fieldDigits) return false;
      if (fieldDigits.includes(qDigits) || qDigits.includes(fieldDigits)) return true;
      if (qMobile && fieldDigits.length >= 10) {
        const fieldMobile = fieldDigits.slice(-10);
        if (fieldMobile === qMobile || fieldMobile.includes(qMobile) || qMobile.includes(fieldMobile)) {
          return true;
        }
      }
    }
    return false;
  });
}
