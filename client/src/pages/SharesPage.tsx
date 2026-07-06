import { useMemo, useState } from 'react';
import { useShares, useWatchlist } from '../hooks/useShares';
import ShareCard from '../components/shares/ShareCard';

export default function SharesPage() {
  const { shares } = useShares();
  const watchlist = useWatchlist();
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All');
  const [maxPrice, setMaxPrice] = useState(4000);
  const [watchOnly, setWatchOnly] = useState(false);
  const [watched, setWatched] = useState<string[]>(watchlist.get());

  const sectorOptions = useMemo(() => {
    const fromShares = [...new Set(shares.map((s) => s.sector).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return ['All', ...fromShares];
  }, [shares]);

  const filtered = useMemo(() => {
    return shares.filter((s) => {
      if (s.isFeatured) return false;
      if (sector !== 'All' && s.sector !== sector) return false;
      if (s.price > maxPrice) return false;
      if (watchOnly && !watched.includes(s.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
      }
      return true;
    });
  }, [shares, sector, maxPrice, watchOnly, watched, search]);

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
            <div className="search-wrap">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search company name or sector..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">Sector:</span>
              <div className="sector-filters">
                {sectorOptions.map((s) => (
                  <button key={s} type="button" className={`filter-btn ${sector === s ? 'active' : ''}`} onClick={() => setSector(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Watchlist:</span>
              <button type="button" className={`filter-btn filter-btn-watchlist ${watchOnly ? 'active' : ''}`} onClick={() => setWatchOnly(!watchOnly)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26 6.91 1.01-5 4.87 1.18 6.88-6.18-3.25-6.18 3.25 1.18-6.88-5-4.87 6.91-1.01z" /></svg>
                Watchlisted
              </button>
            </div>

            <div className="filter-group">
              <span className="filter-label">Max Price:</span>
              <div className="price-range-wrap">
                <input type="range" className="price-slider" min={0} max={4000} step={50} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} />
                <span className="price-display">{maxPrice >= 4000 ? 'All' : `₹${maxPrice.toLocaleString('en-IN')}`}</span>
              </div>
            </div>
          </div>

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

          {filtered.length === 0 && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              No shares match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
