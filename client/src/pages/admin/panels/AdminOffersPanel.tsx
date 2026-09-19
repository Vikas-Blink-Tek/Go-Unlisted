import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  fetchAdminOffers,
  saveOffer,
  deleteOffer,
  toggleOfferStatus,
  uploadOfferBanner,
} from '../../../api/offers';
import { useToast } from '../../../context/ToastContext';
import AdminSectionHeader from '../components/AdminSectionHeader';
import { mediaUrl } from '../../../utils/mediaUrl';
import type { FestivalOffer } from '../../../types';

type OfferFormState = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  imageUrl: string;
  discountText: string;
  couponCode: string;
  linkUrl: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: OfferFormState = {
  id: '',
  title: '',
  tagline: '',
  description: '',
  imageUrl: '',
  discountText: '',
  couponCode: '',
  linkUrl: '/shares',
  endsAt: '',
  isActive: true,
  sortOrder: 0,
};

function formatDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function AdminOffersPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<OfferFormState>(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [search, setSearch] = useState('');

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['admin-offers'],
    queryFn: fetchAdminOffers,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) => {
      const hay = [o.title, o.tagline, o.discountText, o.couponCode, o.linkUrl].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [offers, search]);

  const saveMut = useMutation({
    mutationFn: saveOffer,
    onSuccess: () => {
      showToast(form.id ? 'Offer updated successfully' : 'New festival offer published', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
      queryClient.invalidateQueries({ queryKey: ['active-offers'] });
      setShowModal(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => showToast(e.message || 'Failed to save offer', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      showToast('Offer deleted', 'info');
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
      queryClient.invalidateQueries({ queryKey: ['active-offers'] });
    },
    onError: (e: Error) => showToast(e.message || 'Failed to delete offer', 'error'),
  });

  const toggleMut = useMutation({
    mutationFn: toggleOfferStatus,
    onSuccess: () => {
      showToast('Offer status updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-offers'] });
      queryClient.invalidateQueries({ queryKey: ['active-offers'] });
    },
    onError: (e: Error) => showToast(e.message || 'Failed to update status', 'error'),
  });

  const openNew = () => {
    // Default 24 hours deal
    const in24Hours = new Date(Date.now() + 24 * 3600 * 1000);
    setForm({
      ...emptyForm,
      endsAt: formatDatetimeLocal(in24Hours),
    });
    setShowModal(true);
  };

  const openEdit = (o: FestivalOffer) => {
    let formattedEndsAt = '';
    if (o.endsAt) {
      const d = new Date(o.endsAt.replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        formattedEndsAt = formatDatetimeLocal(d);
      }
    }
    setForm({
      id: o.id,
      title: o.title,
      tagline: o.tagline || '',
      description: o.description || '',
      imageUrl: o.imageUrl || '',
      discountText: o.discountText || '',
      couponCode: o.couponCode || '',
      linkUrl: o.linkUrl || '/shares',
      endsAt: formattedEndsAt,
      isActive: o.isActive,
      sortOrder: o.sortOrder || 0,
    });
    setShowModal(true);
  };

  const setPresetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 3600 * 1000);
    setForm((f) => ({ ...f, endsAt: formatDatetimeLocal(target) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const url = await uploadOfferBanner(file);
      setForm((f) => ({ ...f, imageUrl: url }));
      showToast('Banner uploaded successfully', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Banner upload failed', 'error');
    } finally {
      setUploadingBanner(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Please enter an offer title', 'error');
      return;
    }
    saveMut.mutate({
      id: form.id || undefined,
      title: form.title.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      discountText: form.discountText.trim(),
      couponCode: form.couponCode.trim(),
      linkUrl: form.linkUrl.trim() || '/shares',
      endsAt: form.endsAt ? form.endsAt.replace('T', ' ') + ':00' : null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    });
  };

  return (
    <div className="admin-offers-panel">
      <AdminSectionHeader
        title="Festival Offers & Countdown Banners"
        subtitle="Create flash deals, festival banners (Ganesh Chaturthi, Diwali, etc.), and running countdown discounts visible across Web & Mobile app."
        action={
          <button type="button" className="btn btn-primary" onClick={openNew}>
            + Add Festival Offer
          </button>
        }
      />

      <div className="admin-toolbar" style={{ display: 'flex', gap: '1rem', margin: '1.25rem 0', alignItems: 'center' }}>
        <input
          type="search"
          className="form-input"
          placeholder="Search offers by title, promo code, discount..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Showing <strong>{filtered.length}</strong> of {offers.length} offers
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>Loading festival offers...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1px dashed var(--border)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--ink)' }}>No Festival Offers Yet</h3>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Add a 24-hour Ganesh Chaturthi deal, festive banner, or promotional discount to attract investors.
          </p>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            Create First Offer
          </button>
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>BANNER</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>OFFER DETAILS</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>DISCOUNT / CODE</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>COUNTDOWN / EXPIRY</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)' }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const isExpired = o.endsAt && new Date(o.endsAt.replace(' ', 'T')).getTime() < Date.now();
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      {o.imageUrl ? (
                        <img
                          src={mediaUrl(o.imageUrl)}
                          alt={o.title}
                          style={{
                            width: 80,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 80,
                            height: 48,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #003478, #7ac142)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          FESTIVAL
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '0.95rem' }}>{o.title}</div>
                      {o.tagline && (
                        <span
                          style={{
                            display: 'inline-block',
                            background: 'var(--lime-soft)',
                            color: 'var(--lime-dark)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                            marginTop: 4,
                          }}
                        >
                          {o.tagline}
                        </span>
                      )}
                      {o.description && (
                        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.8rem', maxWidth: 280 }}>
                          {o.description}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.discountText && (
                        <div style={{ fontWeight: 600, color: 'var(--lime-dark)', fontSize: '0.9rem' }}>
                          {o.discountText}
                        </div>
                      )}
                      {o.couponCode && (
                        <code
                          style={{
                            display: 'inline-block',
                            marginTop: 4,
                            background: 'var(--surface)',
                            border: '1px dashed var(--border)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {o.couponCode}
                        </code>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.endsAt ? (
                        <div>
                          <div style={{ fontSize: '0.85rem', color: isExpired ? 'var(--red, #ef4444)' : 'var(--ink)' }}>
                            {new Date(o.endsAt.replace(' ', 'T')).toLocaleString()}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: isExpired ? '#ef4444' : '#10b981',
                              marginTop: 2,
                            }}
                          >
                            {isExpired ? '● Expired' : '● Live Countdown Active'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No expiry (Always On)</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        type="button"
                        onClick={() => toggleMut.mutate(o.id)}
                        disabled={toggleMut.isPending}
                        style={{
                          background: o.isActive ? 'var(--lime-soft)' : 'var(--surface)',
                          color: o.isActive ? 'var(--lime-dark)' : 'var(--muted)',
                          border: `1px solid ${o.isActive ? 'var(--lime)' : 'var(--border)'}`,
                          borderRadius: 20,
                          padding: '4px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {o.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(o)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => {
                            if (window.confirm(`Delete offer "${o.title}"?`)) {
                              deleteMut.mutate(o.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div
            className="modal-card"
            style={{
              maxWidth: 620,
              width: '94%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>
                {form.id ? 'Edit Festival Offer' : 'Add New Festival Offer'}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowModal(false)}
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Offer / Festival Title *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ganesh Chaturthi Flash Deal, Diwali Dhamaka Offer"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Tagline / Deal Badge
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Trending, Limited Deal, 24-Hour Special"
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {['🔥 Trending', '⏳ Limited Deal', '⚡ Flash Deal', '✨ Festival Special', '💥 Best Seller', '💎 Exclusive'].map((badge) => (
                      <button
                        key={badge}
                        type="button"
                        onClick={() => setForm({ ...form, tagline: badge })}
                        style={{
                          background: form.tagline === badge ? 'var(--blue-light)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${form.tagline === badge ? 'var(--primary)' : 'var(--border)'}`,
                          color: form.tagline === badge ? '#ffffff' : 'var(--text)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: form.tagline === badge ? 700 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {badge}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Discount Highlight
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Flat ₹50 OFF / Extra 5%"
                    value={form.discountText}
                    onChange={(e) => setForm({ ...form, discountText: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {['FLAT 10% OFF', 'FLAT 20% OFF', 'FLAT ₹500 OFF', 'EXTRA 5% OFF', 'BEST FESTIVE PRICE'].map((disc) => (
                      <button
                        key={disc}
                        type="button"
                        onClick={() => setForm({ ...form, discountText: disc })}
                        style={{
                          background: form.discountText === disc ? '#7ac142' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${form.discountText === disc ? '#7ac142' : 'var(--border)'}`,
                          color: form.discountText === disc ? '#062306' : 'var(--text)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: form.discountText === disc ? 700 : 500,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {disc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Coupon / Promo Code (optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. GANESH24, DIWALI50"
                    value={form.couponCode}
                    onChange={(e) => setForm({ ...form, couponCode: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Redirect Link
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. /shares or /shares/custom-xxx"
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Description / Offer Terms
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Valid for all Pre-IPO orders placed during Ganesh Chaturthi. Automatic discount applied."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Countdown Section */}
              <div
                style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  marginBottom: '1rem',
                }}
              >
                <label className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  ⏱ Live Countdown Expiry
                </label>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Deal displays a running timer ticking down in hours, minutes, and seconds on Web and Mobile.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPresetHours(24)}>
                    +24 Hours (Flash Deal)
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPresetHours(48)}>
                    +48 Hours
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPresetHours(72)}>
                    +3 Days
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPresetHours(168)}>
                    +7 Days (Week)
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, endsAt: '' })}>
                    Clear (No Expiry)
                  </button>
                </div>

                <input
                  type="datetime-local"
                  className="form-input"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>

              {/* Banner Image Upload */}
              <div
                style={{
                  background: 'var(--surface)',
                  padding: '1rem',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  marginBottom: '1.25rem',
                }}
              >
                <label className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  🖼 Festival Banner Image
                </label>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Upload high-res festival banner (PNG, JPG, WEBP, max 5MB). Displays in carousel on Web and Mobile.
                </p>

                {form.imageUrl && (
                  <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
                    <img
                      src={mediaUrl(form.imageUrl)}
                      alt="Banner Preview"
                      style={{
                        width: '100%',
                        maxHeight: 160,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: '' })}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 26,
                        height: 26,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={uploadingBanner}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingBanner ? 'Uploading Banner...' : '📁 Upload Banner Image'}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>or paste path:</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. uploads/offers/banner.png"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Status & Sort */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Active & Visible on App/Web</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Sort Order:</span>
                  <input
                    type="number"
                    className="form-input"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                    style={{ width: 70, padding: '4px 8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>
                  {saveMut.isPending ? 'Saving...' : form.id ? 'Update Offer' : 'Publish Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
