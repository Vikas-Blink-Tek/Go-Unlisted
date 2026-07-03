import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { deleteShare, saveShare, saveShareConfig } from '../../../api/shares';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/format';
import type { Share } from '../../../types';
import AdminSectionHeader from '../components/AdminSectionHeader';
import { STOCK_SECTORS } from '../../../data/sharesCatalog';

const SECTOR_FILTER_OPTIONS = ['All', ...STOCK_SECTORS];
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
  minQty: string;
  inventoryStatus: string;
  founded: string;
  revenue: string;
  valuation: string;
  growth: string;
  ipoTimeline: string;
  lockInMonths: string;
  logoInitials: string;
  changePositive: boolean;
  isFeatured: boolean;
  logoGradient: string;
  description: string;
  keyHighlights: string;
  riskNotes: string;
};

const emptyForm = (): FormState => ({
  id: '',
  name: '',
  ticker: '',
  sector: '',
  listingType: 'Pre-IPO',
  basePrice: '',
  buyPrice: '',
  minQty: '10',
  inventoryStatus: 'In Stock',
  founded: '',
  revenue: '',
  valuation: '',
  growth: '',
  ipoTimeline: '',
  lockInMonths: '6',
  logoInitials: '',
  changePositive: true,
  isFeatured: false,
  logoGradient: GRADIENTS[0],
  description: '',
  keyHighlights: '',
  riskNotes: 'Unlisted shares are illiquid. Past performance does not guarantee future returns. Invest only what you can afford to lose.',
});

