import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { adminUploadKycDematProof, saveUser, transferUser } from '../../../api/admin';
import type { User } from '../../../types';
import { useAdminPanel } from '../../../context/AdminPanelContext';
import { useToast } from '../../../context/ToastContext';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import { formatDate } from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import { isPdfProof, kycProofViewUrl } from '../../../utils/kyc';
import AdminSectionHeader from './AdminSectionHeader';

type Props = {
  users: User[];
  employees?: Array<{ employee_id?: string; employeeCode?: string; name?: string }>;
};

type KycForm = {
  name: string;
  phone: string;
  kycPan: string;
  kycDemat: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  rejectReason: string;
  referralCode: string;
};

type OrderTransferScope = 'all' | 'open' | 'none';

function userToForm(u: User): KycForm {
  return {
    name: u.name || '',
    phone: (u.phone || '').replace(/\D/g, '').slice(-10),
    kycPan: u.kycPan || '',
    kycDemat: u.kycDemat || '',
    bankName: u.bankName || '',
    bankAccount: u.bankAccount || '',
    ifsc: u.ifsc || '',
    rejectReason: u.kycRejectReason || '',
    referralCode: u.referralCode || '',
  };
}

export default function AdminUsersPanel({ users, employees = [] }: Props) {
  const { isMaster } = useAdminPanel();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [detail, setDetail] = useState<User | null>(null);

  useEffect(() => {
    try {
      const preset = sessionStorage.getItem('gu_kyc_filter');
      if (preset === 'review' || preset === 'verified' || preset === 'rejected' || preset === 'not' || preset === 'all') {
        setKycFilter(preset);
        sessionStorage.removeItem('gu_kyc_filter');
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [transferTarget, setTransferTarget] = useState<User | null>(null);
  const [transferCode, setTransferCode] = useState('');
  const [orderScope, setOrderScope] = useState<OrderTransferScope>('all');
  const [proofUploading, setProofUploading] = useState(false);
  const [proofThumbKey, setProofThumbKey] = useState(0);
  const [form, setForm] = useState<KycForm>({
    name: '',
    phone: '',
    kycPan: '',
    kycDemat: '',
    bankName: '',
    bankAccount: '',
    ifsc: '',
    rejectReason: '',
    referralCode: '',
  });

  const employeeOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ code: string; name: string }> = [];
    for (const e of employees) {
      const code = displayUserCode(String(e.employee_id ?? e.employeeCode ?? '').trim());
      if (!code || code === 'GU00' || seen.has(code)) continue;
      seen.add(code);
      list.push({ code, name: e.name ? String(e.name) : code });
    }
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [employees]);
  const pendingKycCount = useMemo(
    () => users.filter((u) => u.kycStatus === 'Under Review').length,
    [users],
  );

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
    setProofThumbKey(0);
  };

  const handleAdminProofUpload = async (file: File | null) => {
    if (!detail || !file) return;
    setProofUploading(true);
    try {
      const res = await adminUploadKycDematProof(detail.id, file);
      const next: User = {
        ...detail,
        kycDematProof: res.url,
        kycDematProofExists: true,
      };
      setDetail(next);
      setProofThumbKey((k) => k + 1);
      showToast('CMR / demat proof uploaded', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setProofUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      user: User;
      kycStatus: string;
      kycRejectReason?: string;
      fields?: Partial<KycForm>;
    }) => {
      const f: KycForm = { ...form, ...payload.fields };
      const phone = f.phone.replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(phone)) {
        throw new Error('Enter a valid 10-digit Indian mobile number');
      }
      const name = f.name.trim();
      if (name.length < 2) {
        throw new Error('Client name is required');
      }
      return saveUser({
        id: payload.user.id,
        name,
        email: payload.user.email,
        phone,
        kycStatus: payload.kycStatus,
        kycRejectReason: payload.kycRejectReason || '',
        kycPan: f.kycPan.trim().toUpperCase(),
        kycDemat: f.kycDemat.trim(),
        bankName: f.bankName.trim(),
        bankAccount: f.bankAccount.trim(),
        ifsc: f.ifsc.trim().toUpperCase(),
        kycDematProof: payload.user.kycDematProof || '',
        referralCode: f.referralCode.trim().toUpperCase(),
      });
    },
    onSuccess: (_, vars) => {
      const msg =
        vars.kycStatus === 'Verified'
          ? 'KYC approved'
          : vars.kycStatus === 'Rejected'
            ? 'KYC rejected'
            : 'Client details saved';
      showToast(msg, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDetail(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: () => {
      if (!transferTarget) throw new Error('No user selected');
      return transferUser(transferTarget.id, transferCode, orderScope);
    },
    onSuccess: (res) => {
      const parts = [`Moved to ${displayUserCode(res.employeeCode)}`];
      if ((res.ordersUpdated || 0) > 0) parts.push(`${res.ordersUpdated} order(s)`);
      if ((res.initiatedUpdated || 0) > 0) parts.push(`${res.initiatedUpdated} initiate`);
      showToast(parts.join(' · '), 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['initiated-checkouts'] });
      setTransferTarget(null);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const openTransfer = (user: User) => {
    if (!isMaster) {
      showToast('Only Master Admin can transfer users between employees', 'error');
      return;
    }
    const current = displayUserCode(user.referralCode);
    const defaultCode =
      employeeOptions.find((e) => e.code !== current)?.code
      || employeeOptions[0]?.code
      || '';
    setTransferCode(defaultCode);
    setOrderScope('all');
    setTransferTarget(user);
  };

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
        badge={pendingKycCount > 0 ? `${pendingKycCount} pending approval` : `${users.length} users`}
      />

      {pendingKycCount > 0 && kycFilter !== 'review' && (
        <div className="dashboard-kyc-alert" role="status" style={{ marginBottom: '1rem' }}>
          <div className="dashboard-kyc-alert-text">
            <strong>{pendingKycCount} KYC awaiting approval</strong>
            <span>Filter to Under Review to approve submitted details.</span>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setKycFilter('review')}>
            Show pending
          </button>
        </div>
      )}

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
          <option value="review">Under Review{pendingKycCount > 0 ? ` (${pendingKycCount})` : ''}</option>
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
                    {isMaster && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={saveMutation.isPending || transferMutation.isPending}
                        onClick={() => openTransfer(u)}
                      >
                        Transfer
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

            <p className="kyc-edit-hint">
              Edit phone, name, or KYC fields if the client made a mistake, then Approve, Reject, or Save details.
            </p>

            <div className="form-group">
              <label className="form-label">Client name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setField({ name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone number</label>
              <input
                className="form-input"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => setField({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="10-digit mobile"
                maxLength={10}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                Employees and admins can update the client mobile here. Must be a valid 10-digit Indian number.
              </p>
            </div>
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
              <label className="form-label">Demat (16 letters/digits)</label>
              <input
                className="form-input"
                value={form.kycDemat}
                onChange={(e) => setField({ kycDemat: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16) })}
                placeholder="e.g. 12081600XXXXXX12"
                maxLength={16}
              />
            </div>
            <div className="form-group">
              <label className="form-label">CMR / Demat proof</label>
              <div className="kyc-admin-proof">
                {detail.kycDematProofExists === false && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--danger, #dc2626)' }}>
                    Proof path is saved, but the file is missing on the server. Re-upload CMR below (JPG / PNG / WEBP / PDF, max 5MB).
                  </p>
                )}
                {detail.kycDematProof && detail.kycDematProofExists !== false && (
                  <>
                    <a
                      href={`${kycProofViewUrl({ userId: detail.id }) || '#'}&t=${proofThumbKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open proof
                    </a>
                    {!isPdfProof(detail.kycDematProof) && (
                      <img
                        key={proofThumbKey}
                        src={`${kycProofViewUrl({ userId: detail.id }) || ''}&t=${proofThumbKey}`}
                        alt="Demat proof"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </>
                )}
                {!detail.kycDematProof && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    No proof on file yet — upload CMR from WhatsApp / email here.
                  </p>
                )}
                <label className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem', cursor: proofUploading ? 'wait' : 'pointer' }}>
                  {proofUploading ? 'Uploading…' : detail.kycDematProof ? 'Re-upload CMR' : 'Upload CMR'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                    style={{ display: 'none' }}
                    disabled={proofUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      void handleAdminProofUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Bank name</label>
              <input
                className="form-input"
                value={form.bankName}
                onChange={(e) => setField({ bankName: e.target.value })}
                placeholder="HDFC Bank"
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
              <label className="form-label">Employee Code</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  className="form-input"
                  value={form.referralCode}
                  readOnly
                  disabled
                  style={{ flex: '1 1 120px', fontFamily: 'monospace' }}
                />
                {isMaster && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openTransfer(detail)}
                  >
                    Transfer user…
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                {isMaster
                  ? 'Use Transfer to move this client (and optionally their orders) to another employee.'
                  : 'Only Master Admin can reassign this client to another employee.'}
              </p>
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

      {transferTarget && isMaster && (
        <div className="modal-overlay" onClick={() => !transferMutation.isPending && setTransferTarget(null)}>
          <div className="modal-card kyc-check-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="kyc-modal-header">
              <h3>Transfer {transferTarget.name}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setTransferTarget(null)}
                disabled={transferMutation.isPending}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 0 }}>
              Current code: <strong style={{ fontFamily: 'monospace' }}>{displayUserCode(transferTarget.referralCode)}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">New employee code</label>
              {employeeOptions.length > 0 ? (
                <select
                  className="form-input"
                  value={transferCode}
                  onChange={(e) => setTransferCode(e.target.value)}
                  aria-label="New employee code"
                >
                  {employeeOptions.map((e) => (
                    <option key={e.code} value={e.code}>
                      {e.code}{e.name && e.name !== e.code ? ` — ${e.name}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={transferCode}
                  onChange={(e) => setTransferCode(e.target.value.toUpperCase())}
                  placeholder="GUE002"
                  style={{ fontFamily: 'monospace' }}
                />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Also transfer orders</label>
              <select
                className="form-input"
                value={orderScope}
                onChange={(e) => setOrderScope(e.target.value as OrderTransferScope)}
              >
                <option value="all">All orders (incl. Completed) + Initiate</option>
                <option value="open">Open only (Pending / Share Transfer) + Initiate</option>
                <option value="none">User only — leave orders as-is</option>
              </select>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                Matches this client’s orders by account / phone / email so you don’t reassign each row in All Orders.
              </p>
            </div>
            <div className="kyc-modal-actions">
              <button
                type="button"
                className="btn btn-primary btn-full"
                disabled={
                  transferMutation.isPending
                  || !transferCode.trim()
                  || displayUserCode(transferCode) === displayUserCode(transferTarget.referralCode)
                }
                onClick={() => transferMutation.mutate()}
              >
                {transferMutation.isPending ? 'Transferring…' : 'Confirm transfer'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                disabled={transferMutation.isPending}
                onClick={() => setTransferTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
