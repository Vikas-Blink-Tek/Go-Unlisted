/** Match admin list search including partial mobile numbers (digits only) and UTR refs. */
export function matchesAdminSearch(
  query: string,
  ...fields: Array<string | null | undefined | number>
): boolean {
  const q = query.trim();
  if (!q) return true;

  const ql = q.toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const qNorm = q.replace(/\s+/g, '').toUpperCase();
  // Indian mobiles often typed with 91 / +91 — also match last 10 digits
  const qMobile = qDigits.length >= 10 ? qDigits.slice(-10) : '';

  return fields.some((fieldRaw) => {
    if (fieldRaw == null) return false;
    const field = String(fieldRaw);
    
    if (field.toLowerCase().includes(ql)) return true;
    
    if (qNorm.length >= 2) {
      const fieldNorm = field.replace(/\s+/g, '').toUpperCase();
      if (fieldNorm.includes(qNorm)) return true;
    }
    
    if (qDigits.length >= 3) {
      const fieldDigits = field.replace(/\D/g, '');
      if (!fieldDigits) return false;
      
      // Standard partial match (e.g. typing "989" matches "98923...")
      if (fieldDigits.includes(qDigits)) return true;
      
      // Safe reverse match: Only reverse-match if the field is substantial (e.g. at least 6 digits like a short UTR or phone without country code)
      // This prevents single-digit IDs (like "9") from matching a full phone number search
      if (fieldDigits.length >= 6 && qDigits.includes(fieldDigits)) return true;
      
      if (qMobile && fieldDigits.length >= 10) {
        const fieldMobile = fieldDigits.slice(-10);
        if (fieldMobile === qMobile || fieldMobile.includes(qMobile)) {
          return true;
        }
      }
    }
    return false;
  });
}
