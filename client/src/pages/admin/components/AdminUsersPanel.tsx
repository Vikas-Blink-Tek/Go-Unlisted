import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { saveUser } from '../../../api/admin';
import type { User } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import AdminSectionHeader from './AdminSectionHeader';

type Props = {
  users: User[];
};

export default function AdminUsersPanel({ users }: Props) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [detail, setDetail] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (kycFilter === 'review' && u.kycStatus !== 'Under Review') return false;
      if (kycFilter === 'verified' && u.kycStatus !== 'Verified') return false;
      if (kycFilter === 'rejected' && u.kycStatus !== 'Rejected') return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q);
    });
  }, [users, search, kycFilter]);

  const kycMutation = useMutation({
    mutationFn: (payload: { user: User; kycStatus: string; kycRejectReason?: string }) =>
      saveUser({
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        phone: payload.user.phone,
        kycStatus: payload.kycStatus,
        kycRejectReason: payload.kycRejectReason || '',
      }),
    onSuccess: (_, vars) => {
      showToast(vars.kycStatus === 'Verified' ? 'KYC approved' : 'KYC rejected', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDetail(null);
      setRejectReason('');
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  return (
    <div>
      <AdminSectionHeader compact title="Users & KYC" subtitle="Approve or reject KYC before initiating demat transfer" badge={`${users.length} users`} />

      <div className="stock-list-toolbar">
        <input
          type="search"
          className="report-filter-input stock-list-search"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="report-filter-input" value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}>
          <option value="all">All KYC statuses</option>
          <option value="review">Under Review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="price-table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>KYC</th><th>PAN</th><th>Demat</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>
                  <span className={`status-badge ${u.kycStatus === 'Verified' ? 'status-confirmed' : u.kycStatus === 'Rejected' ? 'status-cancelled' : 'status-pending'}`}>
                    {u.kycStatus}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{u.kycPan || '—'}</td>
                <td>{u.kycDemat ? `****${u.kycDemat.slice(-4)}` : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDetail(u); setRejectReason(u.kycRejectReason || ''); }}>Review</button>
                  {u.kycStatus === 'Under Review' && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => kycMutation.mutate({ user: u, kycStatus: 'Verified' })}>Approve</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="admin-table-empty">
            <strong>No users match</strong>
            Try a different search or KYC filter.
          </div>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-card admin-kyc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.name}</h3>
            <p className="modal-subtitle">{detail.email} · {detail.phone}</p>
            <div className="admin-drawer-grid" style={{ margin: '1rem 0' }}>
              <div><span>PAN</span><strong>{detail.kycPan || '—'}</strong></div>
              <div><span>Demat</span><strong>{detail.kycDemat || '—'}</strong></div>
              <div><span>Bank</span><strong>{detail.bankAccount ? `****${detail.bankAccount.slice(-4)}` : '—'}</strong></div>
              <div><span>IFSC</span><strong>{detail.ifsc || '—'}</strong></div>
            </div>
            <p>KYC status: <strong>{detail.kycStatus}</strong></p>
            {detail.kycRejectReason && (
              <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>Previous rejection: {detail.kycRejectReason}</p>
            )}
            {detail.kycStatus === 'Under Review' && (
              <>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Rejection reason (if rejecting)</label>
                  <input className="form-input" placeholder="e.g. Invalid PAN format" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary btn-full" disabled={kycMutation.isPending} onClick={() => kycMutation.mutate({ user: detail, kycStatus: 'Verified' })}>
                  Approve KYC
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-full mt-1"
                  style={{ color: '#ef4444' }}
                  disabled={kycMutation.isPending}
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      showToast('Enter a rejection reason', 'warning');
                      return;
                    }
                    if (confirm('Reject this KYC submission?')) {
                      kycMutation.mutate({ user: detail, kycStatus: 'Rejected', kycRejectReason: rejectReason.trim() });
                    }
                  }}
                >
                  Reject KYC
                </button>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
