import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getUsers, mapApiUser } from '../../../api/admin';
import type { User } from '../../../types';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import { formatDateTime, formatIndianPhoneDisplay, formatPersonName } from '../../../utils/format';
import { displayUserCode, DEFAULT_USER_CODE } from '../../../utils/userCode';
import AdminSectionHeader from '../components/AdminSectionHeader';

export default function AdminSignupsPanel() {
  const [search, setSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await getUsers()).map(mapApiUser),
  });
  const users: User[] = usersQuery.data || [];

  const employeeCodes = useMemo(() => {
    const codes = new Set<string>([DEFAULT_USER_CODE]);
    users.forEach((u) => {
      const c = displayUserCode(u.referralCode);
      if (c) codes.add(c);
    });
    return Array.from(codes).sort();
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (codeFilter !== 'all' && displayUserCode(u.referralCode) !== codeFilter) return false;
      if (dateFrom && u.createdAt) {
        const t = new Date(u.createdAt).getTime();
        if (t < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo && u.createdAt) {
        const t = new Date(u.createdAt).getTime();
        if (t > new Date(`${dateTo}T23:59:59+05:30`).getTime()) return false;
      }
      return matchesAdminSearch(search, u.name, u.email, u.phone, u.referralCode);
    });
  }, [users, search, codeFilter, dateFrom, dateTo]);

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return users.filter((u) => u.createdAt?.startsWith(today)).length;
  }, [users]);

  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return users.filter((u) => {
      if (!u.createdAt) return false;
      return new Date(u.createdAt).getTime() >= weekAgo.getTime();
    }).length;
  }, [users]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return users.filter((u) => {
      if (!u.createdAt) return false;
      const d = new Date(u.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [users]);

  if (usersQuery.isLoading) {
    return <p style={{ color: 'var(--muted)', padding: '2rem' }}>Loading signups...</p>;
  }

  return (
    <div>
      <AdminSectionHeader
        compact
        title="User Signups"
        subtitle="Track when users registered, their employee code, and contact info"
        badge={`${users.length} total`}
      />

      {/* Quick Stats */}
      <div className="admin-stat-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Signups</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <div className="stat-value">{todayCount}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <div className="stat-value">{thisWeekCount}</div>
          <div className="stat-label">This Week (7 days)</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <div className="stat-value">{thisMonthCount}</div>
          <div className="stat-label">This Month</div>
        </div>
        <div className="stat-card" style={{ flex: '1 1 180px', minWidth: '160px' }}>
          <div className="stat-value">
            {users.filter((u) => u.kycStatus === 'Verified').length}
          </div>
          <div className="stat-label">KYC Verified</div>
        </div>
      </div>

      {/* Filters */}
      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search name, email, phone, code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search signups"
        />
        {employeeCodes.length > 0 && (
          <select className="report-filter-input" value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)}>
            <option value="all">All codes</option>
            {employeeCodes.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="report-filter-input"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
        />
        <input
          type="date"
          className="report-filter-input"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To date"
        />
      </div>

      {/* Table */}
      {!filtered.length ? (
        <div className="price-table-wrap">
          <div className="admin-table-empty">
            <strong>No signups found</strong>
            Adjust search or filters.
          </div>
        </div>
      ) : (
        <div className="price-table-wrap admin-orders-table-wrap">
          <table className="data-table admin-orders-table admin-signups-table">
            <thead>
              <tr>
                <th className="admin-signups-col-num">#</th>
                <th className="admin-signups-col-date">Registered On</th>
                <th className="admin-signups-col-name">Name</th>
                <th className="admin-signups-col-contact">Contact</th>
                <th className="admin-signups-col-code">Employee Code</th>
                <th className="admin-signups-col-kyc">KYC Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr key={u.id} className="admin-order-row">
                  <td className="admin-signups-col-num">{idx + 1}</td>
                  <td className="admin-signups-col-date">
                    {u.createdAt ? formatDateTime(u.createdAt) : '—'}
                  </td>
                  <td className="admin-signups-col-name">
                    <div className="admin-orders-buyer-name">{formatPersonName(u.name)}</div>
                  </td>
                  <td className="admin-signups-col-contact">
                    <div className="admin-signups-email" title={u.email || undefined}>
                      {u.email || '—'}
                    </div>
                    <div className="admin-orders-buyer-meta">
                      {u.phone ? formatIndianPhoneDisplay(u.phone) : '—'}
                    </div>
                  </td>
                  <td className="admin-signups-col-code">
                    {displayUserCode(u.referralCode)}
                  </td>
                  <td className="admin-signups-col-kyc">
                    <span
                      className={`status-badge status-badge--admin ${
                        u.kycStatus === 'Verified'
                          ? 'status-confirmed'
                          : u.kycStatus === 'Rejected'
                            ? 'status-cancelled'
                            : u.kycStatus === 'Under Review'
                              ? 'status-pending'
                              : 'status-initiated'
                      }`}
                    >
                      {u.kycStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
