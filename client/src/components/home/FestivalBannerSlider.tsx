import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveOffers } from '../../api/offers';
import { mediaUrl } from '../../utils/mediaUrl';
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

function OfferCard({ offer: rawOffer, variant = 'hero' }: { offer: FestivalOffer; variant?: 'hero' | 'catalog' | 'compact' }) {
  const offer: FestivalOffer = {
    ...rawOffer,
    tagline: toBestDealWording(rawOffer.tagline, '⭐ Best Deal') || '⭐ Best Deal',
    discountText: toBestDealWording(rawOffer.discountText, 'BEST PRICE'),
    ctaText: toBestDealWording(rawOffer.ctaText, 'Claim Best Deal →'),
  };
  const countdown = useCountdown(offer.endsAt);
  const [copied, setCopied] = useState(false);

  if (countdown?.expired) {
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

  const bgImage = offer.imageUrl ? mediaUrl(offer.imageUrl) : null;
  const mode = bgImage ? (offer.displayMode || 'split') : 'background';

  // Determine CTA button text dynamically if not explicitly specified
  const ctaLabel = useMemo(() => {
    if (offer.ctaText?.trim()) return offer.ctaText.trim();
    const hay = `${offer.title} ${offer.tagline || ''}`.toLowerCase();
    if (hay.includes('bulk')) return 'Claim Bulk Deal →';
    if (hay.includes('flash')) return 'Claim Flash Deal →';
    return 'Claim Best Deal →';
  }, [offer.ctaText, offer.title, offer.tagline]);

  // Detect if link is external (http/https)
  const linkTarget = offer.linkUrl || '/shares';
  const isExternalLink = /^https?:\/\//i.test(linkTarget);

  const ctaButton = isExternalLink ? (
    <a
      href={linkTarget}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-primary"
      style={{
        padding: '0.65rem 1.4rem',
        fontWeight: 700,
        fontSize: '0.92rem',
        boxShadow: '0 4px 16px rgba(122, 193, 66, 0.35)',
        textDecoration: 'none',
      }}
    >
      {ctaLabel}
    </a>
  ) : (
    <Link
      to={linkTarget}
      className="btn btn-primary"
      style={{
        padding: '0.65rem 1.4rem',
        fontWeight: 700,
        fontSize: '0.92rem',
        boxShadow: '0 4px 16px rgba(122, 193, 66, 0.35)',
      }}
    >
      {ctaLabel}
    </Link>
  );

  const couponBtn = offer.couponCode ? (
    <button
      type="button"
      onClick={copyCode}
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1px dashed rgba(255,255,255,0.4)',
        color: '#ffffff',
        padding: '0.55rem 1rem',
        borderRadius: 8,
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        transition: 'all 0.2s',
      }}
    >
      CODE: <strong style={{ color: '#9ff562', letterSpacing: '0.05em' }}>{offer.couponCode}</strong>
      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({copied ? 'Copied!' : 'Click to Copy'})</span>
    </button>
  ) : null;

  // --- Tagline & Countdown badges ---
  const badges = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: '0.85rem' }}>
      {offer.tagline && (
        <span
          style={{
            background: offer.tagline.toLowerCase().includes('deal')
              ? 'rgba(255, 193, 7, 0.18)'
              : 'rgba(122, 193, 66, 0.22)',
            border: `1px solid ${offer.tagline.toLowerCase().includes('deal') ? '#ffc107' : '#7ac142'}`,
            color: offer.tagline.toLowerCase().includes('deal') ? '#ffd54f' : '#9ff562',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '3px 12px',
            borderRadius: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {offer.tagline.includes('⭐') || offer.tagline.includes('🔥') || offer.tagline.includes('⏳') || offer.tagline.includes('⚡') || offer.tagline.includes('✨')
            ? offer.tagline
            : `⭐ ${offer.tagline}`}
        </span>
      )}

      {countdown && !countdown.expired && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(239, 68, 68, 0.22)',
            border: '1px solid rgba(239, 68, 68, 0.55)',
            color: '#fca5a5',
            fontSize: '0.82rem',
            fontWeight: 800,
            padding: '3px 12px',
            borderRadius: 20,
            letterSpacing: '0.02em',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 10px #ef4444',
            }}
          />
          DEAL ENDS IN: <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: 700 }}>{countdown.text}</span>
        </div>
      )}
    </div>
  );

  const textContent = (
    <>
      {badges}
      <h2
        style={{
          margin: '0 0 0.5rem',
          fontSize: variant === 'compact' ? 'clamp(1.2rem, 2.5vw, 1.65rem)' : 'clamp(1.4rem, 3.2vw, 2.1rem)',
          fontWeight: 800,
          lineHeight: 1.18,
          letterSpacing: '-0.02em',
          color: '#ffffff',
        }}
      >
        {offer.title}
      </h2>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {offer.discountText && (
          <span
            style={{
              fontSize: variant === 'compact' ? 'clamp(1rem, 2vw, 1.25rem)' : 'clamp(1.1rem, 2.2vw, 1.4rem)',
              fontWeight: 800,
              color: '#7ac142',
              textShadow: '0 2px 10px rgba(122, 193, 66, 0.35)',
              background: 'rgba(122, 193, 66, 0.15)',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid rgba(122, 193, 66, 0.3)',
            }}
          >
            {offer.discountText}
          </span>
        )}
        {offer.description && (
          <span style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
            {offer.description}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {ctaButton}
        {couponBtn}
      </div>
    </>
  );

  // ========================
  // MODE: SPLIT — text left, image right (never crops, works with any image size)
  // ========================
  if (mode === 'split') {
    return (
      <div
        className={`festival-banner-card festival-banner-card--${variant}`}
        style={{
          position: 'relative',
          borderRadius: 20,
          overflow: 'hidden',
          minHeight: variant === 'compact' ? 170 : 210,
          display: 'flex',
          flexDirection: 'row',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.22)',
          background: 'radial-gradient(ellipse at 85% 20%, rgba(122, 193, 66, 0.16) 0%, transparent 45%), linear-gradient(135deg, #071933 0%, #0c2b53 50%, #0a2f2b 100%)',
          color: '#ffffff',
          border: '1px solid rgba(122, 193, 66, 0.28)',
        }}
      >
        {/* Left: Text content */}
        <div
          style={{
            flex: '1 1 55%',
            padding: variant === 'compact' ? '1.4rem 1.6rem' : '2rem 2.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
            minWidth: 0,
          }}
        >
          {textContent}
        </div>

        {/* Right: Full image — never cropped */}
        <div
          style={{
            flex: '0 0 40%',
            maxWidth: '40%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(0,0,0,0.15)',
            position: 'relative',
          }}
        >
          <img
            src={bgImage!}
            alt={offer.title}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 12,
              filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
            }}
          />
        </div>
      </div>
    );
  }

  // ========================
  // MODE: FULL-IMAGE — image fills entire banner, minimal text at bottom
  // ========================
  if (mode === 'full-image') {
    return (
      <div
        className={`festival-banner-card festival-banner-card--${variant}`}
        style={{
          position: 'relative',
          borderRadius: 20,
          overflow: 'hidden',
          minHeight: variant === 'compact' ? 170 : 230,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.22)',
          border: '1px solid rgba(122, 193, 66, 0.28)',
          color: '#ffffff',
        }}
      >
        {/* Full background image */}
        {bgImage && (
          <img
            src={bgImage}
            alt={offer.title}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0,
            }}
          />
        )}

        {/* Bottom gradient for text readability */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.05) 70%, transparent 100%)',
            zIndex: 1,
          }}
        />

        {/* Minimal text content at bottom */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: variant === 'compact' ? '1rem 1.4rem' : '1.25rem 2rem',
          }}
        >
          {badges}
          <h2
            style={{
              margin: '0 0 0.5rem',
              fontSize: variant === 'compact' ? 'clamp(1.1rem, 2vw, 1.4rem)' : 'clamp(1.2rem, 2.5vw, 1.7rem)',
              fontWeight: 800,
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {offer.title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            {ctaButton}
            {couponBtn}
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // MODE: BACKGROUND (default) — image behind text with overlay
  // ========================
  return (
    <div
      className={`festival-banner-card festival-banner-card--${variant}`}
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        minHeight: variant === 'compact' ? 170 : 210,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: variant === 'compact' ? '1.4rem 1.6rem' : '2rem 2.25rem',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.22)',
        background: bgImage
          ? `linear-gradient(90deg, rgba(6, 17, 39, 0.72) 0%, rgba(6, 17, 39, 0.55) 50%, rgba(6, 17, 39, 0.35) 100%), url("${bgImage}") center/cover no-repeat`
          : 'radial-gradient(ellipse at 85% 20%, rgba(122, 193, 66, 0.16) 0%, transparent 45%), linear-gradient(135deg, #071933 0%, #0c2b53 50%, #0a2f2b 100%)',
        color: '#ffffff',
        border: '1px solid rgba(122, 193, 66, 0.28)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
        {textContent}
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
        margin: variant === 'compact' ? '0.75rem 0 1.25rem' : '1.25rem 0 2rem',
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
