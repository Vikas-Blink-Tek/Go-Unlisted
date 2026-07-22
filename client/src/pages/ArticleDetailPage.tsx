import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getArticle } from '../api/content';
import { formatDate } from '../utils/format';
import { sanitizeHtml } from '../utils/sanitize';
import { mediaUrl } from '../utils/mediaUrl';

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => getArticle(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="page-pad">
        <div className="skeleton-card" style={{ height: 400, borderRadius: 'var(--r-lg)' }} />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="page-pad text-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2>Article not found</h2>
          <Link to="/articles" className="btn btn-primary">Back to Articles</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page-pad" style={{ maxWidth: 800, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/articles" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
          ← Back to Insights
        </Link>
      </motion.div>

      <motion.article
        className="article-detail glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {article.image_url && (
          <motion.img
            src={mediaUrl(article.image_url)}
            alt={article.title}
            className="article-hero-img"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
          />
        )}
        <div style={{ padding: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2rem)', color: 'var(--white)', marginBottom: '0.75rem', lineHeight: 1.3 }}>
            {article.title}
          </h1>
          <p className="article-meta" style={{ marginBottom: '0.75rem' }}>
            By {article.author} · {formatDate(article.created_at)}
          </p>
          {(article.category || article.tags) && (
            <div className="article-meta-chips">
              {article.category && <span className="article-chip">{article.category}</span>}
              {(article.tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span key={tag} className="article-chip article-chip-tag">{tag}</span>
                ))}
            </div>
          )}
          <div className="article-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content || '') }} />
        </div>
      </motion.article>
    </div>
  );
}
