import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrders, updateOrderStatus } from '../../../api/orders';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency, formatDateTime, getOrderDate } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import { getAdminOrderStatusLabel, getOrderStatusClass } from '../../../utils/orderStatus';
import AdminSectionHeader from '../components/AdminSectionHeader';

export default function AdminCancelRefundPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: orders = [] } = useQuery({ queryKey: ['admin-orders'], queryFn: getOrders });

  const settlement = orders.filter((o) => {
    const s = o.status.toLowerCase();
    if (/cancel|reject|refund|complete/.test(s)) return false;
    return s.includes('confirm') || s.includes('transfer');
  });

  const mutate = useMutation({
    mutationFn: ({ id, status, opsNote }: { id: string; status: string; opsNote?: string }) =>
      updateOrderStatus(id, status, opsNote),
    onSuccess: () => {
      showToast('Status updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const markCompleted = (id: string) => {
    const note = window.prompt('Transfer completed — optional ops note (e.g. NSDL ref):') ?? '';
    if (note === null) return;
    mutate.mutate({ id, status: 'Completed', opsNote: note.trim() || undefined });
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Settlement & Refunds"
        subtitle="Mark complete after share transfer. Cancel or refund if a deal falls through."
      />
      <div className="price-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date / Time</th>
              <th>User Code</th>
              <th>Buyer</th>
              <th>Share</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!settlement.length && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>No orders awaiting settlement</td></tr>
            )}
            {settlement.map((o) => {
              const s = o.status.toLowerCase();
              const isConfirmed = s.includes('confirm') && !s.includes('transfer');
              const isTransferring = s.includes('transfer');
              return (
                <tr key={o.orderId}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{formatDateTime(getOrderDate(o))}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>{displayUserCode(o.employeeCode)}</td>
                  <td>
                    <div>{o.buyerName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.buyerPhone || o.buyerEmail}</div>
                  </td>
                  <td>{o.companyName || o.shareName}</td>
                  <td>{formatCurrency(o.totalPaid || 0)}</td>
                  <td>
                    <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                      {getAdminOrderStatusLabel(o.status)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(isConfirmed || isTransferring) && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => markCompleted(o.orderId)}>
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => confirm('Cancel this order?') && mutate.mutate({ id: o.orderId, status: 'Cancelled' })}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => confirm('Mark as refunded?') && mutate.mutate({ id: o.orderId, status: 'Refunded' })}
                    >
                      Refund
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
