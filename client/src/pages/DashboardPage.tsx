import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { updateKyc, uploadKycDematProof } from '../api/auth';
import { getOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, getOrderDate, validateDemat, validatePAN } from '../utils/format';
import { getOrderStatusClass, getOrderStatusLabel, canViewInvoice } from '../utils/orderStatus';
import AutofillBlocker from '../components/forms/AutofillBlocker';
import { blockTextInput } from '../utils/autofill';
import { getInvoiceByOrder, type Invoice } from '../api/invoices';
import InvoicePrintView from './admin/components/InvoicePrintView';
import KycDetailsCard from '../components/kyc/KycDetailsCard';

function validateIfsc(ifsc: string) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

/** Holdings: Transfer Pending / Confirmed / Completed (paid + in demat queue or done). */
function isPortfolioHolding(o: { status: string; orderSource?: string; method?: string }) {
  const s = o.status.toLowerCase();
  if (/cancel|reject|refund/.test(s)) return false;
  if (s.includes('complete')) return true;
  // Waiting for admin — never a holding
  if (s.includes('pending') && s.includes('verif')) return false;
  if (s.includes('pending') && !s.includes('transfer')) return false;
  // After admin Verify → Transfer Pending / Confirmed counts as confirmed holding
  if (s.includes('transfer') || s.includes('confirm') || s.includes('verif')) return true;
  return false;
}

/** Show online orders awaiting admin UTR verification under “pending”. */
function isPortfolioPendingVisible(o: { status: string; orderSource?: string; method?: string }) {
  if (isPortfolioHolding(o)) return false;
  const s = o.status.toLowerCase();
  if (/cancel|reject|refund|complete/.test(s)) return false;
  // Pending Verification (UTR submitted, admin not yet approved)
  if (s.includes('pending') && s.includes('verif')) return true;
  if (s.includes('pending') && !s.includes('transfer')) return true;
  return false;
}

