import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  adminDeleteArticle,
  adminGetArticles,
  adminSaveArticle,
  adminGetArticle,
  adminUploadArticleImage,
} from '../../../api/content';
import { useToast } from '../../../context/ToastContext';
import AdminSectionHeader from '../components/AdminSectionHeader';
import SimpleRichTextEditor from '../../../components/editor/SimpleRichTextEditor';
import { mediaUrl } from '../../../utils/mediaUrl';
import type { Article } from '../../../types';

const ARTICLE_CATEGORIES = [
  'Market Insights',
  'Pre-IPO',
  'Company Spotlight',
  'How-to Guide',
  'News',
  'Other',
];

type EditingArticle = {
  id: number;
  title: string;
  slug: string;
  content: string;
  image_url: string;
  category: string;
  tags: string;
  status: 'draft' | 'published';
};

const emptyArticle: EditingArticle = {
  id: 0,
  title: '',
  slug: '',
  content: '',
  image_url: '',
  category: '',
  tags: '',
  status: 'draft',
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hasTextContent(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}

export default function AdminArticlesPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<EditingArticle | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [search, setSearch] = useState('');

  const { data: articles = [], isLoading } = useQuery({ queryKey: ['admin-articles'], queryFn: adminGetArticles });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const hay = [a.title, a.slug, a.category, a.tags, a.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [articles, search]);

  const saveMut = useMutation({
    mutationFn: adminSaveArticle,
    onSuccess: () => {
      showToast('Article saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      setShowModal(false);
      setEditing(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteArticle,
    onSuccess: () => {
      showToast('Deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
    },
  });

  const openNew = () => {
    setEditing({ ...emptyArticle, content: '<p></p>' });
    setShowModal(true);
  };

  const openEdit = async (a: Article) => {
    try {
      const full = await adminGetArticle(a.id);
      setEditing({
        id: full.id,
        title: full.title,
        slug: full.slug,
        content: full.content || '<p></p>',
        image_url: full.image_url || '',
        category: full.category || '',
        tags: full.tags || '',
        status: (full.status as 'draft' | 'published') || 'draft',
      });
      setShowModal(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
    }
  };

  const handleCoverUpload = async (file: File | null) => {
    if (!file || !editing) return;
    setUploadingCover(true);
    try {
      const res = await adminUploadArticleImage(file);
      setEditing({ ...editing, image_url: res.url });
      showToast('Thumbnail uploaded', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!hasTextContent(editing.content)) {
      showToast('Write some article content before saving', 'warning');
      return;
    }
    saveMut.mutate({
      id: editing.id || undefined,
      title: editing.title,
      slug: editing.slug || slugify(editing.title),
      content: editing.content,
      image_url: editing.image_url,
      category: editing.category,
      tags: editing.tags,
      status: editing.status,
    });
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Articles / Blog"
        subtitle="Publish market insights and pre-IPO news for investors."
        action={<button type="button" className="btn btn-primary btn-sm" onClick={openNew}>+ New Article</button>}
      />

      <div className="article-admin-search">
        <input
          className="form-input"
          type="search"
          placeholder="Search articles by title, category, or tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search articles"
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>('.article-admin-search input');
            el?.focus();
          }}
        >
          Search
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}

      <div className="price-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="article-admin-title-cell">
                    {a.image_url ? (
                      <img src={mediaUrl(a.image_url)} alt="" className="article-admin-thumb" />
                    ) : (
                      <span className="article-admin-thumb article-admin-thumb-empty" />
                    )}
                    <div>
                      <div>{a.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{a.slug}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: '0.82rem' }}>{a.category || '—'}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--muted)', maxWidth: 160 }}>{a.tags || '—'}</td>
                <td>
                  <span className={`status-badge ${a.status === 'published' ? 'status-confirmed' : 'status-pending'}`}>
                    {a.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.78rem' }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#ef4444' }}
                    onClick={() => confirm('Delete article?') && deleteMut.mutate(a.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem' }}>
                  {search.trim() ? 'No articles match your search.' : 'No articles yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && editing && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card article-editor-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit Article' : 'New Article'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({
                    ...editing,
                    title: e.target.value,
                    slug: editing.id ? editing.slug : slugify(e.target.value),
                  })}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">URL Slug *</label>
                  <input
                    className="form-input"
                    required
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as 'draft' | 'published' })}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    className="form-input"
                    list="article-category-options"
                    placeholder="e.g. Pre-IPO"
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  />
                  <datalist id="article-category-options">
                    {ARTICLE_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <input
                    className="form-input"
                    placeholder="pre-ipo, valuation, guide"
                    value={editing.tags}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  />
                  <p className="article-field-hint">Comma-separated — helps search & filter.</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Thumbnail / Cover</label>
                <p className="article-field-hint">JPG / PNG / WEBP · max 5MB. Shows on article cards and detail page.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  disabled={uploadingCover || saveMut.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    void handleCoverUpload(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className={`article-thumb-box${editing.image_url ? ' has-image' : ''}`}
                  disabled={uploadingCover || saveMut.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {editing.image_url ? (
                    <img src={mediaUrl(editing.image_url)} alt="Thumbnail preview" />
                  ) : (
                    <span className="article-thumb-box-empty">
                      <strong>{uploadingCover ? 'Uploading…' : '+ Add thumbnail'}</strong>
                      <span>Click to upload cover image</span>
                    </span>
                  )}
                </button>
                {editing.image_url && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.4rem' }}
                    onClick={() => setEditing({ ...editing, image_url: '' })}
                  >
                    Remove thumbnail
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Article content *</label>
                <SimpleRichTextEditor
                  value={editing.content}
                  onChange={(html) => setEditing({ ...editing, content: html })}
                  placeholder="Write your article here. Use Heading / Subheading, bullets, and alignment like Word."
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={saveMut.isPending || uploadingCover}>
                {saveMut.isPending ? 'Saving…' : 'Save Article'}
              </button>
              <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
