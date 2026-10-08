const SITE_HOSTS = ['go-unlisted.com', 'www.go-unlisted.com', 'gounlisted.in', 'www.gounlisted.in'];

export type DealLink = { internal: string } | { external: string };

/**
 * Admin may paste a path ("/shares/zepto"), a bare path ("shares/zepto") or a full site URL
 * ("https://go-unlisted.com/shares/zepto"). Our own URLs stay in-app (same tab, works for guests);
 * only genuinely external sites open in a new tab.
 */
export function resolveDealLink(raw: string | null | undefined): DealLink {
  let link = (raw || '').trim();
  if (!link) return { internal: '/shares' };

  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(link)) {
    link = `https://${link}`;
  }

  if (/^https?:\/\//i.test(link)) {
    try {
      const url = new URL(link);
      const host = url.host.toLowerCase();
      const currentHost = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
      if (SITE_HOSTS.includes(host) || host === currentHost) {
        return { internal: `${url.pathname || '/'}${url.search}${url.hash}` };
      }
      return { external: url.toString() };
    } catch {
      return { internal: '/shares' };
    }
  }

  return { internal: link.startsWith('/') ? link : `/${link}` };
}

export function shareSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
