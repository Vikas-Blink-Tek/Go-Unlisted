import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '../../../api/orders';
import { getUsers, mapApiUser } from '../../../api/admin';
import { getInitiatedCheckouts } from '../../../api/initiated';
import { exportCsv } from '../../../utils/exportCsv';
import { formatCurrency, formatDateTime, getOrderDate, parseDbDateTime } from '../../../utils/format';
import { displayUserCode, DEFAULT_USER_CODE } from '../../../utils/userCode';
import AdminSectionHeader from '../components/AdminSectionHeader';

function referralSourceLabel(code?: string): string {
  const c = displayUserCode(code);
  return c === DEFAULT_USER_CODE ? 'Direct (website)' : `Referral (${c})`;
}

type ReportTab = 'users' | 'orders' | 'payments';

export default function AdminReportsPanel() {
  const [tab, setTab] = useState<ReportTab>('orders');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: async () => (await getUsers()).map(mapApiUser) });
  const ordersQuery = useQuery({ queryKey: ['admin-orders'], queryFn: getOrders });
  const initiatedQuery = useQuery({ queryKey: ['initiated-checkouts'], queryFn: getInitiatedCheckouts });

  const users = usersQuery.data || [];
  const orders = (ordersQuery.data || []).filter((o) => !o.deletedAt);
  const initiated = initiatedQuery.data || [];

  const payments = useMemo(() => [
    ...orders.map((o) => ({
      name: o.buyerName,
      phone: o.buyerPhone || '',
      email: o.buyerEmail || '',
      orderId: o.orderId,
      amount: o.totalPaid || 0,
      status: o.status,
      date: getOrderDate(o) || '',
      txnId: o.transactionId || o.orderId,
    })),
    ...initiated.map((i) => ({
      name: i.buyerName,
      phone: i.buyerPhone,
      email: i.buyerEmail,
      orderId: i.sessionId,
      amount: i.totalAmount,
      status: 'Initiated',
      date: i.initiatedAt,
      txnId: '—',
    })),
  ], [orders, initiated]);

  const inRange = (d: string) => {
    if (!d) return true;
    const t = parseDbDateTime(d)?.getTime();
    if (t === undefined) return true;
    if (dateFrom && t < new Date(dateFrom).getTime()) return false;
    if (dateTo && t > new Date(`${dateTo}T23:59:59+05:30`).getTime()) return false;
    return true;
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email.includes(q) && !u.phone.includes(q)) return false;
    return inRange(u.createdAt || '');
  });

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    if (q && !o.orderId.toLowerCase().includes(q) && !(o.buyerPhone || '').includes(q) && !(o.companyName || '').toLowerCase().includes(q)) return false;
    if (statusFilter && !o.status.toLowerCase().includes(statusFilter)) return false;
    return inRange(getOrderDate(o) || '');
  });

  const filteredPayments = payments.filter((p) => {
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.phone.includes(q) && !p.orderId.toLowerCase().includes(q)) return false;
    if (statusFilter && !p.status.toLowerCase().includes(statusFilter)) return false;
    return inRange(p.date);
  });

  const exportCurrent = () => {
    if (tab === 'users') {
      exportCsv('user-report.csv', ['Name', 'Email', 'Phone', 'Referral Code', 'Source', 'KYC', 'Joined'], filteredUsers.map((u) => [u.name, u.email, u.phone, displayUserCode(u.referralCode), referralSourceLabel(u.referralCode), u.kycStatus, u.createdAt || '']));
    } else if (tab === 'orders') {
      exportCsv('order-report.csv', ['Order ID', 'Buyer', 'Phone', 'Share', 'Qty', 'Amount', 'User Code', 'Source', 'Status', 'Date'], filteredOrders.map((o) => [o.orderId, o.buyerName, o.buyerPhone || '', o.companyName || '', o.qty, o.totalPaid || 0, displayUserCode(o.employeeCode), referralSourceLabel(o.employeeCode), o.status, getOrderDate(o) || '']));
    } else {
      exportCsv('payment-report.csv', ['Name', 'Phone', 'Email', 'Order/Session', 'Txn ID', 'Amount', 'Status', 'Date'], filteredPayments.map((p) => [p.name, p.phone, p.email, p.orderId, p.txnId, p.amount, p.status, p.date]));
    }
  };

  return (
    <div>
      <AdminSectionHeader compact title="Reports & Export" subtitle="Filter and download CSV reports for accounting and ops." />

      <div className="admin-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['users', 'orders', 'payments'] as ReportTab[]).map((t) => (
          <button key={t} type="button" className={`filter-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setSearch(''); setStatusFilter(''); }}>
            {t === 'users' ? 'User Report' : t === 'orders' ? 'Order Report' : 'Payment Report'}
          </button>
        ))}
      </div>

      <div className="report-filter-box" style={{ marginBottom: '1.5rem' }}>
        <div className="report-filter-title">Filters</div>
        <div className="report-filter-grid">
          <div className="report-filter-group">
            <label className="report-filter-label">Search</label>
            <input className="report-filter-input" placeholder="Name, phone, order ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="report-filter-group">
            <label className="report-filter-label">From Date</label>
            <input type="date" className="report-filter-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="report-filter-group">
            <label className="report-filter-label">To Date</label>
            <input type="date" className="report-filter-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {tab !== 'users' && (
            <div className="report-filter-group">
              <label className="report-filter-label">Status</label>
              <select className="report-filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="confirm">Confirmed</option>
                <option value="initiated">Initiated</option>
                <option value="cancel">Cancelled</option>
              </select>
            </div>
          )}
        </div>
        <div className="report-filter-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={exportCurrent}>Export CSV</button>
          <span className="report-total" style={{ padding: 0 }}>
            {tab === 'users' ? filteredUsers.length : tab === 'orders' ? filteredOrders.length : filteredPayments.length} records
          </span>
        </div>
      </div>

      <div className="price-table-wrap">
        {tab === 'users' && (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Referral Code</th><th>Source</th><th>KYC</th><th>Joined</th></tr></thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayUserCode(u.referralCode)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{referralSourceLabel(u.referralCode)}</td>
                  <td>{u.kycStatus}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'orders' && (
          <table className="data-table">
            <thead><tr><th>Order ID</th><th>Buyer</th><th>Share</th><th>Qty</th><th>Amount</th><th>User Code</th><th>Source</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.orderId}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{o.orderId}</td>
                  <td>{o.buyerName}</td>
                  <td>{o.companyName}</td>
                  <td>{o.qty}</td>
                  <td>{formatCurrency(o.totalPaid || 0)}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayUserCode(o.employeeCode)}</td>
                  <td style={{ fontSize: '0.78rem' }}>{referralSourceLabel(o.employeeCode)}</td>
                  <td>{o.status}</td>
                  <td>{formatDateTime(getOrderDate(o))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'payments' && (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Txn / Order</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {filteredPayments.map((p, i) => (
                <tr key={`${p.orderId}-${i}`}><td>{p.name}</td><td>{p.phone}</td><td>{p.txnId}</td><td>{formatCurrency(p.amount)}</td><td>{p.status}</td><td>{formatDateTime(p.date)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
