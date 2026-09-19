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

function OfferCard({ offer }: { offer: FestivalOffer }) {
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

  return (
    <div
      className="festival-banner-card"
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        minHeight: 230,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '2rem 2.25rem',
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
        background: bgImage
          ? `linear-gradient(90deg, rgba(7, 16, 38, 0.94) 0%, rgba(7, 16, 38, 0.82) 55%, rgba(7, 16, 38, 0.45) 100%), url("${bgImage}") center/cover no-repeat`
          : 'linear-gradient(135deg, #06234b 0%, #003478 50%, #0f4c3a 100%)',
        color: '#ffffff',
        border: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 680 }}>
        {/* Top Badges: Tagline & Real-time Countdown */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', marginBottom: '0.85rem' }}>
          {offer.tagline && (
            <span
              style={{
                background: 'rgba(122, 193, 66, 0.25)',
                border: '1px solid #7ac142',
                color: '#9ff562',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              ✨ {offer.tagline}
            </span>
          )}

          {countdown && !countdown.expired && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                color: '#fca5a5',
                fontSize: '0.82rem',
                fontWeight: 800,
                padding: '3px 12px',
                borderRadius: 20,
                letterSpacing: '0.02em',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px #ef4444',
                }}
              />
              DEAL ENDS IN: <span style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.92rem' }}>{countdown.text}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 0.5rem',
            fontSize: 'clamp(1.4rem, 3.2vw, 2.1rem)',
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          {offer.title}
        </h2>

        {/* Discount & Description */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {offer.discountText && (
            <span
              style={{
                fontSize: 'clamp(1.1rem, 2.2vw, 1.4rem)',
                fontWeight: 800,
                color: '#7ac142',
                textShadow: '0 2px 10px rgba(122, 193, 66, 0.3)',
              }}
            >
              {offer.discountText}
            </span>
          )}
          {offer.description && (
            <span style={{ fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
              {offer.description}
            </span>
          )}
        </div>

        {/* Coupon code & CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Link
            to={offer.linkUrl || '/shares'}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.4rem',
              fontWeight: 700,
              fontSize: '0.92rem',
              boxShadow: '0 4px 16px rgba(122, 193, 66, 0.35)',
            }}
          >
            Claim Festival Offer →
          </Link>

          {offer.couponCode && (
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
          )}
        </div>
      </div>
    </div>
  );
}

export default function FestivalBannerSlider() {
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
    <div className="festival-slider-container" style={{ margin: '1.25rem 0 2rem' }}>
      <div style={{ position: 'relative' }}>
        <OfferCard key={currentOffer.id} offer={currentOffer} />

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
