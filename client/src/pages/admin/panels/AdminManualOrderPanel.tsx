import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { saveOrder, getOrders } from '../../../api/orders';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { calcOrderTotal, formatCurrency } from '../../../utils/format';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { getAdminOrderStatusLabel, getOrderStatusClass } from '../../../utils/orderStatus';
import AdminSectionHeader from '../components/AdminSectionHeader';
import AutofillBlocker from '../../../components/forms/AutofillBlocker';
import { blockTelInput, blockTextInput } from '../../../utils/autofill';
import type { Order } from '../../../types';

const empty = { orderId: '', name: '', phone: '', shareId: '', qty: '', price: '', method: 'NEFT', utr: '', source: 'Offline' };

export default function AdminManualOrderPanel() {
  const { showToast } = useToast();
  const { shares } = useShares();
  const { settings } = useSiteSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);

  const handleQtyChange = (val: string) => {
    const qty = parseInt(val, 10) || 0;
    const share = shares.find((s) => s.id === form.shareId);
    let newPrice = form.price;
    
    if (share) {
      let price = share.price;
      if (share.discountTiers && share.discountTiers.length > 0) {
        const sortedTiers = [...share.discountTiers].sort((a, b) => b.minQty - a.minQty);
        for (const tier of sortedTiers) {
          if (qty >= tier.minQty) {
            price = tier.price;
            break;
          }
        }
      }
      newPrice = String(price);
    }
    
    setForm({ ...form, qty: val, price: newPrice });
  };

  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getOrders });
  const manualOrders = (ordersQuery.data || []).filter((o) => o.orderSource === 'Offline' || o.method === 'Offline');

  const saveMut = useMutation({
    mutationFn: saveOrder,
    onSuccess: (res) => {
      showToast(editId ? 'Order updated' : `Order ${res.orderId || ''} created`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setForm(empty);
      setEditId(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const share = shares.find((s) => s.id === form.shareId);
    const qty = parseInt(form.qty, 10);
    const price = parseFloat(form.price) || share?.price || 0;
    if (!form.name.trim() || !/^\d{10}$/.test(form.phone) || !share || qty < share.minQty) {
      showToast('Fill all required fields correctly', 'error');
      return;
    }
    const utrClean = form.utr.trim().replace(/\s+/g, '').toUpperCase();
    if (utrClean && (utrClean.length < 6 || utrClean.length > 30)) {
      showToast('UTR / reference must be 6–30 characters', 'error');
      return;
    }
    saveMut.mutate({
      ...(editId ? { orderId: editId } : {}),
      shareId: share.id,
      shareName: share.name,
      shareTicker: share.ticker,
      buyerName: form.name.trim(),
      buyerPhone: form.phone,
      buyerEmail: '',
      pricePerShare: price,
      qty,
      method: form.method,
      transactionId: utrClean || undefined,
      status: 'Confirmed',
      orderSource: form.source,
      _fullUpdate: !!editId,
    });
  };

  const loadEdit = (o: Order) => {
    setEditId(o.orderId);
    setForm({
      orderId: o.orderId,
      name: o.buyerName,
      phone: o.buyerPhone || '',
      shareId: o.shareId,
      qty: String(o.qty),
      price: String(o.pricePerShare),
      method: o.method || 'Offline',
      utr: o.transactionId || o.utr || '',
      source: o.orderSource || 'Offline',
    });
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Manual Order Entry"
        subtitle="Record phone, WhatsApp, or walk-in deals. Orders are created as confirmed."
      />

      <div className="report-filter-box">
        <div className="report-filter-title">{editId ? `Edit order ${editId}` : 'New order'}</div>
        <form onSubmit={handleSubmit} autoComplete="off" style={{ position: 'relative' }}>
          <AutofillBlocker />
          <div className="report-filter-grid">
            <div className="report-filter-group">
              <label className="report-filter-label">Client Name *</label>
              <input className="report-filter-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} {...blockTextInput({ name: 'manual-order-name' })} />
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Mobile *</label>
              <input className="report-filter-input" required maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} {...blockTelInput({ name: 'manual-order-phone' })} />
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Scrip *</label>
              <select className="report-filter-input" required value={form.shareId} onChange={(e) => {
                const s = shares.find((x) => x.id === e.target.value);
                let newPrice = s ? String(s.price) : form.price;
                const newQty = s ? String(s.minQty) : form.qty;
                if (s && s.discountTiers && s.discountTiers.length > 0) {
                  const sortedTiers = [...s.discountTiers].sort((a, b) => b.minQty - a.minQty);
                  const parsedQty = parseInt(newQty, 10) || 0;
                  for (const tier of sortedTiers) {
                    if (parsedQty >= tier.minQty) {
                      newPrice = String(tier.price);
                      break;
                    }
                  }
                }
                setForm({ ...form, shareId: e.target.value, price: newPrice, qty: newQty });
              }}>
                <option value="">Select share</option>
                {shares.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Quantity *</label>
              <input className="report-filter-input" type="number" required value={form.qty} onChange={(e) => handleQtyChange(e.target.value)} />
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Price / Share *</label>
              <input className="report-filter-input" type="number" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Payment Method</label>
              <select className="report-filter-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['NEFT', 'IMPS', 'UPI', 'Cash', 'Offline'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">UTR / Reference No.</label>
              <input
                className="report-filter-input"
                placeholder="Bank UTR or payment reference (optional for cash)"
                value={form.utr}
                onChange={(e) => setForm({ ...form, utr: e.target.value.toUpperCase() })}
                {...blockTextInput({ name: 'manual-order-utr' })}
              />
            </div>
          </div>
          {form.shareId && form.qty && form.price && (
            <div className="pay-amount-box" style={{ marginTop: '1rem' }}>
              <span>Total payable</span>
              <strong>{formatCurrency(calcOrderTotal(parseFloat(form.price), parseInt(form.qty, 10), settings))}</strong>
            </div>
          )}
          <div className="report-filter-actions">
            <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>{editId ? 'Update Order' : 'Create Order'}</button>
            {editId && <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setForm(empty); }}>Cancel Edit</button>}
          </div>
        </form>
      </div>

      <AdminSectionHeader compact title="Recent Manual Orders" badge={`${manualOrders.length} orders`} />
      <div className="price-table-wrap">
        <table className="data-table">
          <thead><tr><th>Order ID</th><th>Client</th><th>Share</th><th>Qty</th><th>Total</th><th>UTR / Ref</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {manualOrders.slice(0, 20).map((o) => (
              <tr key={o.orderId}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                <td>{o.buyerName}</td>
                <td>{o.companyName || o.shareName}</td>
                <td>{o.qty}</td>
                <td>{formatCurrency(o.totalPaid || 0)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{o.transactionId || o.utr || '—'}</td>
                <td>
                  <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                    {getAdminOrderStatusLabel(o.status)}
                  </span>
                </td>
                <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => loadEdit(o)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!manualOrders.length && (
          <div className="admin-table-empty">
            <strong>No manual orders yet</strong>
            Phone and walk-in deals you enter above will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