function shareToForm(share: Share): FormState {
  return {
    id: share.id,
    name: share.name,
    ticker: share.ticker,
    sector: share.sector,
    listingType: share.listingType || 'Pre-IPO',
    basePrice: String(share.basePrice || share.price),
    buyPrice: share.buyPrice ? String(share.buyPrice) : '',
    minQty: String(share.minQty),
    inventoryStatus: share.inventoryStatus || 'In Stock',
    founded: share.founded ? String(share.founded) : '',
    revenue: share.revenue || '',
    valuation: share.valuation || '',
    growth: share.growth || '',
    ipoTimeline: share.ipoTimeline || '',
    lockInMonths: String(share.lockInMonths ?? 6),
    logoInitials: share.logoInitials,
    changePositive: share.changePositive,
    isFeatured: !!share.isFeatured,
    logoGradient: share.logoGradient,
    description: share.description || '',
    keyHighlights: (share.keyHighlights || []).join('\n'),
    riskNotes: share.riskNotes || '',
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
  const [editingShare, setEditingShare] = useState<Share | null>(null);

  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { All: shares.length };
    for (const s of shares) {
      counts[s.sector] = (counts[s.sector] || 0) + 1;
    }
    return counts;
  }, [shares]);

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
    setEditingShare(null);
    setModalOpen(true);
  };

  const openEdit = (share: Share) => {
    setForm(shareToForm(share));
    setFormError('');
    setEditingShare(share);
    setModalOpen(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shares'] });
    queryClient.invalidateQueries({ queryKey: ['sharesConfig'] });
    refetch();
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
      if (!form.name.trim() || form.ticker.length < 2 || !form.sector || !basePrice || !minQty || !form.logoInitials) {
        throw new Error('Please fill all required fields marked *');
      }
      if (!form.description.trim() || form.description.trim().length < 40) {
        throw new Error('Company description is required (min 40 characters) — buyers need this on the detail page');
      }
      const highlights = form.keyHighlights.split('\n').map((l) => l.trim()).filter(Boolean);
      const defaultHistory = { '3M': [basePrice], '6M': [basePrice], '1Y': [basePrice] };
      const defaultLabels = { '3M': ['Now'], '6M': ['Now'], '1Y': ['Now'] };
      return saveShare({
        id: form.id || undefined,
        name: form.name.trim(),
        ticker: form.ticker.toUpperCase(),
        sector: form.sector,
        listingType: form.listingType,
        sectorColor: '#7ac142',
        basePrice,
        buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : undefined,
        minQty,
        inventoryStatus: form.inventoryStatus,
        description: form.description.trim(),
        founded: form.founded ? parseInt(form.founded, 10) : 0,
        revenue: form.revenue,
        valuation: form.valuation,
        growth: form.growth,
        ipoTimeline: form.ipoTimeline,
        lockInMonths: parseInt(form.lockInMonths, 10) || 6,
        changePositive: form.changePositive,
        isFeatured: form.isFeatured,
        logoInitials: form.logoInitials.toUpperCase(),
        logoGradient: form.logoGradient,
        keyHighlights: highlights,
        riskNotes: form.riskNotes.trim(),
        priceHistory: editingShare?.priceHistory ?? defaultHistory,
        chartLabels: editingShare?.chartLabels ?? defaultLabels,
      });
    },
    onSuccess: () => {
      showToast(form.id ? 'Listing updated' : 'Stock added — live on public site', 'success');
      setModalOpen(false);
      setForm(emptyForm());
      setEditingShare(null);
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

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <>
      <AdminSectionHeader
        compact
        title="Stocks & Listings"
        subtitle="Description, IPO info, pricing, and inventory — everything buyers see on the site."
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
          {SECTOR_FILTER_OPTIONS.map((sector) => (
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
        <strong>Owner tip:</strong> Fill company description, key highlights, IPO timeline, and risk notes for every listing.
        Buyers research before paying — empty detail pages lose trust. Cost price (buy price) is internal only and never shown on the public site.
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
            <div className="price-logo" style={{ background: s.logoGradient }}>{s.logoInitials}</div>
            <button type="button" className="price-row-info price-row-info--clickable" onClick={() => openEdit(s)}>
              <div className="price-company-name">
                {s.name}
                {s.isFeatured && <span className="stock-type-badge stock-type-badge--custom">FEATURED</span>}
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
                <input className="report-filter-input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Zepto" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Ticker *</label>
                <input className="report-filter-input" value={form.ticker} onChange={(e) => set({ ticker: e.target.value.toUpperCase() })} placeholder="ZEPTO" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Sector *</label>
                <select className="report-filter-input" value={form.sector} onChange={(e) => set({ sector: e.target.value })}>
                  <option value="">Select sector...</option>
                  {STOCK_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Listing Type</label>
                <select className="report-filter-input" value={form.listingType} onChange={(e) => set({ listingType: e.target.value })}>
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Logo Initials *</label>
                <input className="report-filter-input" maxLength={3} value={form.logoInitials} onChange={(e) => set({ logoInitials: e.target.value.toUpperCase() })} />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Logo Color</label>
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
                <label className="report-filter-label">Price Trend</label>
                <select className="report-filter-input" value={form.changePositive ? 'up' : 'down'} onChange={(e) => set({ changePositive: e.target.value === 'up' })}>
                  <option value="up">▲ Rising</option>
                  <option value="down">▼ Falling</option>
                </select>
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Featured on Homepage</label>
                <select className="report-filter-input" value={form.isFeatured ? 'yes' : 'no'} onChange={(e) => set({ isFeatured: e.target.value === 'yes' })}>
                  <option value="no">No</option>
                  <option value="yes">Yes — show in featured section</option>
                </select>
              </div>
            </FormSection>

            <FormSection title="Company Profile" hint="Shown on share detail page — write 2–4 sentences buyers can trust">
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Company Description *</label>
                <textarea className="report-filter-input" rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What does the company do? Why is it attractive pre-IPO? Mention business model, market position, and growth drivers..." />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Founded Year</label>
                <input className="report-filter-input" type="number" value={form.founded} onChange={(e) => set({ founded: e.target.value })} />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Annual Revenue</label>
                <input className="report-filter-input" value={form.revenue} onChange={(e) => set({ revenue: e.target.value })} placeholder="₹5,000 Cr" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Valuation</label>
                <input className="report-filter-input" value={form.valuation} onChange={(e) => set({ valuation: e.target.value })} placeholder="₹50,000 Cr" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Growth (YoY)</label>
                <input className="report-filter-input" value={form.growth} onChange={(e) => set({ growth: e.target.value })} placeholder="+45%" />
              </div>
            </FormSection>

            <FormSection title="IPO & Investment Case" hint="Pre-IPO buyers care about listing timeline, lock-in, and bullet-point highlights">
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">IPO / Listing Timeline</label>
                <input className="report-filter-input" value={form.ipoTimeline} onChange={(e) => set({ ipoTimeline: e.target.value })} placeholder="e.g. Expected H2 2026, DRHP filed, No IPO date announced" />
              </div>
              <div className="report-filter-group">
                <label className="report-filter-label">Post-IPO Lock-in (months)</label>
                <input className="report-filter-input" type="number" min="0" value={form.lockInMonths} onChange={(e) => set({ lockInMonths: e.target.value })} />
              </div>
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Key Highlights (one per line)</label>
                <textarea className="report-filter-input" rows={4} value={form.keyHighlights} onChange={(e) => set({ keyHighlights: e.target.value })} placeholder={'Market leader in quick commerce\nBacked by top-tier investors\nPath to profitability in FY26'} />
              </div>
              <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
                <label className="report-filter-label">Risk Disclaimer (shown on detail page)</label>
                <textarea className="report-filter-input" rows={3} value={form.riskNotes} onChange={(e) => set({ riskNotes: e.target.value })} />
              </div>
            </FormSection>

            {formError && <p className="stock-form-error">{formError}</p>}
            <button type="button" className="btn btn-primary btn-full" disabled={saveMutation.isPending} onClick={() => { setFormError(''); saveMutation.mutate(); }}>
              {form.id ? 'Save Listing' : 'Add Stock'}
            </button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => { setModalOpen(false); setEditingShare(null); }}>Cancel</button>
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
