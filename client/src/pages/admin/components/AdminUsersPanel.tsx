import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { saveUser } from '../../../api/admin';
import type { User } from '../../../types';
import { useToast } from '../../../context/ToastContext';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import { formatDate } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import AdminSectionHeader from './AdminSectionHeader';

type Props = {
  users: User[];
};

type KycForm = {
  kycPan: string;
  kycDemat: string;
  bankAccount: string;
  ifsc: string;
  rejectReason: string;
  referralCode: string;
};

function userToForm(u: User): KycForm {
  return {
    kycPan: u.kycPan || '',
    kycDemat: u.kycDemat || '',
    bankAccount: u.bankAccount || '',
    ifsc: u.ifsc || '',
    rejectReason: u.kycRejectReason || '',
    referralCode: u.referralCode || '',
  };
}

export default function AdminUsersPanel({ users }: Props) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [detail, setDetail] = useState<User | null>(null);
  const [form, setForm] = useState<KycForm>({
    kycPan: '',
    kycDemat: '',
    bankAccount: '',
    ifsc: '',
    rejectReason: '',
    referralCode: '',
  });

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (kycFilter === 'review' && u.kycStatus !== 'Under Review') return false;
      if (kycFilter === 'verified' && u.kycStatus !== 'Verified') return false;
      if (kycFilter === 'rejected' && u.kycStatus !== 'Rejected') return false;
      if (kycFilter === 'not' && u.kycStatus !== 'Not Submitted') return false;
      return matchesAdminSearch(search, u.name, u.email, u.phone, u.referralCode);
    });
  }, [users, search, kycFilter]);

  const openCheck = (u: User) => {
    setDetail(u);
    setForm(userToForm(u));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      user: User;
      kycStatus: string;
      kycRejectReason?: string;
      fields?: Partial<KycForm>;
    }) => {
      const f: KycForm = { ...form, ...payload.fields };
      return saveUser({
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        phone: payload.user.phone,
        kycStatus: payload.kycStatus,
        kycRejectReason: payload.kycRejectReason || '',
        kycPan: f.kycPan.trim().toUpperCase(),
        kycDemat: f.kycDemat.trim(),
        bankAccount: f.bankAccount.trim(),
        ifsc: f.ifsc.trim().toUpperCase(),
        referralCode: f.referralCode.trim().toUpperCase(),
      });
    },
    onSuccess: (_, vars) => {
      const msg =
        vars.kycStatus === 'Verified'
          ? 'KYC approved'
          : vars.kycStatus === 'Rejected'
            ? 'KYC rejected'
            : 'KYC details saved';
      showToast(msg, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDetail(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const setField = (patch: Partial<KycForm>) => setForm((f) => ({ ...f, ...patch }));

  const approve = (user: User) => {
    if (!confirm(`Approve KYC for ${user.name}?`)) return;
    saveMutation.mutate({
      user,
      kycStatus: 'Verified',
      fields: detail?.id === user.id ? form : userToForm(user),
    });
  };

  const reject = (user: User) => {
    const reason = (detail?.id === user.id ? form.rejectReason : user.kycRejectReason || '').trim();
    if (!reason) {
      showToast('Enter a rejection reason', 'warning');
      if (detail?.id !== user.id) openCheck(user);
      return;
    }
    if (!confirm(`Reject KYC for ${user.name}?`)) return;
    saveMutation.mutate({
      user,
      kycStatus: 'Rejected',
      kycRejectReason: reason,
      fields: detail?.id === user.id ? form : { ...userToForm(user), rejectReason: reason },
    });
  };

  const saveDetails = () => {
    if (!detail) return;
    saveMutation.mutate({
      user: detail,
      kycStatus: detail.kycStatus === 'Not Submitted' && form.kycPan ? 'Under Review' : detail.kycStatus,
      kycRejectReason: form.rejectReason,
      fields: form,
    });
  };

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Users & KYC"
        subtitle="Check KYC details, edit if needed, then approve or reject"
        badge={`${users.length} users`}
      />

      <div className="stock-list-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search mobile, name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users by mobile, name or email"
        />
        <select className="report-filter-input" value={kycFilter} onChange={(e) => setKycFilter(e.target.value)}>
          <option value="all">All KYC statuses</option>
          <option value="not">Not Submitted</option>
          <option value="review">Under Review</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="price-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Registered</th>
              <th>Code</th>
              <th>Email</th>
              <th>Phone</th>
              <th>KYC</th>
              <th>PAN</th>
              <th>Demat</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {u.createdAt ? formatDate(u.createdAt) : '—'}
                </td>
                <td style={{ fontFamily: 'monospace' }}>
                  {displayUserCode(u.referralCode)}
                </td>
                <td>{u.email}</td>
                <td>{u.phone || '—'}</td>
                <td>
                  <span
                    className={`status-badge ${
                      u.kycStatus === 'Verified'
                        ? 'status-confirmed'
                        : u.kycStatus === 'Rejected'
                          ? 'status-cancelled'
                          : 'status-pending'
                    }`}
                  >
                    {u.kycStatus}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{u.kycPan || '—'}</td>
                <td>{u.kycDemat ? `****${u.kycDemat.slice(-4)}` : '—'}</td>
                <td>
                  <div className="kyc-row-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openCheck(u)}>
                      Check KYC
                    </button>
                    {(u.kycStatus === 'Under Review' || u.kycStatus === 'Rejected' || (u.kycPan && u.kycStatus !== 'Verified')) && (
                      <button
                        type="button"
                        className="btn btn-sm kyc-approve-btn"
                        disabled={saveMutation.isPending}
                        onClick={() => approve(u)}
                      >
                        Approve
                      </button>
                    )}
                    {(u.kycStatus === 'Under Review' || u.kycStatus === 'Verified') && (
                      <button
                        type="button"
                        className="btn btn-sm kyc-reject-btn"
                        disabled={saveMutation.isPending}
                        onClick={() => {
                          openCheck(u);
                        }}
                      >
                        Reject
                      </button>
                    )}
                  </div>
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
            <h3>Check KYC — {detail.name}</h3>
            <p className="modal-subtitle">
              {detail.email}
              {detail.phone ? ` · ${detail.phone}` : ''}
            </p>

            <div className="kyc-status-line">
              Status:{' '}
              <span
                className={`status-badge ${
                  detail.kycStatus === 'Verified'
                    ? 'status-confirmed'
                    : detail.kycStatus === 'Rejected'
                      ? 'status-cancelled'
                      : 'status-pending'
                }`}
              >
                {detail.kycStatus}
              </span>
            </div>

            {detail.kycRejectReason && (
              <p className="kyc-reject-note">Previous rejection: {detail.kycRejectReason}</p>
            )}

            <p className="kyc-edit-hint">Edit fields if the user made a mistake, then Approve or Reject.</p>

            <div className="form-group">
              <label className="form-label">PAN</label>
              <input
                className="form-input"
                value={form.kycPan}
                onChange={(e) => setField({ kycPan: e.target.value.toUpperCase() })}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Demat (16 digits)</label>
              <input
                className="form-input"
                value={form.kycDemat}
                onChange={(e) => setField({ kycDemat: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                placeholder="1234567890123456"
                maxLength={16}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bank account</label>
              <input
                className="form-input"
                value={form.bankAccount}
                onChange={(e) => setField({ bankAccount: e.target.value.replace(/\D/g, '') })}
                placeholder="Account number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">IFSC</label>
              <input
                className="form-input"
                value={form.ifsc}
                onChange={(e) => setField({ ifsc: e.target.value.toUpperCase() })}
                placeholder="SBIN0001234"
                maxLength={11}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Rejection reason (required only if rejecting)</label>
              <input
                className="form-input"
                value={form.rejectReason}
                onChange={(e) => setField({ rejectReason: e.target.value })}
                placeholder="e.g. PAN does not match name on demat"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Employee Code (Transfer)</label>
              <input
                className="form-input"
                value={form.referralCode}
                onChange={(e) => setField({ referralCode: e.target.value.toUpperCase() })}
                placeholder="GUE003 (Optional)"
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Change this code to transfer the user to a different employee.</p>
            </div>
            
            <div className="kyc-modal-actions">
              <button
                type="button"
                className="btn btn-primary btn-full"
                disabled={saveMutation.isPending}
                onClick={() => approve(detail)}
              >
                ✓ Approve KYC
              </button>
              <button
                type="button"
                className="btn btn-full kyc-reject-btn"
                disabled={saveMutation.isPending}
                onClick={() => reject(detail)}
              >
                ✕ Reject KYC
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                disabled={saveMutation.isPending}
                onClick={saveDetails}
              >
                Save details only
              </button>
              <button type="button" className="btn btn-ghost btn-full" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
