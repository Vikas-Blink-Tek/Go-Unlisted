import { useMemo, useState } from 'react';
import type { Order, User } from '../../../types';
import { formatCurrency } from '../../../utils/format';
import { getOrderStatusLabel, getOrderStatusClass, isPendingOrder } from '../../../utils/orderStatus';
import OrderDetailDrawer from './OrderDetailDrawer';

type Props = {
  orders: Order[];
  users: User[];
  showActions?: boolean;
  onVerify?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  limit?: number;
};

export default function AdminOrdersSection({ orders, users, showActions, onVerify, onReject, limit }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter === 'pending' && !isPendingOrder(o.status)) return false;
      if (statusFilter === 'confirmed' && !o.status.toLowerCase().includes('confirm')) return false;
      if (statusFilter === 'rejected' && !/reject|cancel|refund/i.test(o.status)) return false;
      if (dateFrom && o.date && new Date(o.date) < new Date(dateFrom)) return false;
      if (dateTo && o.date && new Date(o.date) > new Date(`${dateTo}T23:59:59`)) return false;
      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q)
        || (o.buyerName || '').toLowerCase().includes(q)
        || (o.buyerEmail || '').toLowerCase().includes(q)
        || (o.buyerPhone || '').includes(q)
        || (o.transactionId || '').toLowerCase().includes(q)
        || (o.companyName || o.shareName || '').toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const display = limit ? filtered.slice(0, limit) : filtered;

  const handleVerify = (id: string) => {
    if (confirm('Verify payment and confirm this order?')) {
      onVerify?.(id);
      setSelected(null);
    }
  };

  const handleReject = (id: string) => {
    if (confirm('Reject this payment?')) {
      onReject?.(id);
      setSelected(null);
    }
  };

  return (
    <>
      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          className="report-filter-input stock-list-search"
          placeholder="Search UTR, name, email, order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="report-filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending verification</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected / cancelled</option>
        </select>
        <input type="date" className="report-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="report-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {!display.length ? (
        <div className="price-table-wrap">
          <div className="admin-table-empty">
            <strong>No orders found</strong>
            Adjust search or filters, or check back when new payments arrive.
          </div>
        </div>
      ) : (
        <div className="price-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Buyer</th>
                <th>Share</th>
                <th>Amount</th>
                <th>UTR</th>
                <th>Status</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {display.map((o) => (
                <tr key={o.orderId} className="admin-order-row" onClick={() => setSelected(o)}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td>
                  <td>
                    <div>{o.buyerName || 'Guest'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.buyerPhone || o.buyerEmail || '—'}</div>
                  </td>
                  <td>{o.companyName || o.shareName}</td>
                  <td>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                  <td style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{o.transactionId || '—'}</td>
                  <td><span className={`status-badge ${getOrderStatusClass(o.status)}`}>{getOrderStatusLabel(o.status)}</span></td>
                  {showActions && (
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleVerify(o.orderId)}>Verify</button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleReject(o.orderId)}>Reject</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderDetailDrawer
        order={selected}
        users={users}
        onClose={() => setSelected(null)}
        onVerify={showActions ? handleVerify : undefined}
        onReject={showActions ? handleReject : undefined}
      />
    </>
  );
}
