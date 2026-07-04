import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { saveOrder } from '../api/orders';
import { deleteInitiatedCheckout, saveInitiatedCheckout } from '../api/initiated';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useShares } from '../hooks/useShares';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { calcOrderTotal, formatCurrency, generateOrderId, generateSessionId } from '../utils/format';
import { isShareOnRequest, isShareUnavailable } from '../utils/inventory';
type PaymentMode = 'neft' | 'imps' | 'upi' | 'qr';

const PAYMENT_MODES: { id: PaymentMode; label: string; desc: string; icon: string }[] = [
  { id: 'neft', label: 'NEFT', desc: 'Transfer via NEFT to our bank account', icon: '🏦' },
  { id: 'imps', label: 'IMPS', desc: 'Instant transfer using IMPS', icon: '⚡' },
  { id: 'upi', label: 'UPI ID', desc: 'Pay using our UPI ID', icon: '📱' },
  { id: 'qr', label: 'Scan QR Code', desc: 'Scan & pay with any UPI app', icon: '📷' },
];

function CopyRow({ label, value }: { label: string; value: string }) {
  const { showToast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => showToast(`${label} copied`, 'success'));
  };
  return (
    <div className="pay-detail-row">
      <span className="pay-detail-label">{label}</span>
      <button type="button" className="pay-detail-value" onClick={copy} title="Tap to copy">
        {value}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { getShareById } = useShares();
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const share = shareId ? getShareById(shareId) : null;
  const [step, setStep] = useState(1);
  const [qty, setQty] = useState(share?.minQty || 1);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [utr, setUtr] = useState('');
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [submittedUtr, setSubmittedUtr] = useState('');
  const [sessionId] = useState(() => generateSessionId());

  useEffect(() => {
    if (share?.minQty) setQty(share.minQty);
  }, [share?.id, share?.minQty]);

  const requireLoginForPayment = () => {
    const returnTo = `/checkout/${share?.id || shareId || ''}`;
    showToast('Login or sign up to continue payment', 'info');
    navigate('/login', {
      state: { from: returnTo, reason: 'payment' },
    });
  };

  if (!share) {
    return (
      <div className="view" id="view-checkout">
        <div className="checkout-wrap">
          <div className="checkout-card" style={{ textAlign: 'center' }}>
            <h2 className="checkout-title">Share not found</h2>
            <Link to="/shares" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Shares</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="view" id="view-checkout">
        <div className="checkout-wrap">
          <div className="checkout-card" style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (isShareUnavailable(share.inventoryStatus)) {
    return (
      <div className="view" id="view-checkout">
        <div className="checkout-wrap">
          <div className="checkout-card" style={{ textAlign: 'center' }}>
            <h2 className="checkout-title">Currently unavailable</h2>
            <p style={{ color: 'var(--muted)', margin: '1rem 0' }}>{share.name} is out of stock. Contact us for availability.</p>
            <Link to="/contact" className="btn btn-primary">Contact Us</Link>
          </div>
        </div>
      </div>
    );
  }

  const buyerEmail = user?.email || '';
  const buyerPhone = user?.phone || '';
  const buyerName = user?.name || 'Buyer';

  const subtotal = share.price * qty;
  const total = calcOrderTotal(share.price, qty);
  const fee = total - subtotal;

  const selectPaymentMode = async (mode: PaymentMode) => {
    if (!user) {
      requireLoginForPayment();
      return;
    }
    setPaymentMode(mode);
    try {
      await saveInitiatedCheckout({
        sessionId,
        shareId: share.id,
        shareName: share.name,
        shareTicker: share.ticker,
        buyerName,
        buyerEmail,
        buyerPhone,
        qty,
        pricePerShare: share.price,
        totalAmount: total,
        paymentMode: PAYMENT_MODES.find((m) => m.id === mode)?.label || mode,
      });
    } catch {
      // Non-blocking — checkout still works if tracking fails
    }
  };

  const goToPayment = () => {
    if (qty < share.minQty) {
      showToast(`Minimum ${share.minQty} shares required`, 'warning');
      return;
    }
    if (!user) {
      requireLoginForPayment();
      return;
    }
    setPaymentMode(null);
    setStep(2);
  };

  const handleConfirmPayment = async () => {
    if (!user) {
      requireLoginForPayment();
      return;
    }
    const utrClean = utr.trim().replace(/\s+/g, '').toUpperCase();
    if (utrClean.length < 6 || utrClean.length > 30) {
      showToast('Enter your UTR / UPI reference (6–30 characters) from your bank app', 'warning');
      return;
    }
    const id = generateOrderId();
    setOrderId(id);
    setPaying(true);
    const methodLabel = PAYMENT_MODES.find((m) => m.id === paymentMode)?.label || 'Manual';
    try {
      const res = await saveOrder({
        orderId: id,
        shareId: share.id,
        shareName: share.name,
        shareTicker: share.ticker,
        buyerName,
        buyerEmail,
        buyerPhone,
        pricePerShare: share.price,
        qty,
        method: methodLabel,
        status: 'Pending Verification',
        transactionId: utrClean,
        orderSource: 'Online',
      });
      setSubmittedUtr(res.transactionId || utrClean);
      try { await deleteInitiatedCheckout(sessionId); } catch { /* ignore */ }
      setStep(3);
      showToast('Order placed! UTR sent to admin for verification.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Order failed', 'error');
    } finally {
      setPaying(false);
    }
  };

  const renderBankDetails = () => (
    <div className="pay-bank-card">
      <h4>Bank Account Details</h4>
      <CopyRow label="Bank Name" value={settings.bank_name} />
      <CopyRow label="Account Name" value={settings.bank_ac_name} />
      <CopyRow label="Account No." value={settings.bank_ac_no} />
      <CopyRow label="IFSC Code" value={settings.bank_ifsc} />
      {settings.bank_branch && <CopyRow label="Branch" value={settings.bank_branch} />}
      <div className="pay-amount-box">
        <span>Transfer exactly</span>
        <strong>{formatCurrency(total)}</strong>
      </div>
    </div>
  );

  const renderPaymentInstructions = () => {
    if (!paymentMode) return null;

    return (
      <div className="pay-instructions">
        {paymentMode === 'neft' && (
          <>
            <p className="pay-instruction-hint">Transfer the exact amount via <strong>NEFT</strong> to the account below. Use your registered bank account only.</p>
            {renderBankDetails()}
          </>
        )}
        {paymentMode === 'imps' && (
          <>
            <p className="pay-instruction-hint">Transfer the exact amount via <strong>IMPS</strong> for instant credit. Use your registered bank account only.</p>
            {renderBankDetails()}
          </>
        )}
        {paymentMode === 'upi' && (
          <div className="pay-upi-card">
            <p className="pay-instruction-hint">Open any UPI app and pay to the ID below.</p>
            <div className="pay-upi-id-box">
              <span>Pay to</span>
              <strong>{settings.bank_ac_name}</strong>
              <div className="pay-upi-id">{settings.bank_upi}</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(settings.bank_upi);
                  showToast('UPI ID copied', 'success');
                }}
              >
                Copy UPI ID
              </button>
            </div>
            <div className="pay-amount-box">
              <span>Amount</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>
        )}
        {paymentMode === 'qr' && (
          <div className="pay-qr-card">
            <p className="pay-instruction-hint">Scan this QR code with PhonePe, GPay, Paytm or any UPI app.</p>
            <img src="/QR.jpeg" alt="UPI QR Code" className="pay-qr-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="pay-amount-box">
              <span>Amount</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <p className="pay-qr-fallback">UPI ID: <strong>{settings.bank_upi}</strong></p>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <label className="form-label">UTR / UPI Transaction ID *</label>
          <input
            className="form-input"
            placeholder="e.g. 123456789012 or UPI ref from your app"
            value={utr}
            onChange={(e) => setUtr(e.target.value.toUpperCase())}
            autoComplete="off"
            required
          />
          <div className="form-hint">
            Copy the UTR / reference number from your bank or UPI app after payment. Admin uses this to verify your transfer.
          </div>
        </div>

        {settings.disclaimer && (
          <div className="checkout-disclaimer">{settings.disclaimer}</div>
        )}

        <div className="pay-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPaymentMode(null)}>← Change method</button>
          <button type="button" className="btn btn-primary btn-full" disabled={paying} onClick={handleConfirmPayment}>
            {paying ? 'Submitting...' : 'I have made the transfer'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="view" id="view-checkout">
      <div className="order-flow-wrap">
        {/* Header — Zepto-style */}
        <div className="order-flow-header">
          <button type="button" className="order-back-btn" onClick={() => (step > 1 ? setStep(step - 1) : navigate(`/shares/${share.id}`))} aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="order-header-info">
            <div className="order-ticker">{share.ticker}</div>
            <div className="order-company-name">{share.name}</div>
          </div>
          <div className="order-header-price">{formatCurrency(share.price)}</div>
        </div>

        {/* Progress */}
        <div className="order-progress">
          {['Quantity', 'Payment', 'Done'].map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className={`order-progress-step${step === n ? ' active' : ''}${step > n ? ' done' : ''}`}>
                <div className="order-progress-dot">{step > n ? '✓' : n}</div>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Quantity */}
        {step === 1 && (
          <div className="order-card">
            <div className="order-card-top">
              <span className="order-badge">Order</span>
              <span className="order-isin">{share.sector}</span>
            </div>

            <div className="form-group">
              <div className="order-qty-label-row">
                <label className="form-label">No. Of Shares</label>
              </div>
              <input
                type="number"
                className="order-qty-input"
                min={share.minQty}
                value={qty}
                placeholder="Enter quantity"
                onChange={(e) => setQty(Math.max(share.minQty, +e.target.value || share.minQty))}
              />
              <div className="order-min-notice">Minimum purchase quantity is {share.minQty} shares.</div>
              {isShareOnRequest(share.inventoryStatus) && (
                <div className="order-min-notice" style={{ color: 'var(--gold)' }}>This stock is on request — transfer may take longer than usual.</div>
              )}
            </div>

            <div className="order-price-row">
              <span>Price per share</span>
              <strong>{formatCurrency(share.price)}</strong>
            </div>

            <div className="order-total-block">
              <div className="order-total-label">Total Value</div>
              <div className="order-total-amount">{formatCurrency(total)}</div>
              <div className="order-total-breakdown">{qty} shares × {formatCurrency(share.price)} + {formatCurrency(fee)} fee</div>
            </div>

            {!user && (
              <div className="checkout-login-required">
                <p>Login or sign up is required to pay and track your order.</p>
                <button type="button" className="btn btn-outline btn-full" onClick={requireLoginForPayment}>
                  Login / Sign up to continue
                </button>
              </div>
            )}

            <button type="button" className="btn btn-primary btn-full order-submit-btn" onClick={goToPayment}>
              {user ? 'Continue to Payment' : 'Login & Continue to Payment'}
            </button>
            <p className="order-terms">By placing this order, you agree to our Terms &amp; Conditions</p>
          </div>
        )}

        {/* Step 2: Payment mode */}
        {step === 2 && (
          <div className="order-card">
            <h2 className="checkout-title" style={{ marginBottom: '0.25rem' }}>Select Payment Method</h2>
            <p className="checkout-subtitle">Pay {formatCurrency(total)} using any method below</p>

            {!paymentMode ? (
              <div className="pay-mode-list">
                {PAYMENT_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className="pay-mode-item"
                    onClick={() => selectPaymentMode(mode.id)}
                  >
                    <span className="pay-mode-icon">{mode.icon}</span>
                    <div className="pay-mode-text">
                      <strong>{mode.label}</strong>
                      <span>{mode.desc}</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                ))}
              </div>
            ) : (
              renderPaymentInstructions()
            )}
          </div>
        )}

        {/* Step 3: Confirmed */}
        {step === 3 && (
          <div className="order-card">
            <div className="confirm-wrap">
              <div className="confirm-icon" style={{ color: 'var(--green)' }}>✓</div>
              <h2 className="confirm-title">Order Received!</h2>
              <p className="confirm-subtitle">
                We are verifying your payment. Shares will be transferred to your demat within 2–3 business days after confirmation.
              </p>
              <div className="confirm-order-id">
                Order ID <span>{orderId}</span>
              </div>
              <div className="confirm-details">
                <div className="confirm-row"><span className="lbl">Company</span><span className="val">{share.name}</span></div>
                <div className="confirm-row"><span className="lbl">Quantity</span><span className="val">{qty} shares</span></div>
                <div className="confirm-row"><span className="lbl">Amount</span><span className="val">{formatCurrency(total)}</span></div>
                <div className="confirm-row"><span className="lbl">Payment</span><span className="val">{PAYMENT_MODES.find((m) => m.id === paymentMode)?.label}</span></div>
                <div className="confirm-row"><span className="lbl">UTR / Txn ID</span><span className="val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{submittedUtr || utr}</span></div>
                <div className="confirm-row"><span className="lbl">Status</span><span className="val" style={{ color: 'var(--gold)' }}>Pending Verification</span></div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', textAlign: 'center' }}>
                Your UTR is now in the admin <strong>Verify Payments</strong> queue. We match it to our bank credit within 24 hours.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/dashboard" className="btn btn-primary btn-full">View My Orders</Link>
                <Link to="/shares" className="btn btn-ghost btn-full">Continue Exploring</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
