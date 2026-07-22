import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getArticles } from '../api/content';
import { formatDate } from '../utils/format';
import { mediaUrl } from '../utils/mediaUrl';

export default function ArticlesPage() {
  const [search, setSearch] = useState('');
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: getArticles,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const hay = [a.title, a.category, a.tags, a.author].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [articles, search]);

  return (
    <div className="page-pad">
      <motion.div
        className="page-header text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: '0 auto 1.5rem' }}
      >
        <h1>Market <span className="text-gradient">Insights</span></h1>
        <p>Expert analysis on pre-IPO deals, unlisted valuations, and private market trends</p>
      </motion.div>

      <div className="articles-toolbar">
        <input
          className="form-input"
          type="search"
          placeholder="Search articles, categories, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search articles"
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => undefined}>
          Search
        </button>
      </div>

      {isLoading && (
        <div className="articles-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="article-card skeleton-card" style={{ height: 280 }} />
          ))}
        </div>
      )}

      <div className="articles-grid">
        {filtered.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link to={`/articles/${a.slug}`} className="article-card">
              {a.image_url ? (
                <img src={mediaUrl(a.image_url)} alt={a.title} className="article-img" />
              ) : (
                <div className="article-img article-img-placeholder">
                  <span>📰</span>
                </div>
              )}
              <div className="article-body">
                {a.category && <p className="article-card-category">{a.category}</p>}
                <h3>{a.title}</h3>
                <p className="article-meta">{a.author} · {formatDate(a.created_at)}</p>
                <span className="article-read-more">Read article →</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <motion.div
          className="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📰</span>
          <h3 style={{ color: 'var(--white)', marginBottom: '0.5rem' }}>
            {search.trim() ? 'No matching articles' : 'No articles yet'}
          </h3>
          <p>
            {search.trim()
              ? 'Try a different search term.'
              : 'Check back soon for market insights and investment guides.'}
          </p>
        </motion.div>
      )}
    </div>
  );
}
