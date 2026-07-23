import { useEffect, useState } from 'react';
import type { Order, User } from '../../../types';
import { formatCurrency, formatDate, formatDateTime, formatIndianPhoneDisplay, formatPersonName, getOrderDate } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import {
  getAdminOrderStatusLabel,
  getOrderStatusClass,
  isPendingOrder,
  isTransferPendingOrder,
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
  onDelete?: (orderId: string) => void;
  onSavePaymentRef?: (orderId: string, transactionId: string) => void | Promise<unknown>;
  onAdjustTotal?: (orderId: string, totalAmount: number) => void | Promise<unknown>;
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
  onDelete,
  onSavePaymentRef,
  onAdjustTotal,
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

  const statusOpen =
    isPendingOrder(order.status)
    || isTransferPendingOrder(order.status);
  const canTransfer = !!onTransfer && statusOpen && employeeOptions.length > 0;
  const [assignEmployeeCode, setAssignEmployeeCode] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');
  const [savingRef, setSavingRef] = useState(false);
  const [amountEdit, setAmountEdit] = useState('');
  const [savingAmount, setSavingAmount] = useState(false);

  useEffect(() => {
    setPaymentRef((order.transactionId || order.utr || '').toUpperCase());
  }, [order.orderId, order.transactionId, order.utr]);

  useEffect(() => {
    setAmountEdit(String(order.totalPaid || order.total || ''));
  }, [order.orderId, order.totalPaid, order.total]);

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
    || (onUndoComplete && canUndoOrderComplete(order.status))
    || !!onDelete;

  const savePaymentRef = async () => {
    if (!onSavePaymentRef) return;
    const clean = paymentRef.trim().replace(/\s+/g, '').toUpperCase();
    if (clean.length < 6 || clean.length > 30) {
      window.alert('Payment reference must be 6–30 characters (UTR from bank / UPI app).');
      return;
    }
    setSavingRef(true);
    try {
      await Promise.resolve(onSavePaymentRef(order.orderId, clean));
    } finally {
      setSavingRef(false);
    }
  };

  const saveAmount = async () => {
    if (!onAdjustTotal) return;
    const n = Math.round(parseFloat(amountEdit.replace(/,/g, '')) * 100) / 100;
    if (!Number.isFinite(n) || n < 1) {
      window.alert('Enter a valid amount.');
      return;
    }
    const current = Number(order.totalPaid || order.total || 0);
    if (Math.abs(n - current) < 0.009) return;
    const ok = window.confirm(`Update order total from ${formatCurrency(current)} to ${formatCurrency(n)}?`);
    if (!ok) return;
    setSavingAmount(true);
    try {
      await Promise.resolve(onAdjustTotal(order.orderId, n));
    } finally {
      setSavingAmount(false);
    }
  };

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
              <div><span>Date</span><strong>{getOrderDate(order) ? formatDate(getOrderDate(order)) : '—'}</strong></div>
            </div>
            {onAdjustTotal && (
              <div style={{ marginTop: '0.85rem' }}>
                <label className="form-label" htmlFor={`order-amount-${order.orderId}`}>
                  Correct paid amount
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id={`order-amount-${order.orderId}`}
                    className="form-input"
                    type="number"
                    min={1}
                    step="0.01"
                    value={amountEdit}
                    onChange={(e) => setAmountEdit(e.target.value)}
                    style={{ flex: '1 1 120px', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={savingAmount}
                    onClick={() => void saveAmount()}
                  >
                    {savingAmount ? 'Saving…' : 'Save amount'}
                  </button>
                </div>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Use when bank credit differs from share value (e.g. old 1% fee shown at checkout).
                </p>
              </div>
            )}
            <div style={{ marginTop: '0.85rem' }}>
              <label className="form-label" htmlFor={`payment-ref-${order.orderId}`}>
                {canMarkOrderComplete(order.status) ? 'Transfer / Payment Ref (UTR)' : 'Payment Ref / UTR'}
              </label>
              {onSavePaymentRef ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    id={`payment-ref-${order.orderId}`}
                    className="form-input"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder="Enter bank / UPI UTR"
                    maxLength={30}
                    style={{ flex: '1 1 160px', fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    className={canMarkOrderComplete(order.status) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    disabled={savingRef}
                    onClick={() => void savePaymentRef()}
                  >
                    {savingRef
                      ? 'Saving…'
                      : canMarkOrderComplete(order.status)
                        ? 'Save & Complete'
                        : 'Save ref'}
                  </button>
                </div>
              ) : (
                <strong className="admin-utr-code" style={{ display: 'block', marginTop: '0.25rem' }}>
                  {order.transactionId || order.utr || '—'}
                </strong>
              )}
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                {canMarkOrderComplete(order.status)
                  ? 'Enter UTR / transfer reference, then Save & Complete — status becomes Order Complete.'
                  : 'Paste the UTR from the buyer’s UPI / bank SMS here if missing.'}
              </p>
            </div>
          </section>

          {canTransfer && (
            <section className="admin-drawer-section">
              <h4>Transfer order (assign employee)</h4>
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
                    const ok = confirm(`Transfer this order to ${displayUserCode(assignEmployeeCode)}?`);
                    if (!ok) return;
                    await Promise.resolve(onTransfer?.(order.orderId, assignEmployeeCode));
                    onClose();
                  }}
                >
                  Transfer
                </button>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Changes the User Code on this order so that employee can work it in their queue.
              </p>
            </section>
          )}

          <section className="admin-drawer-section">
            <h4>Share</h4>
            <p><strong>{order.companyName || order.shareName}</strong> ({order.shareTicker || order.shareId})</p>
            <p>Qty {order.qty} × {formatCurrency(order.pricePerShare)}</p>
            {(() => {
              const shareValue = Math.round(order.qty * order.pricePerShare * 100) / 100;
              const paid = Number(order.totalPaid || order.total || 0);
              const fee = Math.round((paid - shareValue) * 100) / 100;
              return (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', lineHeight: 1.55 }}>
                  <div>Shares value: <strong>{formatCurrency(shareValue)}</strong></div>
                  {Math.abs(fee) >= 0.01 ? (
                    <>
                      <div>Extra charges: <strong>{formatCurrency(fee)}</strong></div>
                      <div>Order total: <strong>{formatCurrency(paid)}</strong></div>
                    </>
                  ) : (
                    <div>Order total: <strong>{formatCurrency(paid)}</strong></div>
                  )}
                </div>
              );
            })()}
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
            {onDelete && (
              <button type="button" className="btn btn-ghost btn-full" style={{ color: '#ef4444' }} onClick={() => onDelete(order.orderId)}>
                Delete order (can Undo)
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
