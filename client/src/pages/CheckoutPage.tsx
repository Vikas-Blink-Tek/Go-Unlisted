import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createRazorpayOrder, saveOrder, type RazorpayQuote } from '../api/orders';
import { deleteInitiatedCheckout, saveInitiatedCheckout } from '../api/initiated';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useShares } from '../hooks/useShares';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { calcOrderTotal, calcOrderChargesBreakdown, formatCurrency, generateSessionId } from '../utils/format';
import SharePriceCompare from '../components/shares/SharePriceCompare';
import { isShareOnRequest, isSharePurchasable, isShareUnavailable } from '../utils/inventory';
import { openRazorpayCheckout } from '../utils/razorpay';

type PayState =
  | { kind: 'idle' }
  | { kind: 'paying' }
  | { kind: 'verifying' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

const PAY_METHODS = ['UPI', 'Cards', 'Netbanking', 'Wallets'];

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
  const [quote, setQuote] = useState<RazorpayQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [payState, setPayState] = useState<PayState>({ kind: 'idle' });
  const [paymentId, setPaymentId] = useState('');
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

  // Leaving the page mid-payment would lose the order — warn before unload
  useEffect(() => {
    if (payState.kind !== 'verifying') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [payState.kind]);

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

  if (!isSharePurchasable(share)) {
    const listed = !isShareUnavailable(share.inventoryStatus);
    return (
      <div className="view" id="view-checkout">
        <div className="checkout-wrap">
          <div className="checkout-card" style={{ textAlign: 'center' }}>
            <h2 className="checkout-title">{listed ? 'Not available for purchase' : 'Currently unavailable'}</h2>
            <p style={{ color: 'var(--muted)', margin: '1rem 0' }}>
              {listed
                ? `${share.name} is exchange-listed. GO UNLISTED only deals in unlisted & pre-IPO shares.`
                : `${share.name} is out of stock. Contact us for availability.`}
            </p>
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
  const busy = payState.kind === 'paying' || payState.kind === 'verifying';

  /** Server prices the order and opens a Razorpay order for that exact amount. */
  const loadQuote = async () => {
    setQuote(null);
    setQuoteError('');
    try {
      setQuote(await createRazorpayOrder(share.id, safeQty));
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Could not load payment details');
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
    setPayState({ kind: 'idle' });
    setStep(2);
    loadQuote();
    saveInitiatedCheckout({
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
      paymentMode: 'Razorpay',
    }).catch(() => {
      // Non-blocking — checkout still works if tracking fails
    });
  };

  const handlePay = async () => {
    if (!user) {
      requireLoginForPayment();
      return;
    }
    if (!quote) return;
    setPayState({ kind: 'paying' });
    let payment;
    try {
      payment = await openRazorpayCheckout({
        key: quote.key_id,
        amount: quote.amount,
        currency: quote.currency,
        order_id: quote.order_id,
        name: 'GO UNLISTED',
        description: `${quote.summary.qty} × ${quote.summary.share_name}`,
        image: `${window.location.origin}/logo.png`,
        prefill: { name: buyerName, email: buyerEmail, contact: buyerPhone },
        theme: { color: '#0072bc' },
      });
    } catch (err) {
      setPayState({ kind: 'failed', message: err instanceof Error ? err.message : 'Payment failed' });
      return;
    }
    if (!payment) {
      setPayState({ kind: 'cancelled' });
      return;
    }

    setPayState({ kind: 'verifying' });
    try {
      // Server checks the Razorpay signature before creating the order
      const res = await saveOrder({
        shareId: share.id,
        shareName: share.name,
        shareTicker: share.ticker,
        buyerName,
        buyerEmail,
        buyerPhone,
        qty: quote.summary.qty,
        orderSource: 'Online',
        razorpayPaymentId: payment.razorpay_payment_id,
        razorpayOrderId: payment.razorpay_order_id,
        razorpaySignature: payment.razorpay_signature,
      });
      setPaymentId(payment.razorpay_payment_id);
      setOrderId(res.orderId || '');
      deleteInitiatedCheckout(sessionId).catch(() => { /* ignore */ });
      setPayState({ kind: 'idle' });
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not confirm your order';
      const id = payment.razorpay_payment_id;
      setPayState({
        kind: 'failed',
        message: msg.includes(id)
          ? msg
          : `${msg} Your payment ID is ${id} — share it with support and we will place your order.`,
      });
    }
  };

  const goBack = () => {
    if (busy) return;
    if (step === 2) {
      setStep(1);
      setQuote(null);
      return;
    }
    navigate(`/shares/${share.id}`);
  };

  const renderSummaryRow = (label: string, value: string, tone?: 'green' | 'muted') => (
    <div className="pay-summary-row">
      <span className={tone === 'muted' ? 'pay-summary-muted' : undefined}>{label}</span>
      <span className={tone === 'green' ? 'pay-summary-green' : undefined}>{value}</span>
    </div>
  );

  const renderPayStep = () => {
    if (quoteError) {
      return (
        <div className="pay-alert pay-alert--error">
          <strong>Could not start payment</strong>
          <span>{quoteError}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadQuote}>Try again</button>
        </div>
      );
    }
    if (!quote) {
      return (
        <div className="pay-loading">
          <span className="pay-spinner" aria-hidden />
          Preparing secure payment…
        </div>
      );
    }

    const s = quote.summary;
    const savings = (s.base_price - s.price_per_share) * s.qty;
    return (
      <>
        <div className="pay-summary">
          <div className="pay-summary-title">Order summary</div>
          {renderSummaryRow(`${s.share_name}`, `${s.qty} shares`, 'muted')}
          {renderSummaryRow(`Shares value (${s.qty} × ${formatCurrency(s.base_price)})`, formatCurrency(s.subtotal + Math.max(savings, 0)))}
          {savings > 0 && renderSummaryRow('Bulk discount applied', `− ${formatCurrency(savings)}`, 'green')}
          {s.charges.map((c) => (
            <div key={c.name}>{renderSummaryRow(c.name, formatCurrency(c.amount))}</div>
          ))}
          <div className="pay-summary-total">
            <span>Total payable</span>
            <strong>{formatCurrency(quote.amount / 100)}</strong>
          </div>
        </div>

        {payState.kind === 'failed' && (
          <div className="pay-alert pay-alert--error" role="alert">
            <strong>Payment not completed</strong>
            <span>{payState.message}</span>
          </div>
        )}
        {payState.kind === 'cancelled' && (
          <div className="pay-alert" role="status">
            <span>Payment cancelled. No money was deducted — tap Pay to try again.</span>
          </div>
        )}

        <div className="pay-methods">
          <span>Pay with</span>
          {PAY_METHODS.map((m) => <span key={m} className="pay-method-chip">{m}</span>)}
        </div>

        <button type="button" className="btn btn-primary btn-full pay-cta" disabled={busy} onClick={handlePay}>
          {payState.kind === 'paying'
            ? 'Waiting for payment…'
            : payState.kind === 'failed' || payState.kind === 'cancelled'
              ? `Retry payment · ${formatCurrency(quote.amount / 100)}`
              : `Pay ${formatCurrency(quote.amount / 100)}`}
        </button>

        <p className="pay-secure-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          100% secure payment by Razorpay. Your order is confirmed instantly after payment.
        </p>
      </>
    );
  };

  return (
    <div className="view" id="view-checkout">
      <div className="order-flow-wrap">
        {/* Header — Zepto-style */}
        <div className="order-flow-header">
          <button type="button" className="order-back-btn" onClick={goBack} disabled={busy} aria-label="Back">
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
          {['Quantity', 'Review & Pay', 'Done'].map((label, i) => {
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
              <SharePriceCompare
                share={share}
                variant="checkout"
                qty={safeQty}
                onViewAllTiers={() => setShowTiersModal(true)}
              />
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

            {user && (user.kycStatus || '').trim().toLowerCase() !== 'verified' && (
              <div className="checkout-login-required">
                <p>
                  You can pay now. Complete KYC in your dashboard before share transfer
                  {(user.kycStatus || '').trim().toLowerCase() === 'under review'
                    ? ' — your details are already under review.'
                    : '.'}
                </p>
                <Link to="/dashboard?tab=kyc" className="btn btn-ghost btn-full">
                  Complete KYC later
                </Link>
              </div>
            )}

            <button type="button" className="btn btn-primary btn-full order-submit-btn" onClick={goToPayment}>
              {user ? 'Continue to Payment' : 'Login & Continue to Payment'}
            </button>
            <p className="order-terms">By placing this order, you agree to our Terms &amp; Conditions</p>
          </div>
        )}

        {/* Step 2: Review & pay */}
        {step === 2 && (
          <div className="order-card">
            <h2 className="checkout-title" style={{ marginBottom: '0.25rem' }}>Review &amp; Pay</h2>
            <p className="checkout-subtitle">Check your order and pay securely online.</p>
            {renderPayStep()}
            {!busy && (
              <button type="button" className="btn btn-ghost btn-full" style={{ marginTop: '0.5rem' }} onClick={goBack}>
                ← Change quantity
              </button>
            )}
          </div>
        )}

        {/* Step 3: Confirmed */}
        {step === 3 && quote && (
          <div className="order-card">
            <div className="confirm-wrap">
              <div className="confirm-icon" style={{ color: 'var(--green)' }}>✓</div>
              <h2 className="confirm-title">Payment successful!</h2>
              <p className="confirm-subtitle">
                Your order is confirmed. Shares show in your portfolio while we complete the demat transfer.
              </p>
              <div className="confirm-order-id">
                Order ID <span>{orderId}</span>
              </div>
              <div className="confirm-details">
                <div className="confirm-row"><span className="lbl">Company</span><span className="val">{share.name}</span></div>
                <div className="confirm-row"><span className="lbl">Quantity</span><span className="val">{quote.summary.qty} shares</span></div>
                <div className="confirm-row"><span className="lbl">Amount paid</span><span className="val">{formatCurrency(quote.amount / 100)}</span></div>
                <div className="confirm-row">
                  <span className="lbl">Payment ID</span>
                  <span className="val" style={{ fontFamily: 'monospace' }}>{paymentId}</span>
                </div>
                <div className="confirm-row"><span className="lbl">Status</span><span className="val" style={{ color: 'var(--accent)' }}>Share transfer pending</span></div>
              </div>
              {(user?.kycStatus || '').trim().toLowerCase() !== 'verified' && (
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem', textAlign: 'center' }}>
                  Complete your KYC so we can transfer the shares to your demat account.{' '}
                  <Link to="/dashboard?tab=kyc">Complete KYC</Link>
                </p>
              )}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/dashboard" className="btn btn-primary btn-full">View My Orders</Link>
                <Link to="/shares" className="btn btn-ghost btn-full">Continue Exploring</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {payState.kind === 'verifying' && (
        <div className="pay-verifying" role="status" aria-live="polite">
          <div className="pay-verifying-card">
            <span className="pay-spinner" aria-hidden />
            <strong>Confirming your payment…</strong>
            <span>Please don&apos;t close or refresh this page.</span>
          </div>
        </div>
      )}
      
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
