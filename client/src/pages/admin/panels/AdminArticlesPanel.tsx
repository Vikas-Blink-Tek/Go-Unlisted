import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminDeleteArticle, adminGetArticles, adminSaveArticle, adminGetArticle } from '../../../api/content';
import { useToast } from '../../../context/ToastContext';
import AdminSectionHeader from '../components/AdminSectionHeader';
import type { Article } from '../../../types';

const emptyArticle = { id: 0, title: '', slug: '', content: '', image_url: '', status: 'draft' as 'draft' | 'published' };

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminArticlesPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<typeof emptyArticle | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: articles = [], isLoading } = useQuery({ queryKey: ['admin-articles'], queryFn: adminGetArticles });

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
    setEditing({ ...emptyArticle });
    setShowModal(true);
  };

  const openEdit = async (a: Article) => {
    try {
      const full = await adminGetArticle(a.id);
      setEditing({
        id: full.id,
        title: full.title,
        slug: full.slug,
        content: full.content || '',
        image_url: full.image_url || '',
        status: (full.status as 'draft' | 'published') || 'draft',
      });
      setShowModal(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load', 'error');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    saveMut.mutate({
      id: editing.id || undefined,
      title: editing.title,
      slug: editing.slug || slugify(editing.title),
      content: editing.content,
      image_url: editing.image_url,
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

      {isLoading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}

      <div className="price-table-wrap">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{a.slug}</td>
                <td><span className={`status-badge ${a.status === 'published' ? 'status-confirmed' : 'status-pending'}`}>{a.status}</span></td>
                <td style={{ fontSize: '0.78rem' }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => confirm('Delete article?') && deleteMut.mutate(a.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && editing && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit Article' : 'New Article'}</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">URL Slug *</label>
                <input className="form-input" required value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'draft' | 'published' })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cover Image URL</label>
                <input className="form-input" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Content (HTML) *</label>
                <textarea className="form-input" rows={10} required value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={saveMut.isPending}>Save Article</button>
              <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setShowModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
