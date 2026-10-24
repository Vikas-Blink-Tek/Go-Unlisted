import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getArticles } from '../api/content';
import { formatDate } from '../utils/format';
import ArticleMedia from '../components/articles/ArticleMedia';
import type { Article } from '../types';

const ALL = 'All';

function ArticleMeta({ a }: { a: Article }) {
  return (
    <p className="insights-meta">
      {formatDate(a.created_at)}
      {a.read_minutes ? <> · {a.read_minutes} min read</> : null}
    </p>
  );
}

export default function ArticlesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: getArticles,
    refetchInterval: 60_000,
  });

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => (a.category || '').trim()).filter(Boolean));
    return [ALL, ...Array.from(set)];
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (category !== ALL && (a.category || '').trim() !== category) return false;
      if (!q) return true;
      const hay = [a.title, a.category, a.tags, a.excerpt].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [articles, search, category]);

  // Newest article leads when nothing is being filtered
  const browsing = !search.trim() && category === ALL;
  const featured = browsing ? filtered[0] : undefined;
  const rest = featured ? filtered.slice(1) : filtered;

  return (
    <div className="insights-page">
      <header className="insights-hero">
        <p className="insights-eyebrow">Market Insights</p>
        <h1>News &amp; analysis on unlisted and pre-IPO shares</h1>
        <p className="insights-sub">
          IPO updates, valuations and beginner guides from the GO UNLISTED research team.
        </p>
        <div className="insights-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search articles"
          />
        </div>
        {categories.length > 2 && (
          <div className="insights-chips" role="tablist" aria-label="Filter by category">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`insights-chip${category === c ? ' is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="insights-body">
        {isLoading && (
          <div className="insights-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="insights-card skeleton-card" style={{ height: 340 }} />
            ))}
          </div>
        )}

        {featured && (
          <Link to={`/articles/${featured.slug}`} className="insights-featured">
            <ArticleMedia path={featured.image_url} alt={featured.title} className="insights-media" eager />
            <div className="insights-featured-body">
              <div className="insights-tags">
                <span className="insights-tag insights-tag--latest">Latest</span>
                {featured.category && <span className="insights-tag">{featured.category}</span>}
              </div>
              <h2>{featured.title}</h2>
              {featured.excerpt && <p className="insights-excerpt">{featured.excerpt}</p>}
              <ArticleMeta a={featured} />
              <span className="insights-read">Read article →</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="insights-grid">
            {rest.map((a) => (
              <Link key={a.id} to={`/articles/${a.slug}`} className="insights-card">
                <ArticleMedia path={a.image_url} alt={a.title} className="insights-media" />
                <div className="insights-card-body">
                  {a.category && <span className="insights-tag">{a.category}</span>}
                  <h3>{a.title}</h3>
                  {a.excerpt && <p className="insights-excerpt">{a.excerpt}</p>}
                  <ArticleMeta a={a} />
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="insights-empty">
            <h3>{articles.length ? 'No matching articles' : 'No articles yet'}</h3>
            <p>
              {articles.length
                ? 'Try a different search or category.'
                : 'Check back soon for market insights and investment guides.'}
            </p>
            {articles.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearch('');
                  setCategory(ALL);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
