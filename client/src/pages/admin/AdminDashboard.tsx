import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getOrders, updateOrderStatus } from '../../api/orders';
import { getUsers, mapApiUser } from '../../api/admin';
import { getInitiatedCheckouts } from '../../api/initiated';
import { getSettings, getMailStatus, saveSettings, testSmtp, uploadQr } from '../../api/content';
import { useAdminPanel } from '../../context/AdminPanelContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import { isPendingOrder } from '../../utils/orderStatus';
import { blockAutofillOnFocus, blockTextInput } from '../../utils/autofill';
import AutofillBlocker from '../../components/forms/AutofillBlocker';
import AdminEmployees from './AdminEmployees';
import AdminAccessDenied from './components/AdminAccessDenied';
import AdminSectionHeader from './components/AdminSectionHeader';
import AdminOrdersSection from './components/AdminOrdersSection';
import AdminUsersPanel from './components/AdminUsersPanel';
import AdminInitiatedPanel from './panels/AdminInitiatedPanel';
import AdminManualOrderPanel from './panels/AdminManualOrderPanel';
import AdminCancelRefundPanel from './panels/AdminCancelRefundPanel';
import AdminArticlesPanel from './panels/AdminArticlesPanel';
import AdminReportsPanel from './panels/AdminReportsPanel';
import AdminSharePricesPanel from './panels/AdminSharePricesPanel';
import AdminInventoryPanel from './panels/AdminInventoryPanel';
import AdminInvoicesPanel from './panels/AdminInvoicesPanel';

