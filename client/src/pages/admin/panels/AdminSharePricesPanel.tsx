import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { deleteShare, saveShare, saveShareConfig, uploadShareLogo } from '../../../api/shares';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/format';
import type { Share } from '../../../types';
import AdminSectionHeader from '../components/AdminSectionHeader';
import CompanyLogo, { initialsFromName } from '../../../components/shares/CompanyLogo';
import { STOCK_SECTORS } from '../../../data/sharesCatalog';
import { buildPriceHistory, defaultChartLabels, trendFromGrowth } from '../../../utils/priceHistory';

const LISTING_TYPES = ['Pre-IPO', 'Unlisted', 'Delisted', 'ESOP'];
const INVENTORY_STATUSES = ['In Stock', 'Limited', 'On Request', 'Out of Stock'];

const GRADIENTS = [
  'linear-gradient(135deg, #003478, #0050a8)',
  'linear-gradient(135deg, #6a0dad, #9c27b0)',
  'linear-gradient(135deg, #c62828, #ef5350)',
  'linear-gradient(135deg, #1565C0, #42a5f5)',
  'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #004d40, #00897b)',
  'linear-gradient(135deg, #e65100, #ff7043)',
  'linear-gradient(135deg, #880e4f, #e91e63)',
  'linear-gradient(135deg, #33691e, #7cb342)',
  'linear-gradient(135deg, #4a148c, #7b1fa2)',
];

type FormState = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  listingType: string;
  basePrice: string;
  buyPrice: string;
  listingPrice: string;
  minQty: string;
  inventoryStatus: string;
  founded: string;
  revenue: string;
  valuation: string;
  growth: string;
  isin: string;
  week52High: string;
  week52Low: string;
  marketCap: string;
  peRatio: string;
  pbRatio: string;
  debtEquity: string;
  roe: string;
  bookValue: string;
  faceValue: string;
  logoInitials: string;
  logoUrl: string;
  changePositive: boolean;
  isFeatured: boolean;
  logoGradient: string;
  description: string;
  keyHighlights: string;
};

const emptyForm = (): FormState => ({
  id: '',
  name: '',
  ticker: '',
  sector: '',
  listingType: 'Pre-IPO',
  basePrice: '',
  buyPrice: '',
  listingPrice: '',
  minQty: '10',
  inventoryStatus: 'In Stock',
  founded: '',
  revenue: '',
  valuation: '',
  growth: '',
  isin: '',
  week52High: '',
  week52Low: '',
  marketCap: '',
  peRatio: '',
  pbRatio: '',
  debtEquity: '',
  roe: '',
  bookValue: '',
  faceValue: '',
  logoInitials: '',
  logoUrl: '',
  changePositive: true,
  isFeatured: false,
  logoGradient: GRADIENTS[0],
  description: '',
  keyHighlights: '',
});

function fundamentalsFromShare(share: Share) {
  return {
    week52High: share.week52High || '',
    week52Low: share.week52Low || '',
    marketCap: share.marketCap || '',
    peRatio: share.peRatio || '',
    pbRatio: share.pbRatio || '',
    debtEquity: share.debtEquity || '',
    roe: share.roe || '',
    bookValue: share.bookValue || '',
    faceValue: share.faceValue || '',
  };
}

function shareToForm(share: Share): FormState {
  return {
    id: share.id,
    name: share.name,
    ticker: share.ticker,
    sector: share.sector,
    listingType: share.listingType || 'Pre-IPO',
    basePrice: String(share.basePrice || share.price),
    buyPrice: share.buyPrice ? String(share.buyPrice) : '',
    listingPrice: share.listingPrice ? String(share.listingPrice) : '',
    minQty: String(share.minQty),
    inventoryStatus: share.inventoryStatus || 'In Stock',
    founded: share.founded ? String(share.founded) : '',
    revenue: share.revenue || '',
    valuation: share.valuation || '',
    growth: share.growth || '',
    isin: share.isin || '',
    ...fundamentalsFromShare(share),
    logoInitials: share.logoInitials,
    logoUrl: share.logoUrl || '',
    changePositive: share.changePositive,
    isFeatured: !!share.isFeatured,
    logoGradient: share.logoGradient,
    description: share.description || '',
    keyHighlights: (share.keyHighlights || []).join('\n'),
  };
}

