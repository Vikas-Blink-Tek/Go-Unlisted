import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getOrders, updateOrderStatus } from '../../../api/orders';
import { getUsers, mapApiUser } from '../../../api/admin';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { getOrderStatusClass, getOrderStatusLabel, isPendingOrder } from '../../../utils/orderStatus';
import { displayUserCode } from '../../../utils/userCode';
import AdminSectionHeader from '../components/AdminSectionHeader';
import OrderDetailDrawer from '../components/OrderDetailDrawer';
import type { Order } from '../../../types';

function normalizeRef(value?: string): string {
  return (value || '').replace(/\s+/g, '').toUpperCase();
}

function matchesVerifySearch(query: string, order: Order): boolean {
  const q = query.trim();
  if (!q) return true;

  const qNorm = normalizeRef(q);
  const utr = normalizeRef(order.transactionId || order.utr);
  if (qNorm.length >= 4 && utr.includes(qNorm)) return true;

  const ql = q.toLowerCase();
  return [order.orderId, order.buyerName, order.buyerPhone, order.buyerEmail]
    .some((f) => f && f.toLowerCase().includes(ql));
}

export default function AdminVerifyPaymentsPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [utrQuery, setUtrQuery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getOrders });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await getUsers()).map(mapApiUser) });

  const orders = ordersQuery.data || [];
  const users = usersQuery.data || [];
  const pendingOrders = orders.filter((o) => isPendingOrder(o.status));

  const searching = utrQuery.trim().length > 0;
  const filtered = useMemo(() => {
    if (!searching) return pendingOrders;
    return orders.filter((o) => matchesVerifySearch(utrQuery, o));
  }, [orders, pendingOrders, searching, utrQuery]);

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => updateOrderStatus(orderId, status),
    onSuccess: (_, { status }) => {
      showToast(status === 'Confirmed' ? 'Payment verified' : 'Payment rejected', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setSelected(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const verify = (id: string) => {
    if (confirm('Verify this payment against bank credit and confirm the order?')) {
      statusMutation.mutate({ orderId: id, status: 'Confirmed' });
    }
  };

  const reject = (id: string) => {
    if (confirm('Reject this payment? Buyer will need to contact support.')) {
      statusMutation.mutate({ orderId: id, status: 'Rejected' });
    }
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Verify Payments"
        subtitle="Enter UTR from bank SMS → find order → Verify or Reject"
        badge={`${pendingOrders.length} pending`}
      />

      <div className="verify-payments-search">
        <label className="report-filter-label" htmlFor="verify-utr-search">
          UTR / Transaction ID
        </label>
        <div className="verify-payments-search-row">
          <input
            id="verify-utr-search"
            type="search"
            inputMode="text"
            autoComplete="off"
            autoFocus
            className="report-filter-input verify-payments-utr-input"
            placeholder="Paste UTR from bank SMS (e.g. 123456789012)"
            value={utrQuery}
            onChange={(e) => setUtrQuery(e.target.value.toUpperCase())}
          />
          {utrQuery && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUtrQuery('')}>
              Clear
            </button>
          )}
        </div>
        <p className="verify-payments-hint">
          {searching
            ? `Searching all orders for “${utrQuery.trim()}”`
            : 'Showing pending payments. Type a UTR above to look up any order.'}
        </p>
      </div>

      {ordersQuery.isLoading && <p style={{ color: 'var(--muted)' }}>Loading orders…</p>}

      {!ordersQuery.isLoading && !filtered.length && (
        <div className="admin-table-empty">
          <strong>{searching ? 'No order for this UTR' : 'No pending payments'}</strong>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {searching
              ? 'Check the UTR from bank SMS matches what the buyer entered at checkout.'
              : 'New checkouts with UTR appear here. You can still search any UTR above.'}
          </p>
        </div>
      )}

      {!!filtered.length && (
        <div className="price-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>UTR / Txn ID</th>
                <th>Buyer</th>
                <th>Share</th>
                <th>Amount</th>
                <th>Date / Time</th>
                <th>User Code</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const pending = isPendingOrder(o.status);
                return (
                  <tr key={o.orderId} className="admin-order-row" onClick={() => setSelected(o)}>
                    <td>
                      <code className="admin-utr-code">{o.transactionId || o.utr || '—'}</code>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>{o.orderId}</div>
                    </td>
                    <td>
                      <div>{o.buyerName || 'Guest'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.buyerPhone || o.buyerEmail || '—'}</div>
                    </td>
                    <td>{o.companyName || o.shareName}</td>
                    <td>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDateTime(o.date)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayUserCode(o.employeeCode)}</td>
                    <td>
                      <span className={`status-badge ${getOrderStatusClass(o.status)}`}>
                        {getOrderStatusLabel(o.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {pending ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => verify(o.orderId)}>
                            Verify
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#ef4444', marginLeft: 4 }}
                            onClick={() => reject(o.orderId)}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {/reject/i.test(o.status) ? 'Rejected' : /confirm/i.test(o.status) ? 'Verified' : o.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <OrderDetailDrawer
        order={selected}
        users={users}
        onClose={() => setSelected(null)}
        onVerify={selected && isPendingOrder(selected.status) ? verify : undefined}
        onReject={selected && isPendingOrder(selected.status) ? reject : undefined}
      />
    </div>
  );
}
