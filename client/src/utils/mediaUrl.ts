/** Resolve uploaded / absolute media paths for <img src>. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  const p = path.trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p) || p.startsWith('data:') || p.startsWith('blob:')) return p;
  return '/' + p.replace(/^\//, '');
}
