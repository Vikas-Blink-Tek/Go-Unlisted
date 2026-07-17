import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { updateKyc } from '../api/auth';
import { getOrders } from '../api/orders';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, getOrderDate, validateDemat, validatePAN } from '../utils/format';
import { getOrderStatusClass, getOrderStatusLabel, canViewInvoice } from '../utils/orderStatus';
import AutofillBlocker from '../components/forms/AutofillBlocker';
import { blockTextInput } from '../utils/autofill';
import { getInvoiceByOrder, type Invoice } from '../api/invoices';
import InvoicePrintView from './admin/components/InvoicePrintView';
function orderMatchesUser(
  o: { buyerEmail?: string; buyerPhone?: string },
  user: { email: string; phone?: string },
): boolean {
  const emailMatch = o.buyerEmail && user.email && o.buyerEmail.toLowerCase() === user.email.toLowerCase();
  const phoneMatch =
    o.buyerPhone &&
    user.phone &&
    o.buyerPhone.replace(/\D/g, '').slice(-10) === user.phone.replace(/\D/g, '').slice(-10);
  return Boolean(emailMatch || phoneMatch);
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
    bankAccount: user?.bankAccount || '',
    ifsc: user?.ifsc || '',
  });
  const [kycError, setKycError] = useState('');

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
    refetchInterval: 60_000,
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
        bankAccount: user.bankAccount || '',
        ifsc: user.ifsc || '',
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

  const myOrders = (ordersQuery.data || []).filter((o) => orderMatchesUser(o, user));
  const totalInvested = myOrders.reduce((sum, o) => sum + (o.totalPaid || o.total || 0), 0);
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
    try {
      const res = await updateKyc(
        kycForm.pan.toUpperCase(),
        kycForm.demat,
        kycForm.bankAccount,
        kycForm.ifsc.toUpperCase(),
      );
      if (res.success) {
        setUser({
          ...user,
          kycStatus: res.kycStatus || 'Under Review',
          kycRejectReason: undefined,
          kycPan: kycForm.pan.toUpperCase(),
          kycDemat: kycForm.demat,
          bankAccount: kycForm.bankAccount,
          ifsc: kycForm.ifsc.toUpperCase(),
        });
        showToast('KYC submitted for review', 'success');
        setKycError('');
      }
    } catch (err) {
      setKycError(err instanceof Error ? err.message : 'KYC submission failed');
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
              { label: 'Orders', value: String(myOrders.length) },
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

          {myOrders.length === 0 ? (
            <div className="empty-state glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>No investments yet. Start building your pre-IPO portfolio.</p>
              <Link to="/shares" className="btn btn-primary">Explore Shares</Link>
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
                      <th>UTR</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Date / Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myOrders.map((o) => (
                      <tr key={o.orderId}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.orderId}</td>
                        <td style={{ fontWeight: 600 }}>{o.companyName || o.shareName}</td>
                        <td>{o.qty}</td>
                        <td style={{ color: 'var(--accent)' }}>{formatCurrency(o.totalPaid || o.total || 0)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.transactionId || ''}>{o.transactionId || '—'}</td>
                        <td>{o.method || o.paymentMethod || '—'}</td>
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
                {myOrders.map((o) => (
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
                      <div><span>UTR</span><strong style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.transactionId || '—'}</strong></div>
                      <div><span>Payment</span><strong>{o.method || o.paymentMethod || '—'}</strong></div>
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
            <div className="kyc-form text-center">
              <p>Your KYC is verified. You can invest freely.</p>
            </div>
          ) : user.kycStatus === 'Under Review' ? (
            <div className="kyc-form">
              <h3 style={{ color: 'var(--white)', marginBottom: '1rem' }}>Submitted Profile Details</h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p><span style={{ color: 'var(--text-dim)' }}>PAN:</span> <strong>{user.kycPan || kycForm.pan}</strong></p>
                <p><span style={{ color: 'var(--text-dim)' }}>Demat:</span> <strong>{user.kycDemat ? `****${user.kycDemat.slice(-4)}` : '—'}</strong></p>
                <p><span style={{ color: 'var(--text-dim)' }}>Bank Account:</span> <strong>{user.bankAccount ? `****${user.bankAccount.slice(-4)}` : '—'}</strong></p>
                <p><span style={{ color: 'var(--text-dim)' }}>IFSC:</span> <strong>{user.ifsc || '—'}</strong></p>
              </div>
            </div>
          ) : (
            <form className="kyc-form" onSubmit={submitKyc} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              {user.kycStatus === 'Rejected' && user.kycRejectReason && (
                <div className="form-error show" style={{ marginBottom: '1rem' }}>
                  Rejected — {user.kycRejectReason}. Update your details and resubmit.
                </div>
              )}
              {kycError && <div className="form-error show">{kycError}</div>}
              <div className="form-group">
                <label>PAN Number</label>
                <input className="form-input" placeholder="ABCDE1234F" value={kycForm.pan} onChange={(e) => setKycForm({ ...kycForm, pan: e.target.value.toUpperCase() })} {...blockTextInput({ name: 'kyc-pan' })} />
              </div>
              <div className="form-group">
                <label>Demat Account (16 digits)</label>
                <input className="form-input" placeholder="1234567890123456" value={kycForm.demat} onChange={(e) => setKycForm({ ...kycForm, demat: e.target.value })} {...blockTextInput({ name: 'kyc-demat' })} />
              </div>
              <div className="form-group">
                <label>Bank Account Number</label>
                <input className="form-input" value={kycForm.bankAccount} onChange={(e) => setKycForm({ ...kycForm, bankAccount: e.target.value })} {...blockTextInput({ name: 'kyc-bank' })} />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input className="form-input" placeholder="SBIN0001234" value={kycForm.ifsc} onChange={(e) => setKycForm({ ...kycForm, ifsc: e.target.value.toUpperCase() })} {...blockTextInput({ name: 'kyc-ifsc' })} />
              </div>
              <button type="submit" className="btn btn-primary btn-lg">
                {user.kycStatus === 'Rejected' ? 'Resubmit KYC' : 'Submit KYC for Review'}
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