export default function DashboardPage() {
  const { user, setUser, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'kyc' ? 'kyc' : 'portfolio';

  const [kycForm, setKycForm] = useState({
    pan: user?.kycPan || '',
    demat: user?.kycDemat || '',
    bankName: user?.bankName || '',
    bankAccount: user?.bankAccount || '',
    ifsc: user?.ifsc || '',
    dematProof: user?.kycDematProof || '',
  });
  const [kycError, setKycError] = useState('');
  const [proofUploading, setProofUploading] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState<string | null>(null);

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoice(orderId);
    try {
      const res = await getInvoiceByOrder(orderId);
      if (res.invoiceId) {
        setViewingInvoice(res);
      } else {
        showToast('Invoice not found', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not fetch invoice', 'error');
    } finally {
      setLoadingInvoice(null);
    }
  };
  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', {
        replace: true,
        state: { from: '/dashboard', reason: 'portfolio' },
      });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      setKycForm({
        pan: user.kycPan || '',
        demat: user.kycDemat || '',
        bankName: user.bankName || '',
        bankAccount: user.bankAccount || '',
        ifsc: user.ifsc || '',
        dematProof: user.kycDematProof || '',
      });
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="view" id="view-dashboard">
        <div className="page-header">
          <p className="page-subtitle">Loading your portfolio…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // getOrders already returns only this buyer's rows (user_id / phone / email) — don't drop them again
  const myOrders = (ordersQuery.data || []).filter((o) => !o.deletedAt);
  const holdings = myOrders.filter((o) => isPortfolioHolding(o));
  const pendingOrders = myOrders.filter((o) => isPortfolioPendingVisible(o));
  const portfolioVisible = holdings.length + pendingOrders.length > 0;

  const totalInvested = holdings.reduce((sum, o) => sum + (o.totalPaid || o.total || 0), 0);
  const kycLabel =
    user.kycStatus === 'Rejected' && user.kycRejectReason
      ? `Rejected — ${user.kycRejectReason}`
      : user.kycStatus || 'Pending';

  const submitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePAN(kycForm.pan)) {
      setKycError('Invalid PAN format (e.g. ABCDE1234F)');
      return;
    }
    if (!validateDemat(kycForm.demat)) {
      setKycError('Demat account must be 16 digits');
      return;
    }
    if (kycForm.bankName.trim().length < 2) {
      setKycError('Enter your bank name (e.g. HDFC Bank, SBI)');
      return;
    }
    const accountDigits = kycForm.bankAccount.replace(/\D/g, '');
    if (accountDigits.length < 9 || accountDigits.length > 18) {
      setKycError('Enter a valid bank account number (9–18 digits)');
      return;
    }
    if (!validateIfsc(kycForm.ifsc)) {
      setKycError('Invalid IFSC (e.g. SBIN0001234)');
      return;
    }
    if (!kycForm.dematProof) {
      setKycError('Upload CMR / demat proof before submitting');
      return;
    }
    setKycSubmitting(true);
    try {
      const res = await updateKyc({
        pan: kycForm.pan.toUpperCase(),
        demat: kycForm.demat.replace(/\D/g, ''),
        bankAccount: accountDigits,
        bankName: kycForm.bankName.trim(),
        ifsc: kycForm.ifsc.toUpperCase(),
        kycDematProof: kycForm.dematProof,
      });
      if (res.success) {
        setUser({
          ...user,
          kycStatus: res.kycStatus || 'Under Review',
          kycRejectReason: undefined,
          kycPan: kycForm.pan.toUpperCase(),
          kycDemat: kycForm.demat.replace(/\D/g, ''),
          kycDematProof: kycForm.dematProof,
          bankName: kycForm.bankName.trim(),
          bankAccount: accountDigits,
          ifsc: kycForm.ifsc.toUpperCase(),
        });
        showToast('KYC submitted for review', 'success');
        setKycError('');
      }
    } catch (err) {
      setKycError(err instanceof Error ? err.message : 'KYC submission failed');
    } finally {
      setKycSubmitting(false);
    }
  };

  const handleProofUpload = async (file: File | null) => {
    if (!file) return;
    setProofUploading(true);
    setKycError('');
    try {
      const res = await uploadKycDematProof(file);
      setKycForm((prev) => ({ ...prev, dematProof: res.url }));
      showToast('Demat proof uploaded', 'success');
    } catch (err) {
      setKycError(err instanceof Error ? err.message : 'Proof upload failed');
    } finally {
      setProofUploading(false);
    }
  };

  const refreshOrders = () => ordersQuery.refetch();

  return (
    <div className="view" id="view-orders">
      <div className="page-header">
        <div className="page-header-inner">
          <h1 className="page-title" id="dashboard-title">My Dashboard</h1>
          <p className="page-subtitle" id="dashboard-subtitle">
            Track your share purchases and manage your KYC compliance status.
          </p>
        </div>
      </div>

      <div className="dashboard-tabs" id="dashboard-tabs">
        <button type="button" className={`dashboard-tab${tab === 'portfolio' ? ' active' : ''}`} onClick={() => setParams({})}>
          Portfolio
        </button>
        <button type="button" className={`dashboard-tab${tab === 'kyc' ? ' active' : ''}`} onClick={() => setParams({ tab: 'kyc' })}>
          KYC Verification
        </button>
        <Link to="/dashboard/support" className="dashboard-tab dashboard-tab-link">
          Support
        </Link>
      </div>

      <div className="orders-wrap">
      {tab === 'portfolio' && (
        <div id="orders-tab-content">
          <div className="portfolio-summary">
            {[
              { label: 'Total Invested', value: formatCurrency(totalInvested) },
              { label: 'Holdings', value: String(holdings.length) },
              { label: 'Pending Orders', value: String(pendingOrders.length) },
              { label: 'KYC Status', value: kycLabel, isKyc: true },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <label>{s.label}</label>
                <strong className={s.isKyc ? `kyc-status ${user.kycStatus?.toLowerCase().replace(' ', '-')}` : ''}>
                  {s.value}
                </strong>
              </div>
            ))}
          </div>

          {myOrders.length > 0 && (
            <div className="dashboard-orders-toolbar">
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Auto-refreshes every minute</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={refreshOrders} disabled={ordersQuery.isFetching}>
                {ordersQuery.isFetching ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          )}

          {!portfolioVisible ? (
            <div className="empty-state glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>No investments yet. Start building your pre-IPO portfolio.</p>
              <Link to="/shares" className="btn btn-primary">Explore Shares</Link>
            </div>
          ) : (
            <>
              {/* ===== MY HOLDINGS (Confirmed / Completed only) ===== */}
              <h3 style={{ margin: '1.5rem 0 0.75rem', color: 'var(--text)', fontSize: '1.1rem' }}>📈 My Holdings</h3>
              {holdings.length === 0 ? (
                <div className="empty-state glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
                  <p style={{ color: 'var(--muted)', margin: 0 }}>No confirmed holdings yet. After you pay and submit UTR, admin verifies payment — then shares appear here as confirmed.</p>
                </div>
              ) : (
                <>
                  <div className="orders-table-wrap dashboard-orders-table">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Company</th>
                          <th>Qty</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Date / Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((o) => (
                          <tr key={o.orderId}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.orderId}</td>
                            <td style={{ fontWeight: 600 }}>{o.companyName || o.shareName}</td>
                            <td>{o.qty}</td>
                            <td style={{ color: 'var(--accent)' }}>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
                                <span className={`status-badge ${getOrderStatusClass(o.status)}`}>
                                  {getOrderStatusLabel(o.status)}
                                </span>
                                {canViewInvoice(o.status) && (
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: 'auto' }}
                                    onClick={() => handleViewInvoice(o.orderId)}
                                    disabled={loadingInvoice === o.orderId}
                                  >
                                    {loadingInvoice === o.orderId ? '...' : 'View Invoice'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatDateTime(getOrderDate(o))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="dashboard-orders-cards">
                    {holdings.map((o) => (
                      <div key={o.orderId} className="order-card dashboard-order-card">
                        <div className="order-card-top">
                          <strong>{o.companyName || o.shareName}</strong>
                          <span className={`status-badge ${getOrderStatusClass(o.status)}`}>
                            {getOrderStatusLabel(o.status)}
                          </span>
                        </div>
                        <div className="dashboard-order-meta">
                          <div><span>Order</span><strong style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</strong></div>
                          <div><span>Qty</span><strong>{o.qty}</strong></div>
                          <div><span>Total</span><strong style={{ color: 'var(--accent)' }}>{formatCurrency(o.totalPaid || o.total || 0)}</strong></div>
                          <div><span>Date / Time</span><strong>{formatDateTime(getOrderDate(o))}</strong></div>
                          {canViewInvoice(o.status) && (
                            <div style={{ marginTop: '0.5rem', textAlign: 'right', gridColumn: '1 / -1' }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => handleViewInvoice(o.orderId)}
                                disabled={loadingInvoice === o.orderId}
                              >
                                {loadingInvoice === o.orderId ? 'Loading...' : 'View Invoice'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ===== ORDER HISTORY (Pending / Rejected / Cancelled) ===== */}
              {pendingOrders.length > 0 && (
                <>
                  <h3 style={{ margin: '2rem 0 0.75rem', color: 'var(--text)', fontSize: '1.1rem' }}>🕐 Pending Orders</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>Orders that need attention (rejected / cancelled) or are still waiting on ops.</p>
                  <div className="orders-table-wrap dashboard-orders-table">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Company</th>
                          <th>Qty</th>
                          <th>Total</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Date / Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((o) => (
                          <tr key={o.orderId}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.orderId}</td>
                            <td style={{ fontWeight: 600 }}>{o.companyName || o.shareName}</td>
                            <td>{o.qty}</td>
                            <td style={{ color: 'var(--accent)' }}>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                            <td>{o.method || o.paymentMethod || '—'}</td>
                            <td>
                              <span className={`status-badge ${getOrderStatusClass(o.status)}`}>
                                {getOrderStatusLabel(o.status)}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{formatDateTime(getOrderDate(o))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="dashboard-orders-cards">
                    {pendingOrders.map((o) => (
                      <div key={o.orderId} className="order-card dashboard-order-card">
                        <div className="order-card-top">
                          <strong>{o.companyName || o.shareName}</strong>
                          <span className={`status-badge ${getOrderStatusClass(o.status)}`}>
                            {getOrderStatusLabel(o.status)}
                          </span>
                        </div>
                        <div className="dashboard-order-meta">
                          <div><span>Order</span><strong style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{o.orderId}</strong></div>
                          <div><span>Qty</span><strong>{o.qty}</strong></div>
                          <div><span>Total</span><strong style={{ color: 'var(--accent)' }}>{formatCurrency(o.totalPaid || o.total || 0)}</strong></div>
                          <div><span>Payment</span><strong>{o.method || o.paymentMethod || '—'}</strong></div>
                          <div><span>Date / Time</span><strong>{formatDateTime(getOrderDate(o))}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'kyc' && (
        <div id="kyc-tab-content">
          <div className={`kyc-banner${user.kycStatus === 'Rejected' ? ' kyc-banner-rejected' : ''}`}>
            KYC Status: <strong>{user.kycStatus}</strong>
            {user.kycStatus === 'Under Review' && ' — Our team will verify within 2-4 business hours.'}
            {user.kycStatus === 'Rejected' && user.kycRejectReason && (
              <> — <strong>{user.kycRejectReason}</strong>. Please fix and resubmit below.</>
            )}
          </div>

          {user.kycStatus === 'Verified' ? (
            <KycDetailsCard user={user} mode="verified" />
          ) : user.kycStatus === 'Under Review' ? (
            <KycDetailsCard user={user} mode="review" />
          ) : (
            <form className="kyc-form" onSubmit={submitKyc} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              {user.kycStatus === 'Rejected' && user.kycRejectReason && (
                <div className="form-error show" style={{ marginBottom: '1rem' }}>
                  Rejected — {user.kycRejectReason}. Update your details and resubmit.
                </div>
              )}
              {kycError && <div className="form-error show">{kycError}</div>}

              <p className="kyc-form-intro">
                Fill PAN, demat, bank details, and upload your CMR / Client Master Report (or demat screenshot). Bank account and demat must belong to the same person.
              </p>

              <div className="form-group">
                <label>PAN Number *</label>
                <input
                  className="form-input"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  required
                  value={kycForm.pan}
                  onChange={(e) => setKycForm({ ...kycForm, pan: e.target.value.toUpperCase() })}
                  {...blockTextInput({ name: 'kyc-pan' })}
                />
              </div>

              <div className="form-group">
                <label>Demat Account (16 digits) *</label>
                <input
                  className="form-input"
                  placeholder="1234567890123456"
                  maxLength={16}
                  required
                  value={kycForm.demat}
                  onChange={(e) => setKycForm({ ...kycForm, demat: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  {...blockTextInput({ name: 'kyc-demat' })}
                />
              </div>

              <div className="form-group">
                <label>CMR / Demat proof *</label>
                <p className="kyc-field-hint">Upload Client Master Report (CMR/CML) or demat account screenshot from your broker. JPG, PNG, WEBP or PDF — max 5MB.</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  className="form-input kyc-file-input"
                  disabled={proofUploading || kycSubmitting}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    void handleProofUpload(f);
                    e.target.value = '';
                  }}
                />
                {proofUploading && <p className="kyc-upload-status">Uploading…</p>}
                {kycForm.dematProof && !proofUploading && (
                  <div className="kyc-proof-uploaded">
                    <span>Proof uploaded</span>
                    <a href={`/${kycForm.dematProof}`} target="_blank" rel="noopener noreferrer">Preview</a>
                    {/\.(jpe?g|png|webp)$/i.test(kycForm.dematProof) && (
                      <img src={`/${kycForm.dematProof}`} alt="Demat proof preview" className="kyc-proof-thumb" />
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Bank Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. HDFC Bank, State Bank of India"
                  required
                  value={kycForm.bankName}
                  onChange={(e) => setKycForm({ ...kycForm, bankName: e.target.value })}
                  {...blockTextInput({ name: 'kyc-bank-name' })}
                />
              </div>

              <div className="form-group">
                <label>Bank Account Number *</label>
                <input
                  className="form-input"
                  placeholder="Account number linked to demat"
                  required
                  value={kycForm.bankAccount}
                  onChange={(e) => setKycForm({ ...kycForm, bankAccount: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                  {...blockTextInput({ name: 'kyc-bank' })}
                />
              </div>

              <div className="form-group">
                <label>IFSC Code *</label>
                <input
                  className="form-input"
                  placeholder="SBIN0001234"
                  maxLength={11}
                  required
                  value={kycForm.ifsc}
                  onChange={(e) => setKycForm({ ...kycForm, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })}
                  {...blockTextInput({ name: 'kyc-ifsc' })}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={proofUploading || kycSubmitting}>
                {kycSubmitting
                  ? 'Submitting…'
                  : user.kycStatus === 'Rejected'
                    ? 'Resubmit KYC'
                    : 'Submit KYC for Review'}
              </button>
            </form>
          )}
        </div>
      )}
      </div>

      {viewingInvoice && (
        <InvoicePrintView
          invoice={viewingInvoice}
          readOnly={true}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  );
}
