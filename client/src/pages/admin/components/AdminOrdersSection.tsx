import { useMemo, useState } from 'react';
import type { Order, User } from '../../../types';
import { formatCurrency, formatDateTime, formatIndianPhoneDisplay, formatPersonName, parseDbDateTime, getOrderDate } from '../../../utils/format';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import {
  getAdminOrderStatusLabel,
  getOrderStatusClass,
  isPendingOrder,
  canMarkOrderComplete,
  canUndoOrderComplete,
  canRejectOrder,
} from '../../../utils/orderStatus';
import { DEFAULT_USER_CODE, displayUserCode } from '../../../utils/userCode';
import CopyTextButton from '../../../components/ui/CopyTextButton';
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
  onUndoComplete?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
  onRestore?: (orderId: string) => void;
  onAttachPortfolio?: (orderId: string) => void | Promise<unknown>;
  limit?: number;
  employees?: Array<{ employee_id?: string; employeeCode?: string; name?: string }>;
  onTransferOrder?: (orderId: string, employeeCode: string) => void | Promise<unknown>;
  onSavePaymentRef?: (orderId: string, transactionId: string) => void | Promise<unknown>;
  onAdjustTotal?: (orderId: string, totalAmount: number) => void | Promise<unknown>;
  /** Platform master: show franchise column + filter */
  showFranchiseColumn?: boolean;
  franchiseFilter?: string;
  onFranchiseFilterChange?: (value: string) => void;
  franchiseOptions?: Array<{ id: string; name: string }>;
};

function isSoftDeleted(o: Order) {
  return Boolean(o.deletedAt);
}

