import { useMemo, useState } from 'react';
import type { Order, User } from '../../../types';
import { formatCurrency, formatDateTime, parseDbDateTime } from '../../../utils/format';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import { getOrderStatusLabel, getOrderStatusClass, isPendingOrder, canMarkOrderComplete } from '../../../utils/orderStatus';
import { DEFAULT_USER_CODE, displayUserCode } from '../../../utils/userCode';
import OrderDetailDrawer from './OrderDetailDrawer';

type Props = {
  orders: Order[];
  users: User[];
  showActions?: boolean;
  /** Verify Payments: default pending queue; UTR search scans all orders */
  verifyMode?: boolean;
  onVerify?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
  limit?: number;
};

export default function AdminOrdersSection({ orders, users, showActions, verifyMode, onVerify, onReject, onComplete, limit }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(verifyMode ? 'pending' : 'all');
  const [codeFilter, setCodeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const employeeCodes = useMemo(() => {
    const codes = new Set<string>([DEFAULT_USER_CODE]);
    orders.forEach((o) => {
      const c = displayUserCode(o.employeeCode);
      if (c) codes.add(c);
    });
    return Array.from(codes).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const utrSearch = verifyMode && search.trim().length > 0;
    const activeStatusFilter = utrSearch ? 'all' : statusFilter;

    return orders.filter((o) => {
      if (codeFilter !== 'all' && displayUserCode(o.employeeCode) !== codeFilter) return false;
      if (activeStatusFilter === 'pending' && !isPendingOrder(o.status)) return false;
      if (activeStatusFilter === 'confirmed' && !o.status.toLowerCase().includes('confirm')) return false;
      if (activeStatusFilter === 'completed' && !o.status.toLowerCase().includes('complete')) return false;
      if (activeStatusFilter === 'rejected' && !/reject|cancel|refund/i.test(o.status)) return false;
      if (dateFrom && o.date) {
        const t = parseDbDateTime(o.date)?.getTime();
        if (t !== undefined && t < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo && o.date) {
        const t = parseDbDateTime(o.date)?.getTime();
        if (t !== undefined && t > new Date(`${dateTo}T23:59:59+05:30`).getTime()) return false;
      }
      return matchesAdminSearch(
        search,
        o.orderId,
        o.buyerName,
        o.buyerEmail,
        o.buyerPhone,
        o.transactionId,
        o.utr,
        o.companyName,
        o.shareName,
        o.employeeCode,
      );
    });
  }, [orders, search, statusFilter, codeFilter, dateFrom, dateTo, verifyMode]);

  const display = limit ? filtered.slice(0, limit) : filtered;
  const showActionCol = showActions || !!onComplete;
  const canUpdateStatus = (o: Order) =>
    (showActions && isPendingOrder(o.status)) || (!!onComplete && canMarkOrderComplete(o.status));

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

  const handleComplete = (id: string) => {
    if (confirm('Mark order complete? Share transfer is done and credited to buyer demat.')) {
      onComplete?.(id);
      setSelected(null);
    }
  };

  return (
    <>
      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder={verifyMode ? 'Enter UTR / txn ID, mobile, name, or order ID...' : 'Search mobile, UTR, name, email, order ID...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={verifyMode ? 'Search orders by UTR' : 'Search orders by mobile, UTR, name or email'}
        />
        {verifyMode && search.trim() && (
          <span className="admin-search-hint" style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center' }}>
            Searching all orders
          </span>
        )}
        <select className="report-filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending verification</option>
          <option value="confirmed">Payment verified</option>
          <option value="completed">Complete</option>
          <option value="rejected">Rejected / cancelled</option>
        </select>
        {employeeCodes.length > 0 && (
          <select className="report-filter-input" value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)}>
            <option value="all">All user codes</option>
            {employeeCodes.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        )}
        <input type="date" className="report-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" className="report-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {!display.length ? (
        <div className="price-table-wrap">
          <div className="admin-table-empty">
            <strong>No orders found</strong>
            {verifyMode && search.trim()
              ? 'No order matches this UTR or search. Check the reference from bank SMS.'
              : verifyMode
                ? 'No payments pending verification. Enter a UTR above to look up any order.'
                : 'Adjust search or filters, or check back when new payments arrive.'}
          </div>
        </div>
      ) : (
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
                <th>UTR / Txn ID</th>
                <th>Status</th>
                {showActionCol && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {display.map((o) => (
                <tr key={o.orderId} className="admin-order-row" onClick={() => setSelected(o)}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</td>
                  <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>
                    {formatDateTime(o.date)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600 }}>
                    {displayUserCode(o.employeeCode)}
                  </td>
                  <td>
                    <div>{o.buyerName || 'Guest'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.buyerPhone || o.buyerEmail || '—'}</div>
                  </td>
                  <td>{o.companyName || o.shareName}</td>
                  <td>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                  <td>
                    <code className="admin-utr-code" title="Payment reference from buyer">
                      {o.transactionId || o.utr || '—'}
                    </code>
                  </td>
                  <td><span className={`status-badge ${getOrderStatusClass(o.status)}`}>{getOrderStatusLabel(o.status)}</span></td>
                  {showActionCol && (
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {showActions && isPendingOrder(o.status) && (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleVerify(o.orderId)}>Verify</button>
                          <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => handleReject(o.orderId)}>Reject</button>
                        </>
                      )}
                      {onComplete && canMarkOrderComplete(o.status) && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleComplete(o.orderId)}>
                          Complete
                        </button>
                      )}
                      {verifyMode && !canUpdateStatus(o) && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>—</span>
                      )}
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
        onComplete={onComplete ? handleComplete : undefined}
      />
    </>
  );
}
