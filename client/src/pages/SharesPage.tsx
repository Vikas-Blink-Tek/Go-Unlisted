import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShares, useWatchlist } from '../hooks/useShares';
import ShareCard from '../components/shares/ShareCard';
import CompanyLogo from '../components/shares/CompanyLogo';
import { formatCurrency } from '../utils/format';
import { sectorMatches } from '../utils/sectorFilter';
import { useCanViewShareRates } from '../utils/shareRates';
import type { Share } from '../types';

function shareMatchesQuery(s: Share, q: string) {
  if (!q) return true;
  return (
    s.name.toLowerCase().includes(q)
    || s.ticker.toLowerCase().includes(q)
    || (s.sector || '').toLowerCase().includes(q)
    || s.id.toLowerCase().includes(q)
  );
}

export default function SharesPage() {
  const { shares } = useShares();
  const watchlist = useWatchlist();
  const navigate = useNavigate();
  const canViewRates = useCanViewShareRates();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All');
  const [maxPrice, setMaxPrice] = useState(4000);
  const [watchOnly, setWatchOnly] = useState(false);
  const [watched, setWatched] = useState<string[]>(watchlist.get());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sectorMenuOpen, setSectorMenuOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sectorMenuRef = useRef<HTMLDivElement>(null);

  const sectorOptions = useMemo(() => {
    const fromShares = [...new Set(shares.map((s) => (s.sector || '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return ['All', ...fromShares];
  }, [shares]);

  const q = search.trim().toLowerCase();
  // Guests get price masked to 0 — max-price slider must not hide the whole catalog.
  const priceFilterActive = canViewRates && maxPrice < 4000;

  const searchHits = useMemo(() => {
    if (!q) return [] as Share[];
    return shares
      .filter((s) => shareMatchesQuery(s, q))
      .filter((s) => sectorMatches(s.sector, sector))
      .filter((s) => (priceFilterActive ? s.price <= maxPrice : true))
      .filter((s) => (watchOnly ? watched.includes(s.id) : true))
      .slice(0, 8);
  }, [shares, q, sector, maxPrice, watchOnly, watched, priceFilterActive]);

  const top10Shares = useMemo(() => {
    return shares
      .filter((s) => {
        if (!s.isTop10) return false;
        if (!sectorMatches(s.sector, sector)) return false;
        if (priceFilterActive && s.price > maxPrice) return false;
        if (watchOnly && !watched.includes(s.id)) return false;
        return shareMatchesQuery(s, q);
      })
      .slice(0, 10);
  }, [shares, q, sector, maxPrice, watchOnly, watched, priceFilterActive]);

  const filtered = useMemo(() => {
    const includeSpotlight = q !== '' || sector !== 'All' || watchOnly || priceFilterActive;
    const top10Ids = new Set(top10Shares.map((s) => s.id));

    return shares.filter((s) => {
      if (!includeSpotlight) {
        if (s.isFeatured) return false;
        if (s.isTop10) return false;
      } else if (top10Ids.has(s.id)) {
        return false;
      }
      if (!sectorMatches(s.sector, sector)) return false;
      if (priceFilterActive && s.price > maxPrice) return false;
      if (watchOnly && !watched.includes(s.id)) return false;
      return shareMatchesQuery(s, q);
    });
  }, [shares, sector, maxPrice, watchOnly, watched, q, top10Shares, priceFilterActive]);

  const totalMatchCount = filtered.length + top10Shares.length;

  useEffect(() => {
    setActiveIdx(0);
  }, [q, searchHits.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!searchWrapRef.current?.contains(target)) {
        setDropdownOpen(false);
      }
      if (!sectorMenuRef.current?.contains(target)) {
        setSectorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (!typing && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setDropdownOpen(false);
        setSectorMenuOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setSectorMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openShare = (share: Share) => {
    setDropdownOpen(false);
    setSearch(share.name);
    navigate(`/shares/${share.id}`);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (dropdownOpen) {
        setDropdownOpen(false);
        e.preventDefault();
      } else if (search) {
        setSearch('');
        e.preventDefault();
      }
      return;
    }
    if (!searchHits.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownOpen(true);
      setActiveIdx((i) => (i + 1) % searchHits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownOpen(true);
      setActiveIdx((i) => (i - 1 + searchHits.length) % searchHits.length);
    } else if (e.key === 'Enter' && dropdownOpen) {
      e.preventDefault();
      openShare(searchHits[activeIdx] || searchHits[0]);
    }
  };

  return (
    <div className="view active">
      <div className="page-header">
        <div className="page-header-inner">
          <h1 className="page-title">Pre-IPO Listings</h1>
          <p className="page-subtitle">Invest in India&apos;s most promising unlisted companies before they go public.</p>
        </div>
      </div>

      <div className="section" style={{ paddingTop: '2rem' }}>
        <div className="container">
          <div className="filter-bar">
            <div className="shares-search-row" ref={searchWrapRef}>
              <div className={`search-wrap shares-search-wrap${dropdownOpen && q ? ' has-dropdown' : ''}`}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input"
                  placeholder="Search company name or sector..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  aria-autocomplete="list"
                  aria-expanded={dropdownOpen && q.length > 0}
                  aria-controls="shares-search-results"
                />
                {search && (
                  <button
                    type="button"
                    className="shares-search-esc"
                    onClick={() => {
                      setSearch('');
                      setDropdownOpen(false);
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    ESC
                  </button>
                )}

                {dropdownOpen && q && (
                  <div className="shares-search-dropdown" id="shares-search-results" role="listbox">
                    {searchHits.length === 0 ? (
                      <div className="shares-search-empty">No shares match “{search.trim()}”</div>
                    ) : (
                      searchHits.map((share, idx) => (
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
                    <div className="shares-search-footer">
                      <span>
                        {searchHits.length} result{searchHits.length === 1 ? '' : 's'}
                        {totalMatchCount > searchHits.length ? ` · ${totalMatchCount} on page` : ''}
                      </span>
                      <span className="shares-search-keys">
                        <kbd>↑</kbd>
                        <kbd>↓</kbd> navigate · <kbd>↵</kbd> open
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="shares-sector-menu-wrap" ref={sectorMenuRef}>
                <button
                  type="button"
                  className={`shares-sector-shortcut${sector !== 'All' ? ' is-active' : ''}${sectorMenuOpen ? ' is-open' : ''}`}
                  onClick={() => {
                    setDropdownOpen(false);
                    setSectorMenuOpen((open) => !open);
                  }}
                  aria-label="Sector filter (shortcut S)"
                  aria-expanded={sectorMenuOpen}
                  aria-haspopup="listbox"
                  title="Sector filter (press S)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                  </svg>
                  <span className="shares-sector-shortcut-label">
                    {sector === 'All' ? 'Sector' : sector}
                  </span>
                  <kbd className="shares-sector-kbd">S</kbd>
                </button>

                {sectorMenuOpen && (
                  <div className="shares-sector-dropdown" role="listbox" aria-label="Filter by sector">
                    <div className="shares-sector-dropdown-head">
                      <span>Filter by sector</span>
                      {sector !== 'All' && (
                        <button
                          type="button"
                          className="shares-sector-clear"
                          onClick={() => {
                            setSector('All');
                            setSectorMenuOpen(false);
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="shares-sector-dropdown-list">
                      {sectorOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="option"
                          aria-selected={sector === s}
                          className={`shares-sector-option${sector === s ? ' is-active' : ''}`}
                          onClick={() => {
                            setSector(s);
                            setSectorMenuOpen(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Watchlist:</span>
              <button
                type="button"
                className={`filter-btn filter-btn-watchlist ${watchOnly ? 'active' : ''}`}
                onClick={() => setWatchOnly(!watchOnly)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2l3.09 6.26 6.91 1.01-5 4.87 1.18 6.88-6.18-3.25-6.18 3.25 1.18-6.88-5-4.87 6.91-1.01z" />
                </svg>
                Watchlisted
              </button>
            </div>

            <div className="filter-group">
              <span className="filter-label">Max Price:</span>
              <div className="price-range-wrap">
                <input
                  type="range"
                  className="price-slider"
                  min={0}
                  max={4000}
                  step={50}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(+e.target.value)}
                />
                <span className="price-display">{maxPrice >= 4000 ? 'All' : `₹${maxPrice.toLocaleString('en-IN')}`}</span>
              </div>
            </div>
          </div>

          {top10Shares.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <h2
                className="section-title"
                style={{ fontSize: '1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span style={{ fontSize: '2rem' }}>🏆</span> Top 10 Shares
              </h2>
              <div className="shares-grid">
                {top10Shares.map((share) => (
                  <ShareCard
                    key={share.id}
                    share={share}
                    isWatched={watched.includes(share.id)}
                    onWatchlist={() => setWatched(watchlist.toggle(share.id))}
                  />
                ))}
              </div>
            </div>
          )}

          {(q || sector !== 'All' || watchOnly || priceFilterActive) && (
            <h2 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              {q ? `Results for “${search.trim()}”` : 'Matching listings'}
              <span style={{ fontWeight: 500, color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.95rem' }}>
                ({totalMatchCount})
              </span>
            </h2>
          )}

          <div className="shares-grid">
            {filtered.map((share) => (
              <ShareCard
                key={share.id}
                share={share}
                isWatched={watched.includes(share.id)}
                onWatchlist={() => setWatched(watchlist.toggle(share.id))}
              />
            ))}
          </div>

          {totalMatchCount === 0 && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              No shares match your filters.
              {q ? ' Try another name, ticker, or clear search.' : ''}
              {sector !== 'All' && (
                <>
                  {' '}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSector('All')}>
                    Clear sector
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
