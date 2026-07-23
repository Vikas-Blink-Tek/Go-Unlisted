import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getOrders, updateOrderStatus, transferOrder, updateOrderPaymentRef, adjustOrderTotal } from '../../../api/orders';
import { getEmployees, getUsers, mapApiUser } from '../../../api/admin';
import { useToast } from '../../../context/ToastContext';
import { useAdminPanel } from '../../../context/AdminPanelContext';
import { formatCurrency, formatDateTime, formatIndianPhoneDisplay, formatPersonName, getOrderDate } from '../../../utils/format';
import { getAdminOrderStatusLabel, getOrderStatusClass, isPendingOrder, ORDER_STATUS } from '../../../utils/orderStatus';
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

  const { isMaster, can } = useAdminPanel();

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: getOrders,
  });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await getUsers()).map(mapApiUser) });
  const employeesQuery = useQuery({
    queryKey: ['admin-employees'],
    queryFn: getEmployees,
    enabled: isMaster && can('view-all-orders'),
  });

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
      showToast(
        status === ORDER_STATUS.TRANSFER_PENDING
          ? 'Payment verified — pending share transfer'
          : 'Payment rejected',
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setSelected(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: ({ orderId, employeeCode }: { orderId: string; employeeCode: string }) => transferOrder(orderId, employeeCode),
    onSuccess: () => {
      showToast('Order assigned to employee', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const paymentRefMutation = useMutation({
    mutationFn: ({ orderId, transactionId, status }: { orderId: string; transactionId: string; status: string }) =>
      updateOrderPaymentRef(orderId, transactionId, status),
    onSuccess: (_data, vars) => {
      showToast('Payment reference saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelected((prev) => (prev && prev.orderId === vars.orderId
        ? { ...prev, transactionId: vars.transactionId, utr: vars.transactionId }
        : prev));
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const verify = (id: string) => {
    if (confirm('Verify this payment against bank credit? Order will move to Pending Share Transfer.')) {
      statusMutation.mutate({ orderId: id, status: ORDER_STATUS.TRANSFER_PENDING });
    }
  };

  const reject = (id: string) => {
    if (confirm('Reject this payment? Buyer will need to contact support.')) {
      statusMutation.mutate({ orderId: id, status: ORDER_STATUS.REJECTED });
    }
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Verify Payments"
        subtitle="Match UTR / bank credit → Verify. After approval, shares appear in the buyer’s portfolio as confirmed."
        badge={`${pendingOrders.length} pending`}
      />

      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search mobile, name, email, order ID, UTR..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search payments by mobile, name or order ID"
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
          Online checkout orders with UTR appear here. Verify against bank credit, then Approve — buyer portfolio updates after that.
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
              ? 'Try 10-digit mobile, name, order ID, or payment reference. Only your referral orders appear here.'
              : 'Manual deals awaiting bank match appear here. Online orders go straight to Share Transfer.'}
          </p>
        </div>
      )}

      {!!filtered.length && (
        <div className="price-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment Ref</th>
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
                          {/reject/i.test(o.status)
                            ? 'Rejected'
                            : /transfer/i.test(o.status)
                              ? 'Share Transfer'
                              : /confirm|verif/i.test(o.status)
                                ? 'Verified'
                                : o.status}
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
        employees={employeesQuery.data || []}
        onTransfer={
          isMaster && selected && isPendingOrder(selected.status)
            ? (orderId, employeeCode) => transferMutation.mutateAsync({ orderId, employeeCode })
            : undefined
        }
        onSavePaymentRef={(orderId, transactionId) => {
          const status = selected?.status || ORDER_STATUS.PENDING_VERIFICATION;
          return paymentRefMutation.mutateAsync({ orderId, transactionId, status });
        }}
        onAdjustTotal={isMaster ? (orderId, totalAmount) => {
          return adjustOrderTotal(orderId, totalAmount).then(() => {
            showToast('Order amount updated', 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
            setSelected((prev) => (prev && prev.orderId === orderId ? { ...prev, totalPaid: totalAmount, total: totalAmount } : prev));
          });
        } : undefined}
      />
    </div>
  );
}