export default function AdminDashboard() {
  const { activePanel, setActivePanel, can, canAccessPanel, isMaster } = useAdminPanel();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrVersion, setQrVersion] = useState(0);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: getOrders,
    enabled: can('orders') || can('pending') || can('dashboard') || can('manual-order') || can('cancel-refund'),
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await getUsers()).map(mapApiUser),
    enabled: can('users') || can('dashboard'),
  });
  const initiatedQuery = useQuery({
    queryKey: ['initiated-checkouts'],
    queryFn: getInitiatedCheckouts,
    enabled: can('initiated'),
  });
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getSettings,
    enabled: can('settings'),
  });

  const mailStatusQuery = useQuery({
    queryKey: ['mail-status'],
    queryFn: getMailStatus,
    enabled: isMaster && can('settings'),
  });

  const orders = ordersQuery.data || [];
  const users = usersQuery.data || [];
  const initiated = initiatedQuery.data || [];
  const pendingOrders = orders.filter((o) => isPendingOrder(o.status));
  const confirmedOrders = orders.filter((o) => {
    const s = o.status.toLowerCase();
    return s.includes('confirm') || s.includes('transfer') || s.includes('completed');
  });
  const confirmedRevenue = confirmedOrders.reduce((s, o) => s + (o.totalPaid || 0), 0);
  const totalOrderValue = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
  const recentSignups = [...users]
    .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    .slice(0, 5);

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      showToast('Order updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const verify = (id: string) => statusMutation.mutate({ orderId: id, status: 'Confirmed' });
  const reject = (id: string) => statusMutation.mutate({ orderId: id, status: 'Rejected' });

  const saveSiteSettings = async () => {
    try {
      await saveSettings({ ...settingsQuery.data, ...settingsForm });
      showToast('Settings saved', 'success');
      settingsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['siteSettings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    }
  };

  const settingsVal = (key: string) => settingsForm[key] ?? settingsQuery.data?.[key] ?? '';

  if (!canAccessPanel(activePanel)) {
    return <AdminAccessDenied />;
  }

  if (activePanel === 'initiated') return <AdminInitiatedPanel />;
  if (activePanel === 'manual-order') return <AdminManualOrderPanel />;
  if (activePanel === 'cancel-refund') return <AdminCancelRefundPanel />;
  if (activePanel === 'articles') return <AdminArticlesPanel />;
  if (activePanel === 'reports') return <AdminReportsPanel />;
  if (activePanel === 'prices') return <AdminSharePricesPanel />;
  if (activePanel === 'inventory') return <AdminInventoryPanel />;
  if (activePanel === 'invoices') return <AdminInvoicesPanel />;
  if (activePanel === 'employees') return <AdminEmployees />;

  return (
    <>
      {activePanel === 'dashboard' && (
        <>
          <AdminSectionHeader
            compact
            title="Orders · Signups · Revenue"
            subtitle="No order lists here — use Verify Payments or All Orders in the sidebar"
          />
          <div className="stats-grid stats-grid--dashboard">
            <div className="stat-card stat-card-highlight">
              <div className="stat-value">{orders.length}</div>
              <div className="stat-label">Orders</div>
              <div className="stat-sub">{pendingOrders.length} pending · {confirmedOrders.length} confirmed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{users.length}</div>
              <div className="stat-label">User Signups</div>
              <div className="stat-sub">Registered investors</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatCurrency(confirmedRevenue)}</div>
              <div className="stat-label">Revenue</div>
              <div className="stat-sub">
                Confirmed payments
                {totalOrderValue > confirmedRevenue ? ` · ${formatCurrency(totalOrderValue)} all orders` : ''}
              </div>
            </div>
          </div>

          <div className="dashboard-summary-grid">
            <div className="dashboard-summary-card">
              <h3>At a glance</h3>
              <div className="dashboard-mini-stats">
                <div>
                  <span>Pending payments</span>
                  <strong>{pendingOrders.length}</strong>
                </div>
                <div>
                  <span>Pending order value</span>
                  <strong>{formatCurrency(pendingOrders.reduce((s, o) => s + (o.totalPaid || 0), 0))}</strong>
                </div>
                <div>
                  <span>Initiate</span>
                  <strong>{initiated.length}</strong>
                </div>
              </div>
              <div className="dashboard-quick-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActivePanel('pending')}>
                  Verify Payments
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActivePanel('orders')}>
                  All Orders
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActivePanel('users')}>
                  Users &amp; KYC
                </button>
              </div>
            </div>
            <div className="dashboard-summary-card">
              <h3>Recent signups</h3>
              {!recentSignups.length ? (
                <p className="dashboard-summary-note">No users yet.</p>
              ) : (
                <ul className="dashboard-signup-list">
                  {recentSignups.map((u) => (
                    <li key={u.id}>
                      <strong>{u.name || 'Investor'}</strong>
                      <span>{u.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {activePanel === 'pending' && (
        <>
          <AdminSectionHeader compact title="Verify Payments" subtitle="Search UTR from bank SMS, open row, confirm payment and KYC" badge={`${pendingOrders.length} pending`} />
          <AdminOrdersSection orders={pendingOrders} users={users} showActions onVerify={verify} onReject={reject} />
        </>
      )}

      {activePanel === 'orders' && (
        <>
          <AdminSectionHeader compact title="All Orders" subtitle="Full order history with search and filters" badge={`${orders.length} total`} />
          <AdminOrdersSection orders={orders} users={users} />
        </>
      )}

      {activePanel === 'users' && <AdminUsersPanel users={users} />}

      {activePanel === 'settings' && (
        <div className="report-filter-box" style={{ position: 'relative' }}>
          <div className="report-filter-title">Site settings</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '-0.5rem 0 1rem' }}>
            Contact details, bank info, and disclaimer shown on checkout, footer, and WhatsApp.
          </p>
          <AutofillBlocker />
          <div className="report-filter-title">Contact & WhatsApp</div>
          <div className="report-filter-grid">
            {[['email', 'Email'], ['mobile', 'Phone / WhatsApp'], ['whatsapp', 'WhatsApp number (digits only)'], ['address', 'Address']].map(([key, label]) => (
              <div className="report-filter-group" key={key} style={key === 'address' ? { gridColumn: 'span 2' } : undefined}>
                <label className="report-filter-label">{label}</label>
                <input className="report-filter-input" value={settingsVal(key)} onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })} {...blockTextInput({ name: `settings-${key}` })} />
              </div>
            ))}
          </div>
          <div className="report-filter-title" style={{ marginTop: '1.5rem' }}>Bank & UPI (shown at checkout)</div>
          <div className="report-filter-grid">
            {[['bank_name', 'Bank Name'], ['bank_ac_name', 'Account Name'], ['bank_ac_no', 'Account No'], ['bank_ifsc', 'IFSC'], ['bank_upi', 'UPI ID'], ['bank_branch', 'Branch']].map(([key, label]) => (
              <div className="report-filter-group" key={key}><label className="report-filter-label">{label}</label><input className="report-filter-input" value={settingsVal(key)} onChange={(e) => setSettingsForm({ ...settingsForm, [key]: e.target.value })} {...blockTextInput({ name: `settings-${key}` })} /></div>
            ))}
            <div className="report-filter-group" style={{ gridColumn: 'span 2' }}><label className="report-filter-label">Branch Address</label><input className="report-filter-input" value={settingsVal('bank_address')} onChange={(e) => setSettingsForm({ ...settingsForm, bank_address: e.target.value })} {...blockTextInput({ name: 'settings-bank-address' })} /></div>
          </div>
          <div className="qr-upload-box">
            <h4>UPI QR Code</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <img src={`/QR.jpeg?v=${qrVersion}`} alt="QR" className="qr-preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div><input type="file" accept="image/jpeg,image/png" onChange={(e) => setQrFile(e.target.files?.[0] || null)} /><br /><button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={async () => { if (!qrFile) return showToast('Select file', 'warning'); await uploadQr(qrFile); setQrVersion(Date.now()); showToast('QR updated', 'success'); }}>Upload</button></div>
            </div>
          </div>
          <div className="report-filter-group" style={{ marginTop: '1rem' }}><label className="report-filter-label">Disclaimer (footer + checkout)</label><textarea className="report-filter-input" rows={4} value={settingsVal('disclaimer')} onChange={(e) => setSettingsForm({ ...settingsForm, disclaimer: e.target.value })} autoComplete="off" {...blockAutofillOnFocus} /></div>

          {isMaster && (
            <div className="report-filter-box" style={{ marginTop: '1.5rem', padding: '1rem' }}>
              <div className="report-filter-title">Email / OTP (SMTP)</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
                OTP emails are sent from <strong>info@go-unlisted.com</strong> via Hostinger SMTP.
                Edit <code>api/mail_config.php</code> on the server with the mailbox password.
              </p>
              <p style={{ fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                Status:{' '}
                <strong style={{ color: mailStatusQuery.data?.smtp_configured ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)' }}>
                  {mailStatusQuery.data?.smtp_configured ? 'SMTP configured' : 'SMTP not configured — OTP emails will fail'}
                </strong>
                {mailStatusQuery.data?.mail_from ? ` · From: ${mailStatusQuery.data.mail_from}` : ''}
              </p>
              <div className="report-filter-grid" style={{ alignItems: 'end' }}>
                <div className="report-filter-group" style={{ gridColumn: 'span 2' }}>
                  <label className="report-filter-label">Send test email</label>
                  <input
                    className="report-filter-input"
                    type="email"
                    placeholder="you@example.com"
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    {...blockTextInput({ name: 'smtp-test-email' })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={smtpTesting || !smtpTestEmail.trim()}
                  onClick={async () => {
                    setSmtpTesting(true);
                    try {
                      const res = await testSmtp(smtpTestEmail.trim());
                      showToast(res.message || 'Test email sent', 'success');
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : 'SMTP test failed', 'error');
                    } finally {
                      setSmtpTesting(false);
                    }
                  }}
                >
                  {smtpTesting ? 'Sending...' : 'Test SMTP'}
                </button>
              </div>
            </div>
          )}

          <div className="report-filter-actions"><button type="button" className="btn btn-primary" onClick={saveSiteSettings}>Save Settings</button></div>
        </div>
      )}
    </>
  );
}
