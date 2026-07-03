import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getOrders, updateOrderStatus } from '../../api/orders';
import { getUsers, mapApiUser } from '../../api/admin';
import { getInitiatedCheckouts } from '../../api/initiated';
import { getSettings, saveSettings, uploadQr } from '../../api/content';
import { useAdminPanel } from '../../context/AdminPanelContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import { isPendingOrder } from '../../utils/orderStatus';
import { blockAutofillOnFocus, blockTextInput } from '../../utils/autofill';
import AutofillBlocker from '../../components/forms/AutofillBlocker';
import AdminEmployees from './AdminEmployees';
import AdminSectionHeader from './components/AdminSectionHeader';
import AdminOrdersSection from './components/AdminOrdersSection';
import AdminUsersPanel from './components/AdminUsersPanel';
import AdminInitiatedPanel from './panels/AdminInitiatedPanel';
import AdminManualOrderPanel from './panels/AdminManualOrderPanel';
import AdminCancelRefundPanel from './panels/AdminCancelRefundPanel';
import AdminArticlesPanel from './panels/AdminArticlesPanel';
import AdminReportsPanel from './panels/AdminReportsPanel';
import AdminSharePricesPanel from './panels/AdminSharePricesPanel';

export default function AdminDashboard() {
  const { activePanel } = useAdminPanel();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrVersion, setQrVersion] = useState(0);

  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getOrders });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await getUsers()).map(mapApiUser) });
  const initiatedQuery = useQuery({ queryKey: ['initiated-checkouts'], queryFn: getInitiatedCheckouts });
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: getSettings });

  const orders = ordersQuery.data || [];
  const users = usersQuery.data || [];
  const initiated = initiatedQuery.data || [];
  const pendingOrders = orders.filter((o) => isPendingOrder(o.status));
  const confirmedRevenue = orders.filter((o) => o.status.toLowerCase().includes('confirm')).reduce((s, o) => s + (o.totalPaid || 0), 0);

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      showToast('Order updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
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

  if (activePanel === 'initiated') return <AdminInitiatedPanel />;
  if (activePanel === 'manual-order') return <AdminManualOrderPanel />;
  if (activePanel === 'cancel-refund') return <AdminCancelRefundPanel />;
  if (activePanel === 'articles') return <AdminArticlesPanel />;
  if (activePanel === 'reports') return <AdminReportsPanel />;
  if (activePanel === 'prices') return <AdminSharePricesPanel />;
  if (activePanel === 'employees') return <AdminEmployees />;

  return (
    <>
      {activePanel === 'dashboard' && (
        <>
          <div className="stats-grid">
            <div className="stat-card stat-card-highlight"><div className="stat-value">{pendingOrders.length}</div><div className="stat-label">Awaiting Verification</div></div>
            <div className="stat-card"><div className="stat-value">{initiated.length}</div><div className="stat-label">Abandoned Checkouts</div></div>
            <div className="stat-card"><div className="stat-value">{users.length}</div><div className="stat-label">Registered Users</div></div>
            <div className="stat-card"><div className="stat-value">{formatCurrency(confirmedRevenue)}</div><div className="stat-label">Confirmed Revenue</div></div>
          </div>
          <div className="admin-workflow-hint">
            <strong>Today's workflow:</strong> Verify payments → Approve KYC → Initiate demat transfer → Follow up abandoned checkouts
          </div>
          <AdminSectionHeader compact title="Payments to Verify" subtitle="Click a row for buyer, UTR, and KYC details" badge={`${pendingOrders.length} pending`} />
          <AdminOrdersSection orders={pendingOrders} users={users} showActions onVerify={verify} onReject={reject} limit={6} />
          <AdminSectionHeader compact title="Recent Orders" subtitle="Latest activity across the platform" />
          <AdminOrdersSection orders={orders} users={users} limit={5} />
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
          <div className="report-filter-actions"><button type="button" className="btn btn-primary" onClick={saveSiteSettings}>Save Settings</button></div>
        </div>
      )}
    </>
  );
}
