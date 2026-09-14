import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  src: string;
  title?: string;
  isPdf?: boolean;
  onClose: () => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export default function KycProofLightbox({ src, title = 'KYC proof', isPdf = false, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const setZoomCentered = useCallback((next: number) => {
    const z = clampZoom(next);
    zoomRef.current = z;
    setZoom(z);
    if (z <= 1) setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (isPdf) return;
      if (e.key === '+' || e.key === '=') setZoomCentered(zoomRef.current + ZOOM_STEP);
      if (e.key === '-' || e.key === '_') setZoomCentered(zoomRef.current - ZOOM_STEP);
      if (e.key === '0') setZoomCentered(1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, isPdf, setZoomCentered]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || isPdf) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomCentered(zoomRef.current + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isPdf, setZoomCentered]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isPdf || zoom <= 1) return;
    dragging.current = true;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const content = (
    <div
      className="kyc-proof-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="kyc-proof-lightbox__bar" onClick={(e) => e.stopPropagation()}>
        <span className="kyc-proof-lightbox__title">{title}</span>
        <div className="kyc-proof-lightbox__actions">
          {!isPdf && (
            <>
              <button type="button" className="kyc-proof-lightbox__btn" onClick={() => setZoomCentered(zoom - ZOOM_STEP)} aria-label="Zoom out">
                −
              </button>
              <button type="button" className="kyc-proof-lightbox__btn kyc-proof-lightbox__zoom-label" onClick={() => setZoomCentered(1)} title="Reset zoom">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="kyc-proof-lightbox__btn" onClick={() => setZoomCentered(zoom + ZOOM_STEP)} aria-label="Zoom in">
                +
              </button>
              <button type="button" className="kyc-proof-lightbox__btn" onClick={() => setZoomCentered(1)}>
                Fit
              </button>
            </>
          )}
          <a className="kyc-proof-lightbox__btn kyc-proof-lightbox__btn--link" href={src} target="_blank" rel="noopener noreferrer">
            Open tab
          </a>
          <button type="button" className="kyc-proof-lightbox__btn kyc-proof-lightbox__btn--close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`kyc-proof-lightbox__stage${isPdf ? ' kyc-proof-lightbox__stage--pdf' : ''}${!isPdf && zoom > 1 ? ' kyc-proof-lightbox__stage--pan' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {isPdf ? (
          <iframe title={title} src={src} className="kyc-proof-lightbox__pdf" />
        ) : (
          <img
            src={src}
            alt={title}
            className="kyc-proof-lightbox__img"
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            }}
          />
        )}
      </div>

      {!isPdf && (
        <p className="kyc-proof-lightbox__hint">Scroll to zoom · drag to pan · Esc to close</p>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

/** Clickable proof open helper — images open lightbox; PDFs open lightbox iframe. */
export function useKycProofViewer() {
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean; title?: string } | null>(null);

  const openProof = useCallback((src: string, opts?: { isPdf?: boolean; title?: string }) => {
    if (!src) return;
    setViewer({ src, isPdf: !!opts?.isPdf, title: opts?.title });
  }, []);

  const closeProof = useCallback(() => setViewer(null), []);

  const lightbox = viewer ? (
    <KycProofLightbox
      src={viewer.src}
      isPdf={viewer.isPdf}
      title={viewer.title}
      onClose={closeProof}
    />
  ) : null;

  return { openProof, closeProof, lightbox };
}
