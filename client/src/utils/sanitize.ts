/** Basic HTML sanitizer for article content display (defense-in-depth; server also sanitizes on save) */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, form').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on') || value.toLowerCase().includes('javascript:')) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === 'style') {
        const m = value.match(/text-align\s*:\s*(left|right|center|justify)\s*;?/i);
        if (m) {
          el.setAttribute('style', `text-align: ${m[1].toLowerCase()};`);
        } else {
          el.removeAttribute('style');
        }
      }
    });
  });
  return doc.body.innerHTML;
}
