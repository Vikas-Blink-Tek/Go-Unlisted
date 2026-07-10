import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getOrders, updateOrderStatus } from '../../../api/orders';
import { getUsers, mapApiUser } from '../../../api/admin';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency, formatDateTime, formatIndianPhoneDisplay, formatPersonName, getOrderDate } from '../../../utils/format';
import { getAdminOrderStatusLabel, getOrderStatusClass, isPendingOrder } from '../../../utils/orderStatus';
import { displayUserCode } from '../../../utils/userCode';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import AdminSectionHeader from '../components/AdminSectionHeader';
import OrderDetailDrawer from '../components/OrderDetailDrawer';
import CopyTextButton from '../../../components/ui/CopyTextButton';
import type { Order } from '../../../types';

function matchesVerifySearch(query: string, order: Order): boolean {
  return matchesAdminSearch(
    query,
    order.orderId,
    order.buyerName,
    order.buyerEmail,
    order.buyerPhone,
    order.transactionId,
    order.utr,
    order.companyName,
    order.shareName,
    order.employeeCode,
  );
}

export default function AdminVerifyPaymentsPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: getOrders,
  });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await getUsers()).map(mapApiUser) });

  const orders = ordersQuery.data || [];
  const users = usersQuery.data || [];
  const pendingOrders = orders.filter((o) => isPendingOrder(o.status));

  const searching = search.trim().length > 0;
  const filtered = useMemo(() => {
    if (!searching) return pendingOrders;
    return orders.filter((o) => matchesVerifySearch(search, o));
  }, [orders, pendingOrders, searching, search]);

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
        subtitle="Search UTR from bank SMS, mobile, or name — then Verify or Reject"
        badge={`${pendingOrders.length} pending`}
      />

      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search UTR, mobile, name, email, order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search payments by UTR, mobile, name or order ID"
          autoFocus
        />
        {search.trim() && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
        {searching && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center' }}>
            Searching all orders
          </span>
        )}
      </div>

      {!searching && (
        <p className="verify-payments-hint" style={{ margin: '0 0 1rem' }}>
          Showing your pending payments (your referral code only). Search UTR / mobile to find your orders, then Verify or Reject.
        </p>
      )}

      {ordersQuery.isLoading && <p style={{ color: 'var(--muted)' }}>Loading orders…</p>}

      {ordersQuery.isError && (
        <div className="admin-table-empty" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <strong>Could not load orders</strong>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {(ordersQuery.error as Error)?.message || 'Session may have expired.'} Try signing out and back in, or refresh the page.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: '0.75rem' }}
            onClick={() => ordersQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {!ordersQuery.isLoading && !ordersQuery.isError && !filtered.length && (
        <div className="admin-table-empty">
          <strong>{searching ? 'No orders match your search' : 'No pending payments'}</strong>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {searching
              ? 'Try UTR, 10-digit mobile (with or without 91), name, or order ID. Only your referral orders appear here.'
              : 'Buyers who signed up with your code and submitted UTR appear here.'}
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <code className="admin-utr-code">{o.transactionId || o.utr || '—'}</code>
                      <div className="admin-id-cell" style={{ marginTop: 2 }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{o.orderId}</span>
                        <CopyTextButton value={o.orderId} label="Order ID copied" />
                      </div>
                    </td>
                    <td>
                      <div>{formatPersonName(o.buyerName)}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                        {o.buyerPhone ? formatIndianPhoneDisplay(o.buyerPhone) : o.buyerEmail || '—'}
                      </div>
                    </td>
                    <td>{o.companyName || o.shareName}</td>
                    <td>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{formatDateTime(getOrderDate(o))}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayUserCode(o.employeeCode)}</td>
                    <td>
                      <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                        {getAdminOrderStatusLabel(o.status)}
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