function shareToSavePayload(share: Share, overrides: Partial<{ isFeatured: boolean }> = {}) {
  return {
    id: share.id,
    name: share.name,
    ticker: share.ticker,
    sector: share.sector,
    listingType: share.listingType || 'Pre-IPO',
    sectorColor: share.sectorColor || '#7ac142',
    basePrice: share.basePrice || share.price,
    buyPrice: share.buyPrice ?? undefined,
    listingPrice: share.listingPrice ?? undefined,
    minQty: share.minQty,
    inventoryStatus: share.inventoryStatus || 'In Stock',
    description: share.description || '',
    founded: share.founded ?? 0,
    revenue: share.revenue || '',
    valuation: share.valuation || '',
    growth: share.growth || '',
    isin: share.isin || '',
    ...fundamentalsFromShare(share),
    changePositive: share.changePositive,
    isFeatured: overrides.isFeatured ?? !!share.isFeatured,
    logoInitials: share.logoInitials,
    logoGradient: share.logoGradient,
    logoUrl: share.logoUrl || '',
    keyHighlights: share.keyHighlights || [],
    priceHistory: share.priceHistory,
    chartLabels: share.chartLabels,
  };
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="stock-form-section">
      <div className="stock-form-section-head">
        <div className="stock-form-section-title">{title}</div>
        {hint && <div className="stock-form-section-hint">{hint}</div>}
      </div>
      <div className="stock-form-grid">{children}</div>
    </div>
  );
}

