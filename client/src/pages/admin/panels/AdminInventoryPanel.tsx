import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getInventory, updateInventory, type InventoryItem } from '../../../api/inventory';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/format';
import AdminSectionHeader from '../components/AdminSectionHeader';
import CompanyLogo, { initialsFromName } from '../../../components/shares/CompanyLogo';

const INVENTORY_STATUSES = ['In Stock', 'Limited', 'On Request', 'Out of Stock'];

type EditState = {
  qtyOnHand: string;
  buyPrice: string;
  inventoryStatus: string;
};

export default function AdminInventoryPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: getInventory,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.ticker.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    let units = 0;
    let value = 0;
    let lowStock = 0;
    for (const i of items) {
      units += i.qtyOnHand || 0;
      value += i.inventoryValue || 0;
      if ((i.qtyOnHand || 0) <= 10) lowStock += 1;
    }
    return { units, value, lowStock, skus: items.length };
  }, [items]);

  const getEdit = (item: InventoryItem): EditState => {
    if (edits[item.id]) return edits[item.id];
    return {
      qtyOnHand: String(item.qtyOnHand ?? 0),
      buyPrice: item.buyPrice ? String(item.buyPrice) : '',
      inventoryStatus: item.inventoryStatus || 'In Stock',
    };
  };

  const setEdit = (item: InventoryItem, patch: Partial<EditState>) => {
    const base = edits[item.id] ?? {
      qtyOnHand: String(item.qtyOnHand ?? 0),
      buyPrice: item.buyPrice ? String(item.buyPrice) : '',
      inventoryStatus: item.inventoryStatus || 'In Stock',
    };
    setEdits((prev) => ({ ...prev, [item.id]: { ...base, ...patch } }));
  };

  const saveMutation = useMutation({
    mutationFn: updateInventory,
    onSuccess: () => {
      showToast('Inventory updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      setSavingId(null);
    },
    onError: (e: Error) => {
      showToast(e.message, 'error');
      setSavingId(null);
    },
  });

  const handleSave = (item: InventoryItem) => {
    const edit = getEdit(item);
    const qty = Math.max(0, parseInt(edit.qtyOnHand, 10) || 0);
    setSavingId(item.id);
    saveMutation.mutate({
      shareId: item.id,
      qtyOnHand: qty,
      inventoryStatus: edit.inventoryStatus,
      buyPrice: edit.buyPrice === '' ? null : edit.buyPrice,
    });
  };

  return (
    <div className="inv-panel">
      <AdminSectionHeader
        compact
        title="Inventory"
        subtitle="Track quantity on hand, cost price, and stock status for each listing"
        badge={`${totals.skus} SKUs`}
      />

      <div className="inv-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totals.units.toLocaleString('en-IN')}</div>
          <div className="stat-label">Units on hand</div>
        </div>
        <div className="stat-card stat-card-highlight">
          <div className="stat-value">{formatCurrency(totals.value)}</div>
          <div className="stat-label">Inventory value (at cost)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totals.lowStock}</div>
          <div className="stat-label">Low stock (≤10 units)</div>
        </div>
      </div>

      <div className="inv-toolbar">
        <input
          className="report-filter-input inv-search"
          placeholder="Search by name or ticker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="price-table-wrap">
        {isLoading && <p style={{ padding: '1rem', color: 'var(--muted)' }}>Loading inventory...</p>}
        <table className="data-table inv-table">
          <thead>
            <tr>
              <th>Stock</th>
              <th>Qty on hand</th>
              <th>Cost (buy)</th>
              <th>Sell price</th>
              <th>Margin</th>
              <th>Status</th>
              <th>Value</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const edit = getEdit(item);
              const margin = item.marginPerShare;
              const marginPct = item.marginPct;
              const isSaving = savingId === item.id && saveMutation.isPending;
              return (
                <tr key={item.id} className={(item.qtyOnHand || 0) <= 10 ? 'inv-row-low' : undefined}>
                  <td>
                    <div className="inv-stock-cell">
                      <CompanyLogo
                        share={{
                          name: item.name,
                          logoInitials: initialsFromName(item.name),
                          logoGradient: 'linear-gradient(135deg, #003478, #0050a8)',
                          logoUrl: '',
                        }}
                        size={36}
                      />
                      <div>
                        <strong>{item.name}</strong>
                        <span className="inv-ticker">{item.ticker}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="inv-inline-input"
                      value={edit.qtyOnHand}
                      onChange={(e) => setEdit(item, { qtyOnHand: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="inv-inline-input"
                      placeholder="—"
                      value={edit.buyPrice}
                      onChange={(e) => setEdit(item, { buyPrice: e.target.value })}
                    />
                  </td>
                  <td>{formatCurrency(item.price)}</td>
                  <td>
                    {margin != null ? (
                      <span className={margin >= 0 ? 'inv-margin-pos' : 'inv-margin-neg'}>
                        {formatCurrency(margin)}
                        {marginPct != null && <small> ({marginPct}%)</small>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <select
                      className="inv-inline-select"
                      value={edit.inventoryStatus}
                      onChange={(e) => setEdit(item, { inventoryStatus: e.target.value })}
                    >
                      {INVENTORY_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>{item.inventoryValue != null ? formatCurrency(item.inventoryValue) : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isSaving}
                      onClick={() => handleSave(item)}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && !isLoading && (
          <div className="admin-table-empty">
            <strong>No stocks found</strong>
            Add listings under Stocks &amp; Listings, then set quantities here.
          </div>
        )}
      </div>
    </div>
  );
}
