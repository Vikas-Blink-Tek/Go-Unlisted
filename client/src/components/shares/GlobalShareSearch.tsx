import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useShares } from '../../hooks/useShares';
import { formatCurrency } from '../../utils/format';
import { useCanViewShareRates } from '../../utils/shareRates';
import type { Share } from '../../types';
import CompanyLogo from './CompanyLogo';

type ShareSearchCtx = {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const ShareSearchContext = createContext<ShareSearchCtx | null>(null);

export function useShareSearch() {
  const ctx = useContext(ShareSearchContext);
  if (!ctx) throw new Error('useShareSearch must be used within ShareSearchProvider');
  return ctx;
}

function shareMatchesQuery(s: Share, q: string) {
  if (!q) return true;
  return (
    s.name.toLowerCase().includes(q)
    || s.ticker.toLowerCase().includes(q)
    || (s.sector || '').toLowerCase().includes(q)
    || s.id.toLowerCase().includes(q)
  );
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function ShareSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closeSearch();
        return;
      }
      if (isTypingTarget(e.target)) return;
      const metaK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (metaK || e.key === '/') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openSearch, closeSearch]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const value = useMemo(
    () => ({ open, openSearch, closeSearch }),
    [open, openSearch, closeSearch],
  );

  return (
    <ShareSearchContext.Provider value={value}>
      {children}
      <GlobalShareSearchModal />
    </ShareSearchContext.Provider>
  );
}

function GlobalShareSearchModal() {
  const { open, closeSearch } = useShareSearch();
  const { shares } = useShares();
  const navigate = useNavigate();
  const canViewRates = useCanViewShareRates();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!q) return [] as Share[];
    return shares.filter((s) => shareMatchesQuery(s, q)).slice(0, 8);
  }, [shares, q]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  const openShare = (share: Share) => {
    closeSearch();
    navigate(`/shares/${share.id}`);
  };

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
      return;
    }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openShare(hits[activeIdx] || hits[0]);
    }
  };

  return createPortal(
    <div className="gu-share-search" role="dialog" aria-modal="true" aria-label="Search shares">
      <button type="button" className="gu-share-search-backdrop" aria-label="Close search" onClick={closeSearch} />
      <div className="gu-share-search-panel">
        <div className="gu-share-search-bar">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="gu-share-search-input"
            placeholder="Search company, ticker, or sector…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="gu-share-search-results"
          />
          <button type="button" className="gu-share-search-esc" onClick={closeSearch} aria-label="Close">
            ESC
          </button>
        </div>

        <div className="gu-share-search-body" id="gu-share-search-results" role="listbox">
          {!q ? (
            <div className="gu-share-search-hint">
              Type a company name to jump to another share — no need to go back.
            </div>
          ) : hits.length === 0 ? (
            <div className="gu-share-search-hint">No shares match “{query.trim()}”</div>
          ) : (
            hits.map((share, idx) => (
              <button
                key={share.id}
                type="button"
                role="option"
                aria-selected={idx === activeIdx}
                className={`shares-search-hit${idx === activeIdx ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => openShare(share)}
              >
                <CompanyLogo share={share} className="shares-search-hit-logo" />
                <div className="shares-search-hit-main">
                  <div className="shares-search-hit-name">{share.name}</div>
                  <div className="shares-search-hit-meta">
                    {share.sector || 'Unlisted'}
                    {share.ticker ? ` · ${share.ticker}` : ''}
                  </div>
                </div>
                <div className="shares-search-hit-price">
                  {canViewRates ? (
                    <>
                      <strong>{formatCurrency(share.price)}</strong>
                      <span>Indicative</span>
                    </>
                  ) : (
                    <>
                      <strong className="share-price--gated">••••</strong>
                      <span>Login for rate</span>
                    </>
                  )}
                </div>
                <span className="shares-search-hit-arrow" aria-hidden>
                  →
                </span>
              </button>
            ))
          )}
        </div>

        <div className="shares-search-footer gu-share-search-footer">
          <span>
            {q
              ? `${hits.length} result${hits.length === 1 ? '' : 's'}`
              : 'Search any listing'}
          </span>
          <span className="shares-search-keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate · <kbd>↵</kbd> open
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
