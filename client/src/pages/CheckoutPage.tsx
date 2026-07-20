import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { saveOrder } from '../api/orders';
import { deleteInitiatedCheckout, saveInitiatedCheckout } from '../api/initiated';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useShares } from '../hooks/useShares';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { calcOrderTotal, calcOrderChargesBreakdown, formatCurrency, generateSessionId } from '../utils/format';
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
  const [customerUpi, setCustomerUpi] = useState('');
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [submittedUtr, setSubmittedUtr] = useState('');
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [sessionId] = useState(() => generateSessionId());

  const activePrice = useMemo(() => {
    if (!share) return 0;
    let price = share.price;
    if (share.discountTiers && share.discountTiers.length > 0) {
      const sortedTiers = [...share.discountTiers].sort((a, b) => b.minQty - a.minQty);
      for (const tier of sortedTiers) {
        if (qty >= tier.minQty) {
          price = tier.price;
          break;
        }
      }
    }
    return price;
  }, [share, qty]);

  useEffect(() => {
    if (share?.minQty) setQty(share.minQty);
  }, [share?.id, share?.minQty]);

  useEffect(() => {
    if (!loading && user && (user.kycStatus || '').trim().toLowerCase() !== 'verified') {
      showToast('KYC Verification is required to proceed with checkout.', 'error');
      navigate('/dashboard?tab=kyc', { replace: true });
    }
  }, [user, loading, navigate, showToast]);

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



  const originalSubtotal = share.price * qty;
  const subtotal = activePrice * qty;
  const offerBenefit = originalSubtotal - subtotal;
  
  const total = calcOrderTotal(activePrice, qty, settings);
  const chargesBreakdown = calcOrderChargesBreakdown(activePrice, qty, settings);

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
        pricePerShare: activePrice,
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
    setPaying(true);
    const baseMethodLabel = PAYMENT_MODES.find((m) => m.id === paymentMode)?.label || 'Manual';
    const methodLabel = paymentMode === 'upi' && customerUpi ? `${baseMethodLabel} (${customerUpi})` : baseMethodLabel;
    
    try {
      const res = await saveOrder({
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
      setOrderId(res.orderId || '');
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
            <p className="pay-instruction-hint">Enter your UPI ID to pay directly via your UPI app.</p>
            
            <div className="form-group" style={{ textAlign: 'left', marginBottom: '1rem' }}>
              <label className="form-label">Your UPI ID</label>
              <input
                className="form-input"
                placeholder="e.g. 9876543210@ybl"
                value={customerUpi}
                onChange={(e) => setCustomerUpi(e.target.value)}
              />
            </div>

            {customerUpi ? (
              <a
                href={`upi://pay?pa=${settings.bank_upi}&pn=${encodeURIComponent(settings.bank_ac_name)}&am=${total}&cu=INR`}
                className="btn btn-primary btn-full"
                style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem', textDecoration: 'none' }}
              >
                Pay {formatCurrency(total)} via UPI App
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="btn btn-primary btn-full"
                style={{ display: 'block', textAlign: 'center', marginBottom: '1.5rem', opacity: 0.5 }}
              >
                Enter UPI ID to Pay
              </button>
            )}

            <div className="pay-upi-id-box">
              <span>Or manually pay to</span>
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
            
            {share.discountTiers && share.discountTiers.length > 0 && (
              <div style={{ marginTop: '0.25rem', marginBottom: '1rem', textAlign: 'center' }}>
                <button 
                  type="button" 
                  className="btn btn-ghost" 
                  style={{ color: 'var(--primary)', textDecoration: 'underline', padding: 0 }}
                  onClick={() => setShowTiersModal(true)}
                >
                  Grab this opportunity at {formatCurrency(Math.min(...share.discountTiers.map(t => t.price)))}
                </button>
              </div>
            )}

            <div className="order-breakdown-box" style={{ background: 'var(--bg)', borderRadius: '8px', padding: '1rem', marginTop: '1.5rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--muted)' }}>Shares Value ({qty} × {formatCurrency(activePrice)})</span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
              </div>
              {offerBenefit > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--green)' }}>Offer benefit (Bulk discount)</span>
                  <span style={{ fontWeight: 500, color: 'var(--green)' }}>- {formatCurrency(offerBenefit)}</span>
                </div>
              )}
              {chargesBreakdown.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--muted)' }}>{c.name}</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(c.amount)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px dashed var(--border)', margin: '0.75rem 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Total Payable</span>
                <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)' }}>{formatCurrency(total)}</span>
              </div>
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
      
      {/* Tiers Modal */}
      {showTiersModal && share.discountTiers && (
        <div className="modal-overlay" onClick={() => setShowTiersModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowTiersModal(false)}>×</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Get additional discount on purchasing higher number of units</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 600, border: '1px solid var(--border)' }}>Quantity</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600, border: '1px solid var(--border)' }}>Rate/Share</th>
                </tr>
              </thead>
              <tbody>
                {share.discountTiers.sort((a, b) => a.minQty - b.minQty).map((tier, idx, arr) => {
                  const nextTier = arr[idx + 1];
                  const range = nextTier ? `${tier.minQty} - ${nextTier.minQty - 1}` : `${tier.minQty}+`;
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)' }}>{range}</td>
                      <td style={{ padding: '0.75rem', border: '1px solid var(--border)', fontWeight: 600 }}>{formatCurrency(tier.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
