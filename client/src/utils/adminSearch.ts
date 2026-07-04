/** Match admin list search including partial mobile numbers (digits only). */
export function matchesAdminSearch(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const q = query.trim();
  if (!q) return true;

  const ql = q.toLowerCase();
  const qDigits = q.replace(/\D/g, '');

  return fields.some((field) => {
    if (!field) return false;
    if (field.toLowerCase().includes(ql)) return true;
    if (qDigits.length >= 3) {
      const fieldDigits = field.replace(/\D/g, '');
      if (fieldDigits.includes(qDigits)) return true;
    }
    return false;
  });
}
