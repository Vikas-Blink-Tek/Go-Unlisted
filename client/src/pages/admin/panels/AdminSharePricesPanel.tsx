import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { deleteShare, saveShare, saveShareConfig, uploadShareLogo } from '../../../api/shares';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/format';
import type { Share } from '../../../types';
import AdminSectionHeader from '../components/AdminSectionHeader';
import StockListingModal from '../components/StockListingModal';
import CompanyLogo, { initialsFromName } from '../../../components/shares/CompanyLogo';
import { STOCK_SECTORS } from '../../../data/sharesCatalog';
import { buildPriceHistory, defaultChartLabels } from '../../../utils/priceHistory';

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
  isTop10: boolean;
  logoGradient: string;
  description: string;
  keyHighlights: string;
  discountTiers: { minQty: number; price: number }[];
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
  isTop10: false,
  logoGradient: GRADIENTS[0],
  description: '',
  keyHighlights: '',
  discountTiers: [],
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
    isTop10: !!share.isTop10,
    logoGradient: share.logoGradient,
    description: share.description || '',
    keyHighlights: (share.keyHighlights || []).join('\n'),
    discountTiers: share.discountTiers || [],
  };
}

function shareToSavePayload(share: Share, overrides: Partial<{ isFeatured: boolean, isTop10: boolean }> = {}) {
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
    isTop10: overrides.isTop10 ?? !!share.isTop10,
    logoInitials: share.logoInitials,
    logoGradient: share.logoGradient,
    logoUrl: share.logoUrl || '',
    keyHighlights: share.keyHighlights || [],
    priceHistory: share.priceHistory,
    chartLabels: share.chartLabels,
    discountTiers: share.discountTiers || [],
  };
}

