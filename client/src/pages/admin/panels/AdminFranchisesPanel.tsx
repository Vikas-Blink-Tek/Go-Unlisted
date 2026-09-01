import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getFranchises, saveFranchise, type FranchiseRow } from '../../../api/admin';
import AutofillBlocker from '../../../components/forms/AutofillBlocker';
import { useToast } from '../../../context/ToastContext';
import { blockEmailInput, blockNewPasswordInput, blockTextInput } from '../../../utils/autofill';
import AdminSectionHeader from '../components/AdminSectionHeader';

const emptyForm = {
  id: '',
  name: '',
  code: '',
  masterName: '',
  masterEmail: '',
  masterPhone: '',
  masterPassword: '',
};

export default function AdminFranchisesPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: franchises = [], isLoading } = useQuery({
    queryKey: ['admin-franchises'],
    queryFn: getFranchises,
  });

  const saveMutation = useMutation({
    mutationFn: saveFranchise,
    onSuccess: (res) => {
      showToast(isEdit ? 'Franchise updated' : `Franchise created (${res.code || ''})`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-franchises'] });
      setShowModal(false);
      setForm(emptyForm);
      setIsEdit(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setIsEdit(false);
    setShowModal(true);
  };

  const openEdit = (f: FranchiseRow) => {
    setForm({
      id: f.id,
      name: f.name,
      code: f.code,
      masterName: f.masterName || '',
      masterEmail: f.masterEmail || f.contactEmail || '',
      masterPhone: '',
      masterPassword: '',
    });
    setIsEdit(true);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      id: form.id || undefined,
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      masterName: form.masterName.trim(),
      masterEmail: form.masterEmail.trim(),
      masterPhone: form.masterPhone.trim() || undefined,
      masterPassword: form.masterPassword || undefined,
    });
  };

  return (
    <>
      <AdminSectionHeader
        title="Franchises"
        subtitle="Create master franchise logins. Each franchise sees only their clients, orders, and employees. Stock prices stay platform-wide."
        badge={`${franchises.length} franchise${franchises.length === 1 ? '' : 's'}`}
        action={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Add franchise
          </button>
        }
      />

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading franchises…</p>
      ) : !franchises.length ? (
        <div className="admin-table-empty">
          <strong>No franchises yet</strong>
          <p style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
            Add a franchise master — they log in at Master Admin login with the email and password you set.
          </p>
        </div>
      ) : (
        <div className="price-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Franchise</th>
                <th>Code</th>
                <th>Master login</th>
                <th>Employee ID</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {franchises.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.name}</strong></td>
                  <td><code>{f.code}</code></td>
                  <td>
                    <div>{f.masterName || '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{f.masterEmail || f.contactEmail || '—'}</div>
                  </td>
                  <td><code>{f.masterEmployeeId || '—'}</code></td>
                  <td>{f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: '1rem' }}>{isEdit ? 'Edit franchise' : 'New franchise'}</h3>
            <AutofillBlocker />
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Franchise name</label>
                <input
                  className="form-input"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  {...blockTextInput({ name: 'franchise-name' })}
                  placeholder="e.g. Mumbai Franchise"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Franchise code (optional)</label>
                <input
                  className="form-input"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  {...blockTextInput({ name: 'franchise-code' })}
                  placeholder="Auto: FR001, FR002…"
                />
              </div>
              <div className="report-filter-title" style={{ marginTop: '1rem' }}>Master login (franchise admin)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
                This person logs in at <strong>/admin/login</strong> and manages their team and orders only.
              </p>
              <div className="form-group">
                <label className="form-label">Master name</label>
                <input
                  className="form-input"
                  required
                  value={form.masterName}
                  onChange={(e) => setForm((f) => ({ ...f, masterName: e.target.value }))}
                  {...blockTextInput({ name: 'franchise-master-name' })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Master email (login)</label>
                <input
                  className="form-input"
                  required
                  value={form.masterEmail}
                  onChange={(e) => setForm((f) => ({ ...f, masterEmail: e.target.value }))}
                  {...blockEmailInput({ name: 'franchise-master-email' })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Master phone (optional)</label>
                <input
                  className="form-input"
                  value={form.masterPhone}
                  onChange={(e) => setForm((f) => ({ ...f, masterPhone: e.target.value }))}
                  {...blockTextInput({ name: 'franchise-master-phone' })}
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {isEdit ? 'New password (leave blank to keep)' : 'Master password'}
                </label>
                <div className="password-wrap">
                  <input
                    className="form-input"
                    required={!isEdit}
                    value={form.masterPassword}
                    onChange={(e) => setForm((f) => ({ ...f, masterPassword: e.target.value }))}
                    {...blockNewPasswordInput({ name: 'franchise-master-password' })}
                    type={showPassword ? 'text' : 'password'}
                    style={{ paddingRight: '2.75rem' }}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create franchise'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
