import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveOffers } from '../../api/offers';
import { mediaUrl } from '../../utils/mediaUrl';
import { resolveDealLink } from '../../utils/dealLink';
import type { FestivalOffer } from '../../types';

function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return useMemo(() => {
    if (!targetIso) return null;
    const target = new Date(targetIso.replace(' ', 'T')).getTime();
    if (isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return { expired: true, text: 'Expired', days: 0, hours: 0, minutes: 0, seconds: 0 };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const pad = (n: number) => String(n).padStart(2, '0');
    let text = `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
    if (days > 0) {
      text = `${days}d : ${text}`;
    }

    return { expired: false, text, days, hours, minutes, seconds };
  }, [targetIso, now]);
}

const FESTIVE_RE = /festiv/i;

/** Client positions every promo as a "Best Deal" — never surface festival wording. */
function toBestDealWording(value: string | null | undefined, fallback: string): string {
  const v = (value || '').trim();
  if (!v) return '';
  return FESTIVE_RE.test(v) ? fallback : v;
}

/** Deal banner artwork ratio — admin uploads 1600×400 (4:1) so the image is never cropped or covered. */
export const DEAL_BANNER_RATIO = 4;

/**
 * Stored display_mode values (kept for API compatibility):
 *  background → Full Banner: 4:1 artwork on top, details strip below
 *  split      → Side Poster: details left, poster right (any ratio, never cropped)
 *  full-image → Image Only: artwork at its own ratio, whole banner clickable
 */
export type DealLayout = 'background' | 'split' | 'full-image';

export function OfferCard({
  offer: rawOffer,
  variant = 'hero',
  preview = false,
}: {
  offer: FestivalOffer;
  variant?: 'hero' | 'catalog' | 'compact';
  preview?: boolean;
}) {
  const offer: FestivalOffer = {
    ...rawOffer,
    tagline: toBestDealWording(rawOffer.tagline, '⭐ Best Deal') || '⭐ Best Deal',
    discountText: toBestDealWording(rawOffer.discountText, 'BEST PRICE'),
    ctaText: toBestDealWording(rawOffer.ctaText, 'Claim Best Deal →'),
  };
  const countdown = useCountdown(offer.endsAt);
  const [copied, setCopied] = useState(false);
  const [posterRatio, setPosterRatio] = useState<number | null>(null);

  const ctaLabel = useMemo(() => {
    if (offer.ctaText?.trim()) return offer.ctaText.trim();
    const hay = `${offer.title} ${offer.tagline || ''}`.toLowerCase();
    if (hay.includes('bulk')) return 'Claim Bulk Deal →';
    if (hay.includes('flash')) return 'Claim Flash Deal →';
    return 'Claim Best Deal →';
  }, [offer.ctaText, offer.title, offer.tagline]);

  if (countdown?.expired && !preview) {
    return null;
  }

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (offer.couponCode) {
      navigator.clipboard.writeText(offer.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bannerImage = offer.imageUrl ? mediaUrl(offer.imageUrl) : null;
  const dealLink = resolveDealLink(offer.linkUrl);
  const isExternalLink = 'external' in dealLink;
  const linkTarget = 'external' in dealLink ? dealLink.external : dealLink.internal;

  const ctaButton = isExternalLink ? (
    <a href={linkTarget} target="_blank" rel="noopener noreferrer" className="btn btn-primary deal-banner-cta">
      {ctaLabel}
    </a>
  ) : (
    <Link to={linkTarget} className="btn btn-primary deal-banner-cta">
      {ctaLabel}
    </Link>
  );

  const tagline = offer.tagline || '⭐ Best Deal';
  const hasEmoji = /^[⭐🔥⏳⚡✨💥💎]/u.test(tagline);

  const badges = (
    <div className="deal-banner-badges">
      <span className="deal-badge deal-badge--tag">{hasEmoji ? tagline : `⭐ ${tagline}`}</span>
      {countdown && !countdown.expired && (
        <span className="deal-badge deal-badge--timer">
          <span className="deal-badge-dot" aria-hidden />
          ENDS IN <strong>{countdown.text}</strong>
        </span>
      )}
    </div>
  );

  const details = (
    <div className="deal-banner-details">
      {badges}
      <h2 className="deal-banner-title">{offer.title}</h2>
      {(offer.discountText || offer.description) && (
        <div className="deal-banner-sub">
          {offer.discountText && <span className="deal-banner-discount">{offer.discountText}</span>}
          {offer.description && <span className="deal-banner-desc">{offer.description}</span>}
        </div>
      )}
    </div>
  );

  const actions = (
    <div className="deal-banner-actions">
      {ctaButton}
      {offer.couponCode && (
        <button type="button" onClick={copyCode} className="deal-banner-coupon">
          CODE: <strong>{offer.couponCode}</strong>
          <span>({copied ? 'Copied!' : 'Copy'})</span>
        </button>
      )}
    </div>
  );

  const layout: DealLayout = (['background', 'split', 'full-image'] as const).includes(offer.displayMode as DealLayout)
    ? (offer.displayMode as DealLayout)
    : 'background';

  const wrapLink = (child: React.ReactNode, className: string) => (isExternalLink ? (
    <a href={linkTarget} target="_blank" rel="noopener noreferrer" className={className}>{child}</a>
  ) : (
    <Link to={linkTarget} className={className}>{child}</Link>
  ));

  const backdrop = bannerImage ? (
    <span className="deal-banner-backdrop" aria-hidden style={{ backgroundImage: `url("${bannerImage}")` }} />
  ) : null;

  if (bannerImage && layout === 'full-image') {
    return (
      <div className={`deal-banner deal-banner--image-only deal-banner--${variant}`}>
        {wrapLink(<img src={bannerImage} alt={offer.title} className="deal-banner-image deal-banner-image--natural" />, 'deal-banner-image-link')}
      </div>
    );
  }

  if (bannerImage && layout === 'split') {
    return (
      <div
        className={`deal-banner deal-banner--side deal-banner--${variant}`}
        style={posterRatio ? ({ '--deal-poster-ratio': posterRatio } as React.CSSProperties) : undefined}
      >
        <div className="deal-banner-bar deal-banner-bar--stacked">
          {details}
          {actions}
        </div>
        {wrapLink(
          <>
            {backdrop}
            <img
              src={bannerImage}
              alt={offer.title}
              className="deal-banner-poster"
              onLoad={(e) => {
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (w && h) setPosterRatio(Math.min(4.5, Math.max(1.5, w / h)));
              }}
            />
          </>,
          'deal-banner-poster-link',
        )}
      </div>
    );
  }

  if (bannerImage) {
    return (
      <div className={`deal-banner deal-banner--image deal-banner--${variant}`}>
        {wrapLink(
          <>
            {backdrop}
            <img
              src={bannerImage}
              alt={offer.title}
              className="deal-banner-image"
              style={{ aspectRatio: `${DEAL_BANNER_RATIO} / 1` }}
            />
          </>,
          'deal-banner-image-link',
        )}
        <div className="deal-banner-bar">
          {details}
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={`deal-banner deal-banner--text deal-banner--${variant}`}>
      <div className="deal-banner-bar deal-banner-bar--stacked">
        {details}
        {actions}
      </div>
    </div>
  );
}

export default function FestivalBannerSlider({
  variant = 'hero',
  className = '',
}: {
  variant?: 'hero' | 'catalog' | 'compact';
  className?: string;
}) {
  const { data: offers = [] } = useQuery({
    queryKey: ['active-offers'],
    queryFn: fetchActiveOffers,
    staleTime: 60 * 1000,
  });

  const validOffers = useMemo(() => {
    const now = Date.now();
    return offers.filter((o) => {
      if (!o.isActive) return false;
      if (!o.endsAt) return true;
      const end = new Date(o.endsAt.replace(' ', 'T')).getTime();
      return isNaN(end) || end > now;
    });
  }, [offers]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-slide every 6 seconds if multiple offers
  useEffect(() => {
    if (validOffers.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validOffers.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [validOffers.length]);

  if (validOffers.length === 0) return null;

  const currentOffer = validOffers[currentIndex % validOffers.length];

  return (
    <div
      className={`festival-slider-container ${className}`}
      style={{
        margin: variant === 'compact' ? '0.75rem 0 1.25rem' : '0 0 1rem',
      }}
    >
      <div style={{ position: 'relative' }}>
        <OfferCard key={currentOffer.id} offer={currentOffer} variant={variant} />

        {/* Carousel controls if > 1 offer */}
        {validOffers.length > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.85rem',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev - 1 + validOffers.length) % validOffers.length)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '0 4px',
              }}
              aria-label="Previous Offer"
            >
              ‹
            </button>

            {validOffers.map((o, idx) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                style={{
                  width: idx === currentIndex ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: idx === currentIndex ? 'var(--lime, #7ac142)' : 'var(--border, #ccc)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}

            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % validOffers.length)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '0 4px',
              }}
              aria-label="Next Offer"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { FestivalBannerSlider as DealBannerSlider };