export default function AdminSharePricesPanel() {
  const { shares, refetch } = useShares();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [listingEdits, setListingEdits] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Share | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

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

  const savePrice = async (share: Share) => {
    const shareId = share.id;
    const priceRaw = priceEdits[shareId];
    const listingRaw = listingEdits[shareId];
    const hasPriceEdit = priceRaw != null && priceRaw !== '';
    const listingTouched = Object.prototype.hasOwnProperty.call(listingEdits, shareId);

    if (!hasPriceEdit && !listingTouched) {
      showToast('Enter a sell price and/or listing price to update', 'warning');
      return;
    }

    const price = hasPriceEdit ? parseFloat(priceRaw) : share.price;
    if (!price || price <= 0) {
      showToast('Enter a valid sell price', 'warning');
      return;
    }

    let listingPrice: number | null | undefined = undefined;
    if (listingTouched) {
      const parsed = parseFloat(listingRaw);
      listingPrice = listingRaw.trim() === '' || !parsed || parsed <= 0 ? null : parsed;
    }

    await saveShareConfig(shareId, price, listingPrice);
    const listingMsg =
      listingTouched && listingPrice != null
        ? ` — Listing ₹${listingPrice.toLocaleString('en-IN')} (homepage comparison on)`
        : listingTouched && listingPrice === null
          ? ' — Listing cleared'
          : '';
    showToast(`Prices updated${listingMsg}`, 'success');
    setPriceEdits((prev) => {
      const next = { ...prev };
      delete next[shareId];
      return next;
    });
    setListingEdits((prev) => {
      const next = { ...prev };
      delete next[shareId];
      return next;
    });
    invalidate();
  };

  const toggleTop10Mutation = useMutation({
    mutationFn: (share: Share) => saveShare(shareToSavePayload(share, { isTop10: !share.isTop10 })),
    onSuccess: () => {
      invalidate();
    },
    onError: () => showToast('Failed to update Top 10 status', 'error'),
  });

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
        listingPrice: form.listingPrice ? parseFloat(form.listingPrice) : null,
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
        isTop10: form.isTop10,
        logoInitials,
        logoGradient: form.logoGradient,
        logoUrl: form.logoUrl || '',
        keyHighlights: highlights,
        priceHistory,
        chartLabels: defaultChartLabels(),
        discountTiers: form.discountTiers,
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
      showToast(share.isFeatured ? 'Removed from homepage' : 'Starred — homepage Market Activity only', 'success');
      invalidate();
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleExport = () => {
    const headers = ['Name', 'Ticker', 'Sector', 'Sell Price', 'Listing Price', 'Min Qty', 'Valuation', 'Status', 'Homepage Featured', 'Top 10'];
    const rows = filteredShares.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.ticker.replace(/"/g, '""')}"`,
      `"${s.sector.replace(/"/g, '""')}"`,
      s.price,
      s.listingPrice || '',
      s.minQty,
      `"${(s.valuation || '').replace(/"/g, '""')}"`,
      `"${(s.inventoryStatus || '').replace(/"/g, '""')}"`,
      s.isFeatured ? 'Yes' : 'No',
      s.isTop10 ? 'Yes' : 'No'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gounlisted_price_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <AdminSectionHeader
        compact
        title="Stocks & Listings"
        subtitle="Star a stock for Market Activity. Set Listing Price (₹) for Pre-IPO vs listing comparison on homepage."
        badge={`${shares.length} active`}
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleExport}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.25rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export CSV
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Stock</button>
          </div>
        }
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
        <strong>Pre-IPO vs Listing:</strong> Homepage comparison tabhi dikhega jab <strong>Listing ₹</strong> set ho.
        Abhi sab stocks par listing empty hai — neeche <strong>Listing ₹</strong> bharo aur <strong>Update prices</strong> dabao.
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
          <div key={s.id} className={`price-row price-row--stock${s.isFeatured && !s.listingPrice ? ' price-row--needs-listing' : ''}`}>
            <div className="price-row-main">
              <button
                type="button"
                className={`stock-star-btn${s.isFeatured ? ' stock-star-btn--on' : ''}`}
                title={s.isFeatured ? 'Remove from homepage Market Activity' : 'Star — homepage only (hidden from /shares list)'}
                disabled={starMutation.isPending}
                onClick={() => starMutation.mutate(s)}
                aria-label={s.isFeatured ? 'Unstar stock' : 'Star stock for homepage'}
              >
                {s.isFeatured ? '★' : '☆'}
              </button>
              <button
                type="button"
                onClick={() => toggleTop10Mutation.mutate(s)}
                className={`stock-star-btn${s.isTop10 ? ' stock-star-btn--on' : ''}`}
                title={s.isTop10 ? 'Remove from Top 10' : 'Mark as Top 10'}
                aria-label={s.isTop10 ? 'Remove from Top 10' : 'Add to Top 10'}
              >
                {s.isTop10 ? '🏆' : '🏆'}
              </button>
              <CompanyLogo share={s} className="price-logo" />
              <button type="button" className="price-row-info price-row-info--clickable" onClick={() => openEdit(s)}>
                <div className="price-company-name">
                  {s.name}
                  {s.isFeatured && <span className="stock-type-badge stock-type-badge--custom">★ HOMEPAGE</span>}
                  {s.isTop10 && <span className="stock-type-badge stock-type-badge--custom" style={{ background: '#f59e0b', color: '#fff' }}>🏆 TOP 10</span>}
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
            </div>

            <div className="price-row-pricing">
              <div className="price-row-pricing-display">
                <div className="price-current">
                  <div className="price-current-label">Pre-IPO</div>
                  <div className="price-current-value">{formatCurrency(s.price)}</div>
                </div>
                <div className="price-current price-current--listing">
                  <div className="price-current-label">Listing</div>
                  <div className="price-current-value">{s.listingPrice ? formatCurrency(s.listingPrice) : '—'}</div>
                </div>
              </div>
              <div className="price-row-pricing-edit">
                <label className="price-field">
                  <span className="price-field-label">Sell ₹</span>
                  <input
                    className="price-input"
                    type="number"
                    placeholder={String(s.price)}
                    title="Pre-IPO / sell price"
                    value={priceEdits[s.id] || ''}
                    onChange={(e) => setPriceEdits({ ...priceEdits, [s.id]: e.target.value })}
                  />
                </label>
                <label className="price-field price-field--listing">
                  <span className="price-field-label">Listing ₹</span>
                  <input
                    className="price-input price-input--listing"
                    type="number"
                    placeholder="e.g. 4800"
                    title="IPO / listing price — required for homepage Pre-IPO vs Listing comparison"
                    value={listingEdits[s.id] ?? ''}
                    onChange={(e) => setListingEdits({ ...listingEdits, [s.id]: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="price-row-actions">
              <button type="button" className="btn btn-primary btn-sm stock-edit-btn" onClick={() => openEdit(s)}>✎ Edit</button>
              <button type="button" className="btn-update-price" onClick={() => savePrice(s)}>Update prices</button>
              <button type="button" className="btn btn-sm stock-delete-btn" onClick={() => setDeleteTarget(s)}>Delete</button>
            </div>
          </div>
          ))
        )}
      </div>

      {modalOpen && (
        <StockListingModal
          form={form}
          set={set}
          formError={formError}
          isPending={saveMutation.isPending}
          logoUploading={logoUploading}
          sectorOptions={sectorDropdownOptions}
          onClose={() => setModalOpen(false)}
          onSave={() => { setFormError(''); saveMutation.mutate(); }}
          onLogoUpload={handleLogoUpload}
        />
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