export default function AdminSharePricesPanel() {
  const { shares, refetch } = useShares();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Share | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setLogoUploading(true);
    setFormError('');
    try {
      const res = await uploadShareLogo(file);
      set({ logoUrl: res.url });
      showToast('Logo uploaded — click Save Listing to apply', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Logo upload failed';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const sectorDropdownOptions = useMemo(() => {
    const opts = [...STOCK_SECTORS];
    // Keep current value visible when editing an older custom sector
    if (form.sector && !opts.includes(form.sector)) {
      opts.unshift(form.sector);
    }
    return opts;
  }, [form.sector]);

  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { All: shares.length };
    for (const s of shares) {
      counts[s.sector] = (counts[s.sector] || 0) + 1;
    }
    return counts;
  }, [shares]);

  const sectorFilterOptions = useMemo(
    () => ['All', ...Object.keys(sectorCounts).filter((k) => k !== 'All').sort((a, b) => a.localeCompare(b))],
    [sectorCounts],
  );

  const filteredShares = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shares.filter((s) => {
      if (sectorFilter !== 'All' && s.sector !== sectorFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q)
        || s.ticker.toLowerCase().includes(q)
        || s.sector.toLowerCase().includes(q)
      );
    });
  }, [shares, sectorFilter, search]);

  const openAdd = () => {
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (share: Share) => {
    setForm(shareToForm(share));
    setFormError('');
    setModalOpen(true);
  };

  const invalidate = async () => {
    // Force public homepage / calculator to pick up add, edit, price, star, delete
    await queryClient.invalidateQueries({ queryKey: ['shares'] });
    await queryClient.invalidateQueries({ queryKey: ['sharesConfig'] });
    await queryClient.refetchQueries({ queryKey: ['shares'] });
    await refetch();
  };

  const savePrice = async (shareId: string) => {
    const price = parseFloat(priceEdits[shareId]);
    if (!price || price <= 0) {
      showToast('Enter a valid price', 'warning');
      return;
    }
    await saveShareConfig(shareId, price);
    showToast('Price updated', 'success');
    invalidate();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const basePrice = parseFloat(form.basePrice);
      const minQty = parseInt(form.minQty, 10);
      if (!form.name.trim() || form.ticker.length < 2 || !form.sector.trim() || !basePrice || !minQty) {
        throw new Error('Please fill all required fields marked *');
      }
      if (!form.description.trim() || form.description.trim().length < 20) {
        throw new Error('Company description is required (min 20 characters)');
      }
      const highlights = form.keyHighlights.split('\n').map((l) => l.trim()).filter(Boolean);
      const name = form.name.trim();
      const logoInitials = (form.logoInitials || initialsFromName(name, 'GU'))
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 5)
        .toUpperCase();
      // Chart high/low: built from sell price + Price Trend + Growth %
      const priceHistory = buildPriceHistory(basePrice, form.changePositive, form.growth);
      return saveShare({
        id: form.id || undefined,
        name,
        ticker: form.ticker.toUpperCase(),
        sector: form.sector.trim(),
        listingType: form.listingType,
        sectorColor: '#7ac142',
        basePrice,
        buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : undefined,
        listingPrice: form.listingPrice ? parseFloat(form.listingPrice) : undefined,
        minQty,
        inventoryStatus: form.inventoryStatus,
        description: form.description.trim(),
        founded: form.founded ? parseInt(form.founded, 10) : 0,
        revenue: form.revenue,
        valuation: form.valuation,
        growth: form.growth,
        isin: form.isin.trim().toUpperCase(),
        week52High: form.week52High.trim(),
        week52Low: form.week52Low.trim(),
        marketCap: form.marketCap.trim(),
        peRatio: form.peRatio.trim(),
        pbRatio: form.pbRatio.trim(),
        debtEquity: form.debtEquity.trim(),
        roe: form.roe.trim(),
        bookValue: form.bookValue.trim(),
        faceValue: form.faceValue.trim(),
        changePositive: form.changePositive,
        isFeatured: form.isFeatured,
        logoInitials,
        logoGradient: form.logoGradient,
        logoUrl: form.logoUrl || '',
        keyHighlights: highlights,
        priceHistory,
        chartLabels: defaultChartLabels(),
      });
    },
    onSuccess: () => {
      showToast(form.id ? 'Listing updated' : 'Stock added — live on public site', 'success');
      setModalOpen(false);
      setForm(emptyForm());
      invalidate();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (shareId: string) => deleteShare(shareId),
    onSuccess: () => {
      showToast('Stock removed from platform', 'success');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const starMutation = useMutation({
    mutationFn: (share: Share) => saveShare(shareToSavePayload(share, { isFeatured: !share.isFeatured })),
    onSuccess: (_data, share) => {
      showToast(share.isFeatured ? 'Removed from homepage' : 'Starred — shows in Market Activity', 'success');
      invalidate();
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <>
      <AdminSectionHeader
        compact
        title="Stocks & Listings"
        subtitle="Star a stock to show it in homepage Market Activity. ISIN and other fields are optional."
        badge={`${shares.length} active`}
        action={<button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Stock</button>}
      />

      <div className="stock-list-toolbar">
        <input
          type="search"
          className="report-filter-input stock-list-search"
          placeholder="Search by name, ticker, sector..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="report-filter-input stock-list-sector"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          {sectorFilterOptions.map((sector) => (
            <option key={sector} value={sector}>
              {sector === 'All' ? `All sectors (${sectorCounts.All || 0})` : `${sector} (${sectorCounts[sector] || 0})`}
            </option>
          ))}
        </select>
        {(sectorFilter !== 'All' || search) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setSectorFilter('All'); setSearch(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="admin-workflow-hint">
        <strong>Owner tip:</strong> Click the ★ star on a listing to show it in homepage Market Activity cards.
        Description is required; ISIN and other metrics are optional. Cost price is internal only.
      </div>

      <div className="price-table-wrap">
        <div className="price-table-header">
          <div>
            <div className="price-table-header-title">All Listings</div>
            <div className="price-table-header-hint">
              Showing {filteredShares.length} of {shares.length} — click <strong>Edit</strong> or the company name to update full profile
            </div>
          </div>
        </div>

        {filteredShares.length === 0 ? (
          <div className="stock-list-empty">
            {shares.length === 0
              ? 'No stocks yet. Click "+ Add Stock" to create your first listing.'
              : 'No stocks match your search or sector filter.'}
          </div>
        ) : (
          filteredShares.map((s) => (
          <div key={s.id} className="price-row price-row--stock">
            <button
              type="button"
              className={`stock-star-btn${s.isFeatured ? ' stock-star-btn--on' : ''}`}
              title={s.isFeatured ? 'Remove from homepage Market Activity' : 'Star — show on homepage Market Activity'}
              disabled={starMutation.isPending}
              onClick={() => starMutation.mutate(s)}
              aria-label={s.isFeatured ? 'Unstar stock' : 'Star stock for homepage'}
            >
              {s.isFeatured ? '★' : '☆'}
            </button>
            <CompanyLogo share={s} className="price-logo" />
            <button type="button" className="price-row-info price-row-info--clickable" onClick={() => openEdit(s)}>
              <div className="price-company-name">
                {s.name}
                {s.isFeatured && <span className="stock-type-badge stock-type-badge--custom">★ HOMEPAGE</span>}
                <span className={`stock-type-badge ${s.isBuiltin === false ? 'stock-type-badge--custom' : 'stock-type-badge--base'}`}>
                  {s.listingType || (s.isBuiltin === false ? 'CUSTOM' : 'BASE')}
                </span>
              </div>
              <div className="price-company-sector">
                {s.ticker} · {s.sector} · Min {s.minQty} · {s.inventoryStatus || 'In Stock'}
                {s.buyPrice ? ` · Margin ${formatCurrency(s.price - s.buyPrice)}/sh` : ''}
              </div>
              {!s.description && <div className="stock-missing-hint">⚠ No description — click to edit</div>}
            </button>
            <div className="price-current">{formatCurrency(s.price)}</div>
            <input className="price-input" type="number" placeholder="New price" value={priceEdits[s.id] || ''} onChange={(e) => setPriceEdits({ ...priceEdits, [s.id]: e.target.value })} />
            <div className="price-row-actions">
              <button type="button" className="btn btn-primary btn-sm stock-edit-btn" onClick={() => openEdit(s)}>✎ Edit</button>
              <button type="button" className="btn-update-price" onClick={() => savePrice(s.id)}>Update price</button>
              <button type="button" className="btn btn-sm stock-delete-btn" onClick={() => setDeleteTarget(s)}>Delete</button>
            </div>
          </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-card stock-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{form.id ? 'Edit Listing' : 'Add New Stock'}</h3>
            <p className="modal-subtitle">All fields below appear on the public share detail page (except cost price).</p>

            <FormSection title="Identity" hint="Company name and sector shown on cards and detail page">
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Company Name *</label>
                <input
                  className="report-filter-input"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const prevAuto = initialsFromName(form.name, '');
                    const shouldAuto = !form.logoInitials || form.logoInitials === prevAuto;
                    set({
                      name,
                      ...(shouldAuto ? { logoInitials: initialsFromName(name, '') } : {}),
                    });
                  }}
                  placeholder="e.g. Boat"
                />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Ticker *</label>
                <input className="report-filter-input" value={form.ticker} onChange={(e) => set({ ticker: e.target.value.toUpperCase() })} placeholder="ZEPTO" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Sector *</label>
                <select
                  className="report-filter-input"
                  value={form.sector}
                  onChange={(e) => set({ sector: e.target.value })}
                  required
                >
                  <option value="">Select sector...</option>
                  {sectorDropdownOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Listing Type</label>
                <select className="report-filter-input" value={form.listingType} onChange={(e) => set({ listingType: e.target.value })}>
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Company Logo (optional)</label>
                <div className="stock-logo-upload">
                  <CompanyLogo
                    share={{
                      name: form.name || 'Stock',
                      logoInitials: form.logoInitials,
                      logoGradient: form.logoGradient,
                      logoUrl: form.logoUrl,
                    }}
                    className="stock-logo-preview"
                    size={56}
                  />
                  <div className="stock-logo-upload-actions">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="stock-logo-file-input"
                      disabled={logoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void handleLogoUpload(file);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={logoUploading}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoUploading ? 'Uploading…' : form.logoUrl ? 'Change photo' : 'Upload photo'}
                    </button>
                    {form.logoUrl && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ logoUrl: '' })}>
                        Remove photo
                      </button>
                    )}
                    <p className="stock-logo-hint">JPG, PNG or WEBP · max 2MB. Upload, then click Save Listing.</p>
                  </div>
                </div>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Logo Initials *</label>
                <input
                  className="report-filter-input"
                  maxLength={5}
                  value={form.logoInitials}
                  onChange={(e) => set({ logoInitials: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) })}
                  placeholder="BO"
                />
                <p className="stock-logo-hint" style={{ marginTop: 4 }}>
                  Shown on website when no photo. Example: Boat → BO. Click Save Listing after changing.
                </p>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Logo Color (if no photo)</label>
                <div className="stock-color-picker">
                  {GRADIENTS.map((g) => (
                    <button key={g} type="button" className={`stock-color-option${form.logoGradient === g ? ' selected' : ''}`} style={{ background: g }} onClick={() => set({ logoGradient: g })} />
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Pricing & Inventory" hint="Sell price is public. Cost price is for your margin tracking only.">
              <div className="report-filter-group">
                <label className="report-filter-label">Sell Price (₹) *</label>
                <input className="report-filter-input" type="number" min="1" value={form.basePrice} onChange={(e) => set({ basePrice: e.target.value })} />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Cost / Buy Price (₹)</label>
                <input className="report-filter-input" type="number" min="0" value={form.buyPrice} onChange={(e) => set({ buyPrice: e.target.value })} placeholder="Internal only" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Listing Price (₹)</label>
                <input
                  className="report-filter-input"
                  type="number"
                  min="0"
                  value={form.listingPrice}
                  onChange={(e) => set({ listingPrice: e.target.value })}
                  placeholder="IPO / listing price"
                />
                <p className="stock-logo-hint" style={{ marginTop: 4 }}>Optional. When set, shows on homepage as Pre-IPO vs Listing comparison.</p>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Min Quantity *</label>
                <input className="report-filter-input" type="number" min="1" value={form.minQty} onChange={(e) => set({ minQty: e.target.value })} />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Availability</label>
                <select className="report-filter-input" value={form.inventoryStatus} onChange={(e) => set({ inventoryStatus: e.target.value })}>
                  {INVENTORY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Chart trend (high / low) *</label>
                <select
                  className="report-filter-input"
                  value={form.changePositive ? 'up' : 'down'}
                  onChange={(e) => set({ changePositive: e.target.value === 'up' })}
                >
                  <option value="up">▲ Rising (green chart — price moved up to sell price)</option>
                  <option value="down">▼ Falling (red chart — price moved down to sell price)</option>
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">★ Homepage (star)</label>
                <select className="report-filter-input" value={form.isFeatured ? 'yes' : 'no'} onChange={(e) => set({ isFeatured: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes — show in Market Activity</option>
                </select>
              </div>
            </FormSection>

            <FormSection title="Company Profile" hint="All fields optional except description — fill only what you have">
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Company Description *</label>
                <textarea className="report-filter-input" rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What does the company do? Why is it attractive pre-IPO? Mention business model, market position, and growth drivers..." />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Founded Year (optional)</label>
                <input className="report-filter-input" type="number" value={form.founded} onChange={(e) => set({ founded: e.target.value })} />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Annual Revenue (optional)</label>
                <input className="report-filter-input" value={form.revenue} onChange={(e) => set({ revenue: e.target.value })} placeholder="₹5,000 Cr" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Valuation (optional)</label>
                <input className="report-filter-input" value={form.valuation} onChange={(e) => set({ valuation: e.target.value })} placeholder="₹50,000 Cr" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Growth (YoY) — sets chart slope</label>
                <input
                  className="report-filter-input"
                  value={form.growth}
                  onChange={(e) => {
                    const growth = e.target.value;
                    const inferred = trendFromGrowth(growth);
                    set({
                      growth,
                      ...(inferred === null ? {} : { changePositive: inferred }),
                    });
                  }}
                  placeholder="+45% or -12%"
                />
              </div>
              <p className="stock-logo-hint" style={{ gridColumn: '1 / -1', marginTop: '-0.5rem' }}>
                Chart is auto-built: sell price is the <strong>latest</strong> point.
                Rising + growth (e.g. +45%) = line goes up (green). Falling / negative growth = line goes down (red).
              </p>
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Key Highlights (one per line, optional)</label>
                <textarea className="report-filter-input" rows={4} value={form.keyHighlights} onChange={(e) => set({ keyHighlights: e.target.value })} placeholder={'Market leader in quick commerce\nBacked by top-tier investors\nPath to profitability in FY26'} />
              </div>
            </FormSection>

            <FormSection title="Key Data (all optional)" hint="Leave blank if not available — public site shows N/A">
              <div className="report-filter-group">
                <label className="report-filter-label">52-wk high</label>
                <input className="report-filter-input" value={form.week52High} onChange={(e) => set({ week52High: e.target.value })} placeholder="₹8.25" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">52-wk low</label>
                <input className="report-filter-input" value={form.week52Low} onChange={(e) => set({ week52Low: e.target.value })} placeholder="₹2.75" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Market cap</label>
                <input className="report-filter-input" value={form.marketCap} onChange={(e) => set({ marketCap: e.target.value })} placeholder="₹6,545 Cr" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">P/E ratio</label>
                <input className="report-filter-input" value={form.peRatio} onChange={(e) => set({ peRatio: e.target.value })} placeholder="N/A if unknown" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">P/B ratio</label>
                <input className="report-filter-input" value={form.pbRatio} onChange={(e) => set({ pbRatio: e.target.value })} placeholder="4.8" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Debt / Equity</label>
                <input className="report-filter-input" value={form.debtEquity} onChange={(e) => set({ debtEquity: e.target.value })} placeholder="0" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">ROE</label>
                <input className="report-filter-input" value={form.roe} onChange={(e) => set({ roe: e.target.value })} placeholder="-1.89%" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Book value</label>
                <input className="report-filter-input" value={form.bookValue} onChange={(e) => set({ bookValue: e.target.value })} placeholder="₹1.24" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Face value</label>
                <input className="report-filter-input" value={form.faceValue} onChange={(e) => set({ faceValue: e.target.value })} placeholder="₹1" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">ISIN</label>
                <input className="report-filter-input" value={form.isin} onChange={(e) => set({ isin: e.target.value.toUpperCase() })} placeholder="INE312K01010" maxLength={20} />
              </div>
            </FormSection>

            {formError && <p className="stock-form-error">{formError}</p>}
            <button type="button" className="btn btn-primary btn-full" disabled={saveMutation.isPending} onClick={() => { setFormError(''); saveMutation.mutate(); }}>
              {form.id ? 'Save Listing' : 'Add Stock'}
            </button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setModalOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Stock?</h3>
            <p className="modal-subtitle">Remove &quot;{deleteTarget.name}&quot; from the public site? Existing orders are not affected.</p>
            <button type="button" className="btn btn-danger btn-full" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>Delete</button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
