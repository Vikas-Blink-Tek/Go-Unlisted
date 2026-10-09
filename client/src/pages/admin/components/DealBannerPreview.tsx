import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OfferCard } from '../../../components/home/FestivalBannerSlider';
import type { FestivalOffer } from '../../../types';

type Device = 'desktop' | 'mobile';

const FRAME_WIDTH: Record<Device, number> = { desktop: 1140, mobile: 375 };

function ScaledFrame({ offer, device, maxWidth }: { offer: FestivalOffer; device: Device; maxWidth: number }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);
  const frameWidth = FRAME_WIDTH[device];
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / frameWidth) : 1;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setInnerHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      style={{
        width: frameWidth * scale,
        height: innerHeight * scale,
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      <div
        ref={innerRef}
        className="deal-preview-frame"
        style={{ width: frameWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        // Preview only — never navigate away from the admin form
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <OfferCard offer={offer} preview />
      </div>
    </div>
  );
}

/** Live preview of the deal exactly as the website renders it (same component + CSS). */
export default function DealBannerPreview({ offer }: { offer: FestivalOffer }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [device, setDevice] = useState<Device>('desktop');
  const [fullscreen, setFullscreen] = useState(false);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => setHostWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const toggleBtn = (d: Device, label: string) => (
    <button
      type="button"
      className={`btn btn-sm ${device === d ? 'btn-primary' : 'btn-outline'}`}
      onClick={() => setDevice(d)}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        background: 'var(--surface)',
        padding: '1rem',
        borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>👁 Live Preview (how it looks on the website)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {toggleBtn('desktop', '🖥 Desktop')}
          {toggleBtn('mobile', '📱 Mobile')}
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setFullscreen(true)}>⤢ Full size</button>
        </div>
      </div>
      <div
        ref={hostRef}
        style={{
          background: '#f8fafc',
          border: '1px dashed var(--border)',
          borderRadius: 10,
          padding: 10,
        }}
      >
        <ScaledFrame offer={offer} device={device} maxWidth={Math.max(0, hostWidth - 20)} />
      </div>
      <p style={{ margin: '0.45rem 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
        Preview updates as you type. Nothing goes live until you click Save / Update Offer.
      </p>

      {fullscreen && createPortal(
        <div
          role="dialog"
          aria-label="Full size deal preview"
          onClick={() => setFullscreen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 12,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
            {toggleBtn('desktop', '🖥 Desktop')}
            {toggleBtn('mobile', '📱 Mobile')}
            <button type="button" className="btn btn-sm btn-outline" style={{ background: '#fff' }} onClick={() => setFullscreen(false)}>
              ✕ Close
            </button>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#f8fafc', borderRadius: 14, padding: 16, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }}
          >
            <ScaledFrame
              offer={offer}
              device={device}
              maxWidth={Math.min(FRAME_WIDTH[device], window.innerWidth - 80)}
            />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
