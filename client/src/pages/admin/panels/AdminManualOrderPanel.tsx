import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { saveOrder, getOrders, softDeleteOrder, restoreOrder } from '../../../api/orders';
import { getUsers, mapApiUser } from '../../../api/admin';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { calcOrderTotal, formatCurrency, formatIndianPhoneDisplay, formatPersonName } from '../../../utils/format';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { getAdminOrderStatusLabel, getOrderStatusClass } from '../../../utils/orderStatus';
import AdminSectionHeader from '../components/AdminSectionHeader';
import AutofillBlocker from '../../../components/forms/AutofillBlocker';
import { blockTelInput, blockTextInput } from '../../../utils/autofill';
import type { Order, User } from '../../../types';

const empty = {
  userId: '',
  orderId: '',
  name: '',
  phone: '',
  email: '',
  shareId: '',
  qty: '',
  price: '',
  method: 'NEFT',
  utr: '',
  source: 'Offline',
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export default function AdminManualOrderPanel() {
  const { showToast } = useToast();
  const { shares } = useShares();
  const { settings } = useSiteSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await getUsers()).map(mapApiUser),
  });
  const signupUsers = usersQuery.data || [];

  const filteredUsers = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const qDigits = clientSearch.replace(/\D/g, '');
    const list = [...signupUsers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q && !qDigits) return list;
    return list.filter((u) => {
      const hay = `${u.name} ${u.phone} ${u.email} ${u.referralCode || ''}`.toLowerCase();
      if (q && hay.includes(q)) return true;
      if (qDigits.length >= 3 && normalizePhone(u.phone).includes(qDigits)) return true;
      return false;
    });
  }, [signupUsers, clientSearch]);

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
  const allManual = (ordersQuery.data || []).filter((o) => o.orderSource === 'Offline' || o.method === 'Offline');
  const manualOrders = allManual.filter((o) => !o.deletedAt);
  const deletedManual = allManual.filter((o) => Boolean(o.deletedAt));

  const saveMut = useMutation({
    mutationFn: saveOrder,
    onSuccess: (res) => {
      showToast(editId ? 'Order updated' : `Order ${res.orderId || ''} created — visible in client portfolio`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setForm(empty);
      setEditId(null);
      setClientSearch('');
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: softDeleteOrder,
    onSuccess: () => {
      showToast('Order deleted — Undo below if needed', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (editId) {
        setEditId(null);
        setForm(empty);
      }
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const restoreMut = useMutation({
    mutationFn: restoreOrder,
    onSuccess: () => {
      showToast('Order restored', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const selectUser = (user: User | null) => {
    if (!user) {
      setForm({ ...form, userId: '', name: '', phone: '', email: '' });
      return;
    }
    setForm({
      ...form,
      userId: user.id,
      name: user.name,
      phone: normalizePhone(user.phone),
      email: user.email || '',
    });
    setClientSearch('');
  };

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
      ...(form.userId ? { userId: form.userId } : {}),
      shareId: share.id,
      shareName: share.name,
      shareTicker: share.ticker,
      buyerName: form.name.trim(),
      buyerPhone: form.phone,
      buyerEmail: form.email.trim(),
      pricePerShare: price,
      qty,
      method: form.method,
      transactionId: utrClean || undefined,
      status: 'Transfer Pending',
      orderSource: form.source,
      _fullUpdate: !!editId,
    });
  };

  const loadEdit = (o: Order) => {
    setEditId(o.orderId);
    const linked = o.userId && !o.userId.startsWith('admin:')
      ? signupUsers.find((u) => u.id === o.userId)
      : undefined;
    setForm({
      userId: linked?.id || (o.userId && !o.userId.startsWith('admin:') ? o.userId : ''),
      orderId: o.orderId,
      name: o.buyerName,
      phone: normalizePhone(o.buyerPhone || ''),
      email: o.buyerEmail || linked?.email || '',
      shareId: o.shareId,
      qty: String(o.qty),
      price: String(o.pricePerShare),
      method: o.method || 'Offline',
      utr: o.transactionId || o.utr || '',
      source: o.orderSource || 'Offline',
    });
    setClientSearch('');
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Manual Order Entry"
        subtitle="Record phone / WhatsApp deals. Status starts at Share Transfer — linked clients see it in Portfolio immediately."
      />

      <div className="report-filter-box">
        <div className="report-filter-title">{editId ? `Edit order ${editId}` : 'New order'}</div>
        <form onSubmit={handleSubmit} autoComplete="off" style={{ position: 'relative' }}>
          <AutofillBlocker />
          <div className="report-filter-grid">
            <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
              <label className="report-filter-label">Select signup user</label>
              <select
                className="report-filter-input"
                value={form.userId}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) {
                    selectUser(null);
                    return;
                  }
                  const user = signupUsers.find((u) => u.id === id) || null;
                  selectUser(user);
                }}
              >
                <option value="">— Type below to search, or choose a registered client —</option>
                {filteredUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {formatPersonName(u.name)} · {formatIndianPhoneDisplay(u.phone)}
                    {u.referralCode ? ` · ${u.referralCode}` : ''}
                  </option>
                ))}
              </select>
              <input
                className="report-filter-input"
                style={{ marginTop: '0.45rem' }}
                placeholder="Search signup users by name or mobile…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                {...blockTextInput({ name: 'manual-order-user-search' })}
              />
              {usersQuery.isLoading && (
                <p className="article-field-hint" style={{ marginTop: '0.35rem' }}>Loading signup users…</p>
              )}
              {!usersQuery.isLoading && signupUsers.length === 0 && (
                <p className="article-field-hint" style={{ marginTop: '0.35rem' }}>
                  No signup users yet. You can still type name &amp; mobile manually below.
                </p>
              )}
              {form.userId && (
                <p className="article-field-hint" style={{ marginTop: '0.35rem' }}>
                  Linked to signup account — order appears in their Portfolio right away (Share Transfer).
                </p>
              )}
              {!form.userId && (
                <p className="article-field-hint" style={{ marginTop: '0.35rem' }}>
                  Tip: select a signup user (or matching mobile) so the order shows in their Portfolio.
                </p>
              )}
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Client Name *</label>
              <input
                className="report-filter-input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, userId: form.userId })}
                {...blockTextInput({ name: 'manual-order-name' })}
              />
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Mobile *</label>
              <input
                className="report-filter-input"
                required
                maxLength={10}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                {...blockTelInput({ name: 'manual-order-phone' })}
              />
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
              <label className="report-filter-label">Bank UTR / Reference (optional)</label>
              <input
                className="report-filter-input"
                placeholder="Only if you have bank UTR — not buyer UPI ID"
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
            {editId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditId(null);
                  setForm(empty);
                  setClientSearch('');
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <AdminSectionHeader compact title="Recent Manual Orders" badge={`${manualOrders.length} orders`} />
      <div className="price-table-wrap">
        <table className="data-table">
          <thead><tr><th>Order ID</th><th>Client</th><th>Share</th><th>Qty</th><th>Total</th><th>Payment Ref</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {manualOrders.slice(0, 20).map((o) => (
              <tr key={o.orderId}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                <td>
                  <div>{formatPersonName(o.buyerName)}</div>
                  {o.buyerPhone && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{formatIndianPhoneDisplay(o.buyerPhone)}</div>
                  )}
                </td>
                <td>{o.companyName || o.shareName}</td>
                <td>{o.qty}</td>
                <td>{formatCurrency(o.totalPaid || 0)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{o.transactionId || o.utr || '—'}</td>
                <td>
                  <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                    {getAdminOrderStatusLabel(o.status)}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadEdit(o)}>Edit</button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => {
                        if (confirm(`Delete ${o.orderId}? You can Undo from Recently deleted.`)) {
                          deleteMut.mutate(o.orderId);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
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

      {deletedManual.length > 0 && (
        <>
          <AdminSectionHeader
            compact
            title="Recently deleted"
            subtitle="Soft-deleted only — click Undo to restore"
            badge={`${deletedManual.length}`}
          />
          <div className="price-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Client</th>
                  <th>Share</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deletedManual.slice(0, 20).map((o) => (
                  <tr key={o.orderId} style={{ opacity: 0.75 }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                    <td>{formatPersonName(o.buyerName)}</td>
                    <td>{o.companyName || o.shareName}</td>
                    <td>{formatCurrency(o.totalPaid || 0)}</td>
                    <td>
                      <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                        {getAdminOrderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => restoreMut.mutate(o.orderId)}
                      >
                        Undo delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
