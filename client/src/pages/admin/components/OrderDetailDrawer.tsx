import { useEffect, useState } from 'react';
import type { Order, User } from '../../../types';
import { formatCurrency, formatDate, formatDateTime, formatIndianPhoneDisplay, formatPersonName, getOrderDate } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import {
  getAdminOrderStatusLabel,
  getOrderStatusClass,
  isPendingOrder,
  canMarkOrderComplete,
  canUndoOrderComplete,
} from '../../../utils/orderStatus';
import CopyTextButton from '../../../components/ui/CopyTextButton';

type Props = {
  order: Order | null;
  users: User[];
  onClose: () => void;
  onVerify?: (orderId: string) => void;
  onReject?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
  onUndoComplete?: (orderId: string) => void;
  employees?: Array<{ employee_id?: string; employeeCode?: string; name?: string }>;
  onTransfer?: (orderId: string, employeeCode: string) => void | Promise<unknown>;
};

export default function OrderDetailDrawer({
  order,
  users,
  onClose,
  onVerify,
  onReject,
  onComplete,
  onUndoComplete,
  employees,
  onTransfer,
}: Props) {
  if (!order) return null;

  const employeeOptions = (employees || [])
    .map((e) => {
      const code = String(e.employee_id ?? e.employeeCode ?? '').trim();
      return code ? { code, name: e.name ? String(e.name) : code } : null;
    })
    .filter(Boolean) as Array<{ code: string; name: string }>;

  const isManual = /offline|manual/i.test(order.orderSource || '') || /offline/i.test(order.method || '');
  const canTransfer = !!onTransfer && isManual && isPendingOrder(order.status) && employeeOptions.length > 0;
  const [assignEmployeeCode, setAssignEmployeeCode] = useState<string>('');

  useEffect(() => {
    if (!canTransfer) {
      setAssignEmployeeCode('');
      return;
    }
    const current = (order.employeeCode || '').trim();
    const currentIsValid = current && employeeOptions.some((o) => o.code.toUpperCase() === current.toUpperCase());
    setAssignEmployeeCode(currentIsValid ? current : employeeOptions[0]?.code || '');
  }, [order.orderId, canTransfer, order.employeeCode, employeeOptions]);

  const buyer = users.find(
    (u) =>
      (order.buyerEmail && u.email.toLowerCase() === order.buyerEmail.toLowerCase())
      || (order.buyerPhone && u.phone === order.buyerPhone),
  );

  const showFooter =
    (onVerify && isPendingOrder(order.status))
    || (onReject && isPendingOrder(order.status))
    || (onComplete && canMarkOrderComplete(order.status))
    || (onUndoComplete && canUndoOrderComplete(order.status));

  return (
    <div className="admin-drawer-overlay" onClick={onClose} role="presentation">
      <aside className="admin-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Order details">
        <div className="admin-drawer-header">
          <div>
            <h3 className="admin-id-cell" style={{ gap: '0.5rem' }}>
              <span>Order {order.orderId}</span>
              <CopyTextButton value={order.orderId} label="Order ID copied" />
            </h3>
            <span className={`status-badge status-badge--admin ${getOrderStatusClass(order.status)}`}>
              {getAdminOrderStatusLabel(order.status)}
            </span>
          </div>
          <button type="button" className="admin-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="admin-drawer-body">
          <section className="admin-drawer-section">
            <h4>Buyer</h4>
            <p><strong>{formatPersonName(order.buyerName)}</strong></p>
            <p>{order.buyerEmail || '—'}</p>
            <p>{order.buyerPhone ? formatIndianPhoneDisplay(order.buyerPhone) : '—'}</p>
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
              <div><span>Date / Time</span><strong>{getOrderDate(order) ? formatDateTime(getOrderDate(order)) : '—'}</strong></div>
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
                <span>Payment Ref</span>
                <strong className="admin-utr-code" style={{ maxWidth: '100%' }}>
                  {order.transactionId || order.utr || (order.orderSource === 'Online' || !order.orderSource ? 'Self-confirmed' : '—')}
                </strong>
              </div>
              <div><span>Date</span><strong>{getOrderDate(order) ? formatDate(getOrderDate(order)) : '—'}</strong></div>
            </div>
          </section>

          {canTransfer && (
            <section className="admin-drawer-section">
              <h4>Assign verification employee</h4>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="report-filter-input"
                  value={assignEmployeeCode}
                  onChange={(e) => setAssignEmployeeCode(e.target.value)}
                  aria-label="Assign employee"
                >
                  {employeeOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {displayUserCode(o.code)}{o.name ? ` — ${o.name}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!assignEmployeeCode) return;
                    const ok = confirm('Assign this manual order to the employee for verification?');
                    if (!ok) return;
                    await Promise.resolve(onTransfer?.(order.orderId, assignEmployeeCode));
                    onClose();
                  }}
                >
                  Assign
                </button>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                The order will move into the employee’s Verify Payments queue.
              </p>
            </section>
          )}

          <section className="admin-drawer-section">
            <h4>Share</h4>
            <p><strong>{order.companyName || order.shareName}</strong> ({order.shareTicker || order.shareId})</p>
            <p>Qty {order.qty} × {formatCurrency(order.pricePerShare)}</p>
          </section>
        </div>

        {showFooter && (
          <div className="admin-drawer-footer">
            {onVerify && isPendingOrder(order.status) && (
              <button type="button" className="btn btn-primary btn-full" onClick={() => onVerify(order.orderId)}>
                Verify payment → Share transfer
              </button>
            )}
            {onComplete && canMarkOrderComplete(order.status) && (
              <button type="button" className="btn btn-primary btn-full" onClick={() => onComplete(order.orderId)}>
                Mark complete (share transferred)
              </button>
            )}
            {onUndoComplete && canUndoOrderComplete(order.status) && (
              <button type="button" className="btn btn-ghost btn-full" onClick={() => onUndoComplete(order.orderId)}>
                Undo complete → Share transfer
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
