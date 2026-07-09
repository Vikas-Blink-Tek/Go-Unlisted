import type { Order, User } from '../../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import { getOrderStatusLabel, getOrderStatusClass, isPendingOrder, canMarkOrderComplete } from '../../../utils/orderStatus';

type Props = {
  order: Order | null;
  users: User[];
  onClose: () => void;
  onVerify?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
};

export default function OrderDetailDrawer({ order, users, onClose, onVerify, onReject, onComplete }: Props) {
  if (!order) return null;

  const buyer = users.find(
    (u) =>
      (order.buyerEmail && u.email.toLowerCase() === order.buyerEmail.toLowerCase())
      || (order.buyerPhone && u.phone === order.buyerPhone),
  );

  return (
    <div className="admin-drawer-overlay" onClick={onClose} role="presentation">
      <aside className="admin-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Order details">
        <div className="admin-drawer-header">
          <div>
            <h3>Order {order.orderId}</h3>
            <span className={`status-badge ${getOrderStatusClass(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
          </div>
          <button type="button" className="admin-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="admin-drawer-body">
          <section className="admin-drawer-section">
            <h4>Buyer</h4>
            <p><strong>{order.buyerName || 'Guest'}</strong></p>
            <p>{order.buyerEmail || '—'}</p>
            <p>{order.buyerPhone || '—'}</p>
            {buyer && (
              <p className="admin-drawer-kyc">
                KYC: <span className={`status-badge ${buyer.kycStatus === 'Verified' ? 'status-confirmed' : 'status-pending'}`}>{buyer.kycStatus}</span>
                {buyer.kycPan && <span> · PAN {buyer.kycPan}</span>}
                {buyer.kycDemat && <span> · Demat ****{buyer.kycDemat.slice(-4)}</span>}
              </p>
            )}
            {!buyer && order.buyerEmail && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>No registered account linked to this email/phone.</p>
            )}
          </section>

          <section className="admin-drawer-section">
            <h4>Order info</h4>
            <div className="admin-drawer-grid">
              <div><span>Date / Time</span><strong>{order.date ? formatDateTime(order.date) : '—'}</strong></div>
              <div><span>User code</span><strong style={{ fontFamily: 'monospace' }}>{displayUserCode(order.employeeCode)}</strong></div>
              <div><span>Source</span><strong>{order.orderSource || 'Online'}</strong></div>
            </div>
          </section>

          <section className="admin-drawer-section">
            <h4>Payment</h4>
            <div className="admin-drawer-grid">
              <div><span>Amount</span><strong>{formatCurrency(order.totalPaid || order.total || 0)}</strong></div>
              <div><span>Method</span><strong>{order.method || order.paymentMethod || '—'}</strong></div>
              <div>
                <span>UTR / Txn ID</span>
                <strong className="admin-utr-code" style={{ maxWidth: '100%' }}>
                  {order.transactionId || order.utr || '—'}
                </strong>
              </div>
              <div><span>Date</span><strong>{order.date ? formatDate(order.date) : '—'}</strong></div>
            </div>
          </section>

          <section className="admin-drawer-section">
            <h4>Share</h4>
            <p><strong>{order.companyName || order.shareName}</strong> ({order.shareTicker || order.shareId})</p>
            <p>Qty {order.qty} × {formatCurrency(order.pricePerShare)}</p>
          </section>
        </div>

        {(onVerify || onReject || onComplete) && (isPendingOrder(order.status) || canMarkOrderComplete(order.status)) && (
          <div className="admin-drawer-footer">
            {onVerify && isPendingOrder(order.status) && (
              <button type="button" className="btn btn-primary btn-full" onClick={() => onVerify(order.orderId)}>
                Verify payment
              </button>
            )}
            {onComplete && canMarkOrderComplete(order.status) && (
              <button type="button" className="btn btn-primary btn-full" onClick={() => onComplete(order.orderId)}>
                Mark complete (share transferred)
              </button>
            )}
            {onReject && isPendingOrder(order.status) && (
              <button type="button" className="btn btn-ghost btn-full" style={{ color: '#ef4444' }} onClick={() => onReject(order.orderId)}>
                Reject payment
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
