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
import { UPI_APPS, isMobileDevice, openUpiPay } from '../utils/upiPay';
type PaymentMode = 'neft' | 'imps' | 'upi' | 'qr';

const PAYMENT_MODES: { id: PaymentMode; label: string; desc: string; icon: string }[] = [
  { id: 'neft', label: 'NEFT', desc: 'Transfer via NEFT to our bank account', icon: '🏦' },
  { id: 'imps', label: 'IMPS', desc: 'Instant transfer using IMPS', icon: '⚡' },
  { id: 'upi', label: 'UPI Apps', desc: 'Pay with GPay, PhonePe, Paytm — opens on your phone', icon: '📱' },
  { id: 'qr', label: 'Scan QR Code', desc: 'Scan QR or open UPI app with amount pre-filled', icon: '📷' },
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
  const [qty, setQty] = useState<number | ''>(share?.minQty || 1);
  const safeQty = typeof qty === 'number' && !isNaN(qty) ? qty : 0;
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [paidConfirmed, setPaidConfirmed] = useState(false);
  const [utr, setUtr] = useState('');
  const [paying, setPaying] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [showTiersModal, setShowTiersModal] = useState(false);
  const [sessionId] = useState(() => generateSessionId());

  const activePrice = useMemo(() => {
    if (!share) return 0;
    let price = share.price;
    if (share.discountTiers && share.discountTiers.length > 0) {
      const sortedTiers = [...share.discountTiers].sort((a, b) => b.minQty - a.minQty);
      for (const tier of sortedTiers) {
        if (safeQty >= tier.minQty) {
          price = tier.price;
          break;
        }
      }
    }
    return price;
  }, [share, safeQty]);

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



  const originalSubtotal = share.price * safeQty;
  const subtotal = activePrice * safeQty;
  const offerBenefit = originalSubtotal - subtotal;
  
  const total = calcOrderTotal(activePrice, safeQty, settings);
  const chargesBreakdown = calcOrderChargesBreakdown(activePrice, safeQty, settings);
  const mobile = isMobileDevice();
  const upiPayParams = {
    vpa: settings.bank_upi || '',
    payeeName: settings.bank_ac_name || 'GO UNLISTED',
    amount: total,
    note: `GO UNLISTED ${share.ticker}`,
  };

  const handleOpenUpi = (packageName?: string) => {
    if (!settings.bank_upi?.trim()) {
      showToast('UPI ID not configured. Contact support.', 'error');
      return;
    }
    const ok = openUpiPay(upiPayParams, packageName);
    if (ok) {
      showToast('Opening your UPI app… Complete payment, then tick the box below.', 'info');
    }
  };

  const renderUpiPayButtons = (compact?: boolean) => (
    <div className={`pay-upi-apps${compact ? ' pay-upi-apps--compact' : ''}`}>
      {mobile ? (
        UPI_APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            className={app.id === 'any' ? 'btn btn-primary btn-full pay-upi-app-btn pay-upi-app-btn--primary' : 'btn btn-outline btn-full pay-upi-app-btn'}
            onClick={() => handleOpenUpi(app.packageName)}
          >
            <span className="pay-upi-app-label">{app.label}</span>
            {app.id === 'any' && (
              <span className="pay-upi-app-amount">Pay {formatCurrency(total)}</span>
            )}
          </button>
        ))
      ) : (
        <button type="button" className="btn btn-primary btn-full pay-upi-app-btn pay-upi-app-btn--primary" onClick={() => handleOpenUpi()}>
          <span className="pay-upi-app-label">Open UPI app</span>
          <span className="pay-upi-app-amount">Pay {formatCurrency(total)}</span>
        </button>
      )}
      <p className="pay-upi-apps-hint">
        {mobile
          ? 'Tap Pay — your phone will open GPay, PhonePe, or another UPI app with amount filled.'
          : 'On mobile this opens GPay / PhonePe directly. On desktop, scan the QR or use bank transfer.'}
      </p>
    </div>
  );

  const selectPaymentMode = async (mode: PaymentMode) => {
    if (!user) {
      requireLoginForPayment();
      return;
    }
    setPaymentMode(mode);
    setPaidConfirmed(false);
    try {
      await saveInitiatedCheckout({
        sessionId,
        shareId: share.id,
        shareName: share.name,
        shareTicker: share.ticker,
        buyerName,
        buyerEmail,
        buyerPhone,
        qty: safeQty,
        pricePerShare: activePrice,
        totalAmount: total,
        paymentMode: PAYMENT_MODES.find((m) => m.id === mode)?.label || mode,
      });
    } catch {
      // Non-blocking — checkout still works if tracking fails
    }
  };

  const goToPayment = () => {
    if (safeQty < share.minQty) {
      showToast(`Minimum ${share.minQty} shares required`, 'warning');
      return;
    }
    if (!user) {
      requireLoginForPayment();
      return;
    }
    setPaymentMode(null);
    setPaidConfirmed(false);
    setUtr('');
    setStep(2);
  };

  const handleConfirmPayment = async () => {
    if (!user) {
      requireLoginForPayment();
      return;
    }
    if (!paymentMode) {
      showToast('Select a payment method first', 'warning');
      return;
    }
    if (!paidConfirmed) {
      showToast('Confirm that you have completed the payment', 'warning');
      return;
    }
    const utrClean = utr.trim().replace(/\s+/g, '').toUpperCase();
    if (utrClean.length < 6 || utrClean.length > 30) {
      showToast('Enter your UTR / UPI reference (6–30 characters) from the payment app', 'warning');
      return;
    }
    setPaying(true);
    const methodLabel = PAYMENT_MODES.find((m) => m.id === paymentMode)?.label || 'Online';

    try {
      const res = await saveOrder({
        shareId: share.id,
        shareName: share.name,
        shareTicker: share.ticker,
        buyerName,
        buyerEmail,
        buyerPhone,
        pricePerShare: activePrice,
        qty: safeQty,
        method: methodLabel,
        orderSource: 'Online',
        transactionId: utrClean,
        paymentConfirmed: true,
      });
      setOrderId(res.orderId || '');
      try { await deleteInitiatedCheckout(sessionId); } catch { /* ignore */ }
      setStep(3);
      showToast('Order placed — shares are in your portfolio (share transfer pending).', 'success');
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
            <p className="pay-instruction-hint">
              Tap <strong>Pay {formatCurrency(total)}</strong> — your UPI app opens with our details and amount already filled.
            </p>
            {renderUpiPayButtons()}
            <div className="pay-upi-id-box">
              <span>Merchant UPI</span>
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
            <p className="pay-instruction-hint">
              Scan the QR with any UPI app, or tap Pay below to open GPay / PhonePe on your phone.
            </p>
            <img src="/QR.jpeg" alt="UPI QR Code" className="pay-qr-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="pay-amount-box">
              <span>Amount</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            {renderUpiPayButtons(true)}
            <p className="pay-qr-fallback">UPI ID: <strong>{settings.bank_upi}</strong></p>
          </div>
        )}

        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <label className="form-label" htmlFor="checkout-utr">
            UTR / UPI reference *
          </label>
          <input
            id="checkout-utr"
            className="form-input"
            value={utr}
            onChange={(e) => setUtr(e.target.value.toUpperCase().replace(/\s+/g, ''))}
            placeholder="Paste UTR from GPay / PhonePe / bank SMS"
            maxLength={30}
            autoComplete="off"
            inputMode="text"
          />
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 }}>
            Temporary until Razorpay is live — after paying, copy the UTR / reference from your UPI or bank app. Order is placed only with a valid UTR.
          </p>
        </div>

        <label
          className="pay-confirm-check"
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            marginTop: '1rem',
            padding: '0.85rem 1rem',
            borderRadius: 10,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface-2, #f8fafc)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <input
            type="checkbox"
            checked={paidConfirmed}
            onChange={(e) => setPaidConfirmed(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>
            I have paid <strong>{formatCurrency(total)}</strong> and entered the correct UTR above.
            Shares will appear in my portfolio.
          </span>
        </label>

        <div className="pay-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPaymentMode(null);
              setPaidConfirmed(false);
              setUtr('');
            }}
          >
            ← Change method
          </button>
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={paying || !paidConfirmed || utr.trim().length < 6}
            onClick={handleConfirmPayment}
          >
            {paying ? 'Confirming…' : 'Confirm payment & place order'}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setQty(val === '' ? '' : parseInt(val, 10));
                }}
                onBlur={() => {
                  if (typeof qty !== 'number' || isNaN(qty) || qty < share.minQty) {
                    setQty(share.minQty);
                  }
                }}
              />
              <div className="order-min-notice">Minimum purchase quantity is {share.minQty} shares.</div>
              {isShareOnRequest(share.inventoryStatus) && (
                <div className="order-min-notice" style={{ color: 'var(--gold)' }}>This stock is on request — transfer may take longer than usual.</div>
              )}
            </div>

            <div className="order-price-row">
              <span>Price per share</span>
              <strong>{formatCurrency(activePrice)}</strong>
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
                <span style={{ color: 'var(--muted)' }}>Shares Value ({safeQty} × {formatCurrency(activePrice)})</span>
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
                We have your UTR. Shares are in your portfolio while we complete demat transfer.
              </p>
              <div className="confirm-order-id">
                Order ID <span>{orderId}</span>
              </div>
              <div className="confirm-details">
                <div className="confirm-row"><span className="lbl">Company</span><span className="val">{share.name}</span></div>
                <div className="confirm-row"><span className="lbl">Quantity</span><span className="val">{qty} shares</span></div>
                <div className="confirm-row"><span className="lbl">Amount</span><span className="val">{formatCurrency(total)}</span></div>
                <div className="confirm-row"><span className="lbl">Payment</span><span className="val">{PAYMENT_MODES.find((m) => m.id === paymentMode)?.label}</span></div>
                <div className="confirm-row"><span className="lbl">UTR</span><span className="val" style={{ fontFamily: 'monospace' }}>{utr.trim().toUpperCase() || '—'}</span></div>
                <div className="confirm-row"><span className="lbl">Status</span><span className="val" style={{ color: 'var(--accent)' }}>Share transfer pending</span></div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', textAlign: 'center' }}>
                Track status in Dashboard. Our team marks the order Complete after demat credit.
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
