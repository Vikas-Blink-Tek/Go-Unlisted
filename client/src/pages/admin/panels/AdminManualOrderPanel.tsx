import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { saveOrder, getAdminOrders, softDeleteOrder, restoreOrder } from '../../../api/orders';
import { getUsers, mapApiUser } from '../../../api/admin';
import { useShares } from '../../../hooks/useShares';
import { useToast } from '../../../context/ToastContext';
import { useAdminPanel } from '../../../context/AdminPanelContext';
import { calcOrderTotal, formatCurrency, formatDateTime, formatIndianPhoneDisplay, formatPersonName, getOrderDate } from '../../../utils/format';
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
  orderDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function filterSignupUsers(users: User[], query: string) {
  const q = query.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, '');
  const list = [...users].sort((a, b) => a.name.localeCompare(b.name));
  if (!q && !qDigits) return list.slice(0, 12);
  return list
    .filter((u) => {
      const hay = `${u.name} ${u.phone} ${u.email} ${u.referralCode || ''}`.toLowerCase();
      if (q && hay.includes(q)) return true;
      if (qDigits.length >= 2 && normalizePhone(u.phone).includes(qDigits)) return true;
      return false;
    })
    .slice(0, 12);
}

export default function AdminManualOrderPanel() {
  const { showToast } = useToast();
  const { isMaster } = useAdminPanel();
  const { shares } = useShares();
  const { settings } = useSiteSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [suggestFrom, setSuggestFrom] = useState<'name' | 'phone' | null>(null);
  const suggestWrapRef = useRef<HTMLDivElement>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await getUsers()).map(mapApiUser),
  });
  const signupUsers = usersQuery.data || [];

  const suggestQuery = suggestFrom === 'phone' ? form.phone : form.name;
  const clientSuggestions = useMemo(
    () => (suggestFrom ? filterSignupUsers(signupUsers, suggestQuery) : []),
    [signupUsers, suggestFrom, suggestQuery],
  );

  useEffect(() => {
    if (!suggestFrom) return;
    const onDoc = (e: MouseEvent) => {
      if (!suggestWrapRef.current?.contains(e.target as Node)) {
        setSuggestFrom(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [suggestFrom]);

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

  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getAdminOrders });
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
      setSuggestFrom(null);
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

  const selectUser = (user: User) => {
    setForm((prev) => ({
      ...prev,
      userId: user.id,
      name: formatPersonName(user.name) || user.name,
      phone: normalizePhone(user.phone),
      email: user.email || '',
    }));
    setSuggestFrom(null);
  };

  const clearLinkedUserIfChanged = (next: Partial<typeof empty>) => {
    setForm((prev) => {
      const merged = { ...prev, ...next };
      if (!merged.userId) return merged;
      const linked = signupUsers.find((u) => u.id === merged.userId);
      if (!linked) return { ...merged, userId: '' };
      const nameSame =
        merged.name.trim().toLowerCase() === linked.name.trim().toLowerCase()
        || merged.name.trim().toLowerCase() === formatPersonName(linked.name).toLowerCase();
      const phoneSame = normalizePhone(merged.phone) === normalizePhone(linked.phone);
      if (nameSame && phoneSame) return merged;
      return { ...merged, userId: '' };
    });
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
    if (!form.orderDate) {
      showToast('Select order date', 'error');
      return;
    }
    // Auto-link by exact mobile if admin typed without picking a suggestion
    let userId = form.userId;
    if (!userId) {
      const byPhone = signupUsers.find((u) => normalizePhone(u.phone) === form.phone);
      if (byPhone) userId = byPhone.id;
    }
    if (!userId) {
      const nameQ = form.name.trim().toLowerCase();
      const byName = signupUsers.filter((u) => u.name.trim().toLowerCase() === nameQ);
      if (byName.length === 1) userId = byName[0].id;
    }
    if (!userId) {
      showToast('Pick the client from name/mobile suggestions so it shows in their Portfolio', 'error');
      return;
    }
    saveMut.mutate({
      ...(editId ? { orderId: editId } : {}),
      ...(userId ? { userId } : {}),
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
      orderDate: form.orderDate,
      _fullUpdate: !!editId,
    });
  };

  const loadEdit = (o: Order) => {
    setEditId(o.orderId);
    const linked = o.userId && !o.userId.startsWith('admin:')
      ? signupUsers.find((u) => u.id === o.userId)
      : undefined;
    const rawDate = getOrderDate(o) || o.createdAt || o.date || '';
    const orderDate = rawDate
      ? String(rawDate).slice(0, 10)
      : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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
      orderDate,
    });
    setSuggestFrom(null);
  };

  const renderClientSuggestions = () => {
    if (!suggestFrom || !clientSuggestions.length) {
      if (suggestFrom && suggestQuery.trim().length >= 1 && !usersQuery.isLoading) {
        return (
          <div className="manual-client-suggest" role="listbox">
            <div className="manual-client-suggest__empty">No signup match — type details manually</div>
          </div>
        );
      }
      return null;
    }
    return (
      <div className="manual-client-suggest" role="listbox">
        {clientSuggestions.map((u) => (
          <button
            key={u.id}
            type="button"
            className="manual-client-suggest__item"
            role="option"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectUser(u)}
          >
            <span className="manual-client-suggest__name">{formatPersonName(u.name)}</span>
            <span className="manual-client-suggest__meta">
              {formatIndianPhoneDisplay(u.phone)}
              {u.referralCode ? ` · ${u.referralCode}` : ''}
            </span>
          </button>
        ))}
      </div>
    );
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
          <div className="report-filter-grid" ref={suggestWrapRef}>
            <div className="report-filter-group" style={{ position: 'relative' }}>
              <label className="report-filter-label">Client Name *</label>
              <input
                className="report-filter-input"
                required
                value={form.name}
                placeholder="Type name — signup clients appear"
                onChange={(e) => {
                  clearLinkedUserIfChanged({ name: e.target.value });
                  setSuggestFrom('name');
                }}
                {...blockTextInput({
                  name: 'manual-order-name',
                  onFocus: (e: FocusEvent<HTMLInputElement>) => {
                    e.currentTarget.readOnly = false;
                    setSuggestFrom('name');
                  },
                })}
              />
              {suggestFrom === 'name' && renderClientSuggestions()}
            </div>
            <div className="report-filter-group" style={{ position: 'relative' }}>
              <label className="report-filter-label">Mobile *</label>
              <input
                className="report-filter-input"
                required
                maxLength={10}
                value={form.phone}
                placeholder="Type mobile — signup clients appear"
                onChange={(e) => {
                  const phone = e.target.value.replace(/\D/g, '').slice(0, 10);
                  clearLinkedUserIfChanged({ phone });
                  setSuggestFrom('phone');
                  if (phone.length === 10) {
                    const hit = signupUsers.find((u) => normalizePhone(u.phone) === phone);
                    if (hit) selectUser(hit);
                  }
                }}
                {...blockTelInput({
                  name: 'manual-order-phone',
                  onFocus: (e: FocusEvent<HTMLInputElement>) => {
                    e.currentTarget.readOnly = false;
                    setSuggestFrom('phone');
                  },
                })}
              />
              {suggestFrom === 'phone' && renderClientSuggestions()}
            </div>
            <div className="report-filter-group" style={{ gridColumn: '1 / -1' }}>
              {usersQuery.isLoading && (
                <p className="article-field-hint">Loading signup clients…</p>
              )}
              {!usersQuery.isLoading && signupUsers.length === 0 && (
                <p className="article-field-hint">
                  No signup clients yet. You can still type name &amp; mobile manually.
                </p>
              )}
              {form.userId && (
                <p className="article-field-hint">
                  Linked to signup account — order appears in their Portfolio right away (Share Transfer).
                </p>
              )}
              {!form.userId && !usersQuery.isLoading && signupUsers.length > 0 && (
                <p className="article-field-hint">
                  Pick a suggestion (name or mobile) to link the order to their signup. Employee list shows only your signup clients
                  {isMaster ? ' (Master sees all).' : '.'}
                </p>
              )}
            </div>
            <div className="report-filter-group">
              <label className="report-filter-label">Email (optional)</label>
              <input
                className="report-filter-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                {...blockTextInput({ name: 'manual-order-email' })}
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
              <label className="report-filter-label">Order date *</label>
              <input
                className="report-filter-input"
                type="date"
                required
                value={form.orderDate}
                onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
              />
              <p className="article-field-hint" style={{ marginTop: '0.35rem' }}>
                Default is today. Pick yesterday (or any past date) for backdated deals.
              </p>
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
                  setSuggestFrom(null);
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
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Client</th>
              <th>Share</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Payment Ref</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {manualOrders.slice(0, 20).map((o) => (
              <tr key={o.orderId}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {getOrderDate(o) ? formatDateTime(getOrderDate(o)) : '—'}
                </td>
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
                    {isMaster && (
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
                    )}
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

      {isMaster && deletedManual.length > 0 && (
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