export default function AdminOrdersSection({
  orders,
  users,
  showActions,
  verifyMode,
  onVerify,
  onReject,
  onComplete,
  onUndoComplete,
  onDelete,
  onRestore,
  onAttachPortfolio,
  limit,
  employees,
  onTransferOrder,
  onSavePaymentRef,
  onAdjustTotal,
  showFranchiseColumn,
  franchiseFilter,
  onFranchiseFilterChange,
  franchiseOptions = [],
}: Props) {
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

  const activeOrders = useMemo(() => orders.filter((o) => !isSoftDeleted(o)), [orders]);
  const deletedOrders = useMemo(() => orders.filter((o) => isSoftDeleted(o)), [orders]);

  const filtered = useMemo(() => {
    const utrSearch = verifyMode && search.trim().length > 0;
    const activeStatusFilter = utrSearch ? 'all' : statusFilter;

    return activeOrders.filter((o) => {
      if (codeFilter !== 'all' && displayUserCode(o.employeeCode) !== codeFilter) return false;
      if (activeStatusFilter === 'pending' && !isPendingOrder(o.status)) return false;
      if (activeStatusFilter === 'transfer' && !/transfer|confirm|verif/i.test(o.status)) return false;
      if (activeStatusFilter === 'confirmed' && !/confirm|verif|transfer/i.test(o.status)) return false;
      if (activeStatusFilter === 'completed' && !o.status.toLowerCase().includes('complete')) return false;
      if (activeStatusFilter === 'rejected' && !/reject|cancel|refund/i.test(o.status)) return false;
      if (dateFrom && getOrderDate(o)) {
        const t = parseDbDateTime(getOrderDate(o))?.getTime();
        if (t !== undefined && t < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo && getOrderDate(o)) {
        const t = parseDbDateTime(getOrderDate(o))?.getTime();
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
  }, [activeOrders, search, statusFilter, codeFilter, dateFrom, dateTo, verifyMode]);

  const display = limit ? filtered.slice(0, limit) : filtered;
  const showActionCol = showActions || !!onComplete || !!onUndoComplete || !!onDelete || !!onReject;

  const handleVerify = (id: string) => {
    if (confirm('Verify payment? Order moves to Pending Share Transfer.')) {
      onVerify?.(id);
      setSelected(null);
    }
  };

  const handleReject = (id: string) => {
    const order = display.find((o) => o.orderId === id);
    const msg = order && isPendingOrder(order.status)
      ? 'Reject this payment? Buyer will need to contact support.'
      : 'Reject this order? Status will be set to Rejected.';
    if (confirm(msg)) {
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

  const handleUndoComplete = (id: string) => {
    onUndoComplete?.(id);
    setSelected(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this order? You can Undo from Recently deleted below.')) {
      onDelete?.(id);
      setSelected(null);
    }
  };

  const handleRestore = (id: string) => {
    onRestore?.(id);
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
          <option value="transfer">Pending Share Transfer</option>
          <option value="completed">Order Complete</option>
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
        {showFranchiseColumn && onFranchiseFilterChange && (
          <select
            className="report-filter-input"
            value={franchiseFilter || 'all'}
            onChange={(e) => onFranchiseFilterChange(e.target.value)}
          >
            <option value="all">All franchises</option>
            <option value="direct">Direct / Platform</option>
            {franchiseOptions.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
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
        <div className="price-table-wrap admin-orders-table-wrap">
          <table className="data-table admin-orders-table">
            <thead>
              <tr>
                <th className="admin-orders-col-id">Order</th>
                <th className="admin-orders-col-buyer">Buyer</th>
                <th className="admin-orders-col-share">Share</th>
                <th className="admin-orders-col-amount">Amount</th>
                <th className="admin-orders-col-utr">Payment</th>
                <th className="admin-orders-col-status">Status</th>
                {showActionCol && <th className="admin-orders-col-actions"> </th>}
              </tr>
            </thead>
            <tbody>
              {display.map((o) => {
                const shareLabel = o.companyName || o.shareName || '—';
                const paymentRef = (o.transactionId || o.utr || '').trim();
                const primaryAction = showActions && isPendingOrder(o.status)
                  ? { label: 'Verify', run: () => handleVerify(o.orderId) }
                  : onComplete && canMarkOrderComplete(o.status)
                    ? { label: 'Complete', run: () => handleComplete(o.orderId) }
                    : null;

                return (
                  <tr key={o.orderId} className="admin-order-row" onClick={() => setSelected(o)}>
                    <td className="admin-orders-col-id" onClick={(e) => e.stopPropagation()}>
                      <div className="admin-id-cell">
                        <code className="admin-order-id">{o.orderId}</code>
                        <CopyTextButton value={o.orderId} label="Order ID copied" />
                      </div>
                      <div className="admin-orders-col-date">{formatDateTime(getOrderDate(o))}</div>
                      {(showFranchiseColumn || o.employeeCode) && (
                        <div
                          className="admin-orders-id-meta"
                          title={showFranchiseColumn ? (o.franchiseName || 'Direct / Platform') : undefined}
                        >
                          {displayUserCode(o.employeeCode)}
                          {showFranchiseColumn ? ` · ${o.franchiseName || 'Direct'}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="admin-orders-col-buyer">
                      <div className="admin-orders-buyer-name">{formatPersonName(o.buyerName)}</div>
                      <div className="admin-orders-buyer-meta">
                        {o.buyerPhone ? formatIndianPhoneDisplay(o.buyerPhone) : o.buyerEmail || '—'}
                      </div>
                    </td>
                    <td className="admin-orders-col-share">
                      <div className="admin-orders-share-name" title={shareLabel}>{shareLabel}</div>
                      <div className="admin-orders-col-deal">
                        <span className="admin-orders-deal-qty">{o.qty}</span>
                        <span className="admin-orders-deal-sep">×</span>
                        <span className="admin-orders-deal-price">{formatCurrency(o.pricePerShare || 0)}</span>
                      </div>
                    </td>
                    <td className="admin-orders-col-amount">{formatCurrency(o.totalPaid || o.total || 0)}</td>
                    <td className="admin-orders-col-utr">
                      {paymentRef ? (
                        <code className="admin-utr-code" title={paymentRef}>{paymentRef}</code>
                      ) : (
                        <span className="admin-orders-empty-ref">—</span>
                      )}
                    </td>
                    <td className="admin-orders-col-status">
                      <span className={`status-badge status-badge--admin ${getOrderStatusClass(o.status)}`}>
                        {getAdminOrderStatusLabel(o.status)}
                      </span>
                    </td>
                    {showActionCol && (
                      <td className="admin-orders-col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-orders-actions">
                          {primaryAction && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={primaryAction.run}>
                              {primaryAction.label}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm admin-orders-open-btn"
                            onClick={() => setSelected(o)}
                          >
                            Open
                          </button>
                          {showActions && onReject && canRejectOrder(o.status) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm admin-orders-danger-btn"
                              onClick={() => handleReject(o.orderId)}
                            >
                              Reject
                            </button>
                          )}
                          {onUndoComplete && canUndoOrderComplete(o.status) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleUndoComplete(o.orderId)}
                            >
                              Undo
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm admin-orders-danger-btn"
                              onClick={() => handleDelete(o.orderId)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!verifyMode && onRestore && deletedOrders.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
            Recently deleted ({deletedOrders.length}) — Undo anytime
          </h4>
          <div className="price-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Buyer</th>
                  <th>Share</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {deletedOrders.slice(0, 30).map((o) => (
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
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRestore(o.orderId)}>
                        Undo delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetailDrawer
        order={selected}
        users={users}
        onClose={() => setSelected(null)}
        onVerify={showActions ? handleVerify : undefined}
        onReject={onReject ? handleReject : undefined}
        onComplete={onComplete ? handleComplete : undefined}
        onUndoComplete={onUndoComplete ? handleUndoComplete : undefined}
        onDelete={onDelete ? handleDelete : undefined}
        onAttachPortfolio={onAttachPortfolio}
        employees={employees}
        onTransfer={onTransferOrder}
        onSavePaymentRef={onSavePaymentRef}
        onAdjustTotal={onAdjustTotal}
      />
    </>
  );
}
