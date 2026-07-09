import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { deleteEmployee, demoteEmployee, getEmployees, saveEmployee } from '../../api/admin';
import AutofillBlocker from '../../components/forms/AutofillBlocker';
import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSION_OPTIONS,
  type AdminPanelId,
} from '../../context/AdminPanelContext';
import { useToast } from '../../context/ToastContext';
import { staffDirectLoginUrl, staffSignupReferralUrl } from '../../utils/adminPanelHash';
import { blockEmailInput, blockNewPasswordInput, blockTextInput } from '../../utils/autofill';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  phone?: string;
  is_master: number | boolean;
  permissions?: string[];
  created_at?: string;
}

const emptyForm = {
  id: '',
  name: '',
  email: '',
  phone: '',
  employeeId: '',
  password: '',
  isMaster: false,
  permissions: [...DEFAULT_EMPLOYEE_PERMISSIONS] as AdminPanelId[],
};

function isMasterEmp(emp: Employee): boolean {
  return emp.is_master === 1 || emp.is_master === true || emp.permissions?.includes('*') === true;
}

export default function AdminEmployees() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: async () => {
      const rows = await getEmployees();
      return rows as unknown as Employee[];
    },
  });

  // Master Admin first, then other employees A–Z
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const am = isMasterEmp(a) ? 0 : 1;
      const bm = isMasterEmp(b) ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [employees]);

  const saveMutation = useMutation({
    mutationFn: saveEmployee,
    onSuccess: () => {
      if (!form.isMaster) {
        showToast(`Saved — direct link: ${staffDirectLoginUrl(siteOrigin, { email: form.email, employee_id: form.employeeId })}`, 'success');
      } else {
        showToast('Master Admin updated', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setShowModal(false);
      setForm(emptyForm);
      setIsEdit(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      showToast('Employee deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const demoteMutation = useMutation({
    mutationFn: demoteEmployee,
    onSuccess: (res) => {
      showToast(res.message || 'Master access removed', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const openAdd = () => {
    setForm({ ...emptyForm, permissions: [...DEFAULT_EMPLOYEE_PERMISSIONS] });
    setIsEdit(false);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    const master = isMasterEmp(emp);
    const perms = (emp.permissions || DEFAULT_EMPLOYEE_PERMISSIONS).filter(
      (p): p is AdminPanelId => p !== '*' && EMPLOYEE_PERMISSION_OPTIONS.some((o) => o.id === p),
    );
    setForm({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      employeeId: emp.employee_id || '',
      password: '',
      isMaster: master,
      permissions: master ? EMPLOYEE_PERMISSION_OPTIONS.map((o) => o.id) : perms,
    });
    setIsEdit(true);
    setShowModal(true);
  };

  const togglePermission = (id: AdminPanelId) => {
    if (form.isMaster) return;
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));
  };

  const selectAll = () => {
    if (form.isMaster) return;
    setForm((f) => ({ ...f, permissions: EMPLOYEE_PERMISSION_OPTIONS.map((o) => o.id) }));
  };

  const selectDefault = () => {
    if (form.isMaster) return;
    setForm((f) => ({ ...f, permissions: [...DEFAULT_EMPLOYEE_PERMISSIONS] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      showToast('Name and email are required', 'error');
      return;
    }
    if (!isEdit && (!form.password || form.password.length < 6)) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (form.password && form.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (!form.isMaster && !form.employeeId.trim()) {
      showToast('Employee ID is required (short login link, e.g. GUE001)', 'error');
      return;
    }
    const payload: Record<string, unknown> = {
      id: form.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      employeeId: form.employeeId,
      permissions: form.isMaster ? ['*'] : form.permissions,
    };
    if (form.password) payload.password = form.password;
    saveMutation.mutate(payload);
  };

  const permissionGroups = useMemo(() => {
    const groups = [...new Set(EMPLOYEE_PERMISSION_OPTIONS.map((o) => o.group))];
    return groups.map((group) => ({
      group,
      items: EMPLOYEE_PERMISSION_OPTIONS.filter((o) => o.group === group),
    }));
  }, []);

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const staffLoginUrl = `${siteOrigin}/staff/login`;
  const masterLoginUrl = `${siteOrigin}/admin/login`;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`, 'success');
    } catch {
      showToast('Could not copy — select and copy manually', 'error');
    }
  };

  const employeeDirectLink = (emp: Employee) => staffDirectLoginUrl(siteOrigin, emp);
  const employeeSignupLink = (emp: Employee) => staffSignupReferralUrl(siteOrigin, emp.employee_id || '');

  const permissionLabels = (emp: Employee) => {
    if (isMasterEmp(emp)) return 'Full access — all panels';
    const perms = emp.permissions || [];
    if (!perms.length) return 'Orders pipeline (default)';
    return perms
      .map((p) => EMPLOYEE_PERMISSION_OPTIONS.find((o) => o.id === p)?.label || p)
      .join(', ');
  };

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <div className="admin-section-subtitle">
            Master Admin and employees — manage login details and employee panel access.
          </div>
          <div className="emp-login-urls" style={{ marginTop: '0.65rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            <span>
              <strong style={{ color: 'var(--text)' }}>Employee login (auto):</strong>{' '}
              <a href={staffLoginUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--green-light)' }}>{staffLoginUrl}</a>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 6, padding: '2px 8px' }} onClick={() => copyText(staffLoginUrl, 'Employee login link')}>
                Copy
              </button>
            </span>
            <span style={{ margin: '0 0.5rem' }}>·</span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Master login:</strong>{' '}
              <a href={masterLoginUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--green-light)' }}>{masterLoginUrl}</a>
            </span>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="price-table-wrap">
        {isLoading && <p style={{ padding: '1rem', color: 'var(--muted)' }}>Loading...</p>}
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Employee ID</th>
              <th>RM Phone</th>
              <th>Email</th>
              <th>Login</th>
              <th>Signup link</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((emp) => {
              const master = isMasterEmp(emp);
              return (
                <tr key={emp.id} className={master ? 'emp-row-master' : undefined}>
                  <td>
                    <strong>{emp.name}</strong>
                  </td>
                  <td>
                    <span className={master ? 'admin-badge' : 'emp-badge'}>
                      {master ? 'Master Admin' : 'Employee'}
                    </span>
                  </td>
                  <td>{emp.employee_id || '—'}</td>
                  <td>{emp.phone || '—'}</td>
                  <td>{emp.email}</td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 220 }}>
                    {master ? (
                      <a href={masterLoginUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--green-light)' }}>{masterLoginUrl}</a>
                    ) : (
                      <>
                        <a
                          href={employeeDirectLink(emp)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--green-light)', wordBreak: 'break-all' }}
                        >
                          Direct link
                        </a>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px', marginLeft: 4 }}
                          onClick={() => copyText(employeeDirectLink(emp), 'Login link')}
                        >
                          Copy
                        </button>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 200 }}>
                    {master ? (
                      '—'
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px' }}
                          onClick={() => copyText(employeeSignupLink(emp), 'Signup link')}
                        >
                          Copy signup
                        </button>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>
                          Code: <strong>{emp.employee_id}</strong>
                        </div>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: '0.78rem', maxWidth: 280 }}>
                    {permissionLabels(emp)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>
                      Edit
                    </button>
                    {master && emp.id !== 'master-admin' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#f59e0b' }}
                        onClick={() => {
                          if (confirm(`Remove Master Admin access from ${emp.name}? They will become a regular employee.`)) {
                            demoteMutation.mutate(emp.id);
                          }
                        }}
                      >
                        Demote
                      </button>
                    )}
                    {!master && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#ef4444' }}
                        onClick={() => {
                          if (confirm(`Delete employee ${emp.name}?`)) deleteMutation.mutate(emp.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!employees.length && !isLoading && (
          <div className="admin-table-empty">
            <strong>No accounts yet</strong>
            Master Admin should appear here. Add team members and set their permissions.
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card emp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {isEdit
                ? (form.isMaster ? 'Edit Master Admin' : 'Edit Employee')
                : 'Add New Employee'}
            </h3>
            <p className="modal-subtitle">
              {form.isMaster
                ? `Master Admin login: ${masterLoginUrl}`
                : 'Employee ID = their code (GUE001). Users sign up with ?ref=GUE001 — then only that employee sees those signups, orders & initiate.'}
            </p>
            {!form.isMaster && form.email && (
              <div style={{ marginBottom: '1rem', padding: '0.65rem 0.75rem', background: 'rgba(122,193,66,0.08)', borderRadius: 8, fontSize: '0.8rem' }}>
                <strong>Direct link (preview):</strong>
                <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
                  {staffDirectLoginUrl(siteOrigin, { email: form.email, employee_id: form.employeeId })}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={() => copyText(
                    staffDirectLoginUrl(siteOrigin, { email: form.email, employee_id: form.employeeId }),
                    'Direct login link',
                  )}
                >
                  Copy direct link
                </button>
              </div>
            )}
            <form onSubmit={handleSave} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} {...blockTextInput({ name: 'employee-full-name' })} />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID *</label>
                <input className="form-input" required placeholder="e.g. GUE001 — used for short login link" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })} {...blockTextInput({ name: 'employee-ref-id' })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} {...blockEmailInput({ name: 'employee-work-email' })} />
              </div>
              {!form.isMaster && (
                <div className="form-group">
                  <label className="form-label">RM Phone (shown to users with this referral code)</label>
                  <input className="form-input" placeholder="10-digit mobile e.g. 8655701571" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} {...blockTextInput({ name: 'employee-rm-phone' })} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{isEdit ? 'Password (leave blank to keep)' : 'Password *'}</label>
                <input className="form-input" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" {...blockNewPasswordInput({ name: 'employee-new-password' })} />
              </div>

              {form.isMaster ? (
                <div className="emp-permissions-block emp-master-note">
                  <label className="form-label" style={{ margin: 0 }}>Privileges</label>
                  <p className="emp-permissions-hint" style={{ marginBottom: 0 }}>
                    <strong>Master Admin</strong> always has full access to every panel (stocks, users, settings, employees, etc.). Permissions cannot be limited.
                  </p>
                </div>
              ) : (
                <div className="emp-permissions-block">
                  <div className="emp-permissions-head">
                    <label className="form-label" style={{ margin: 0 }}>Privileges / Permissions *</label>
                    <div className="emp-permissions-quick">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={selectDefault}>Orders only</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>Select all</button>
                    </div>
                  </div>
                  <p className="emp-permissions-hint">Tick what this employee can access. Unticked areas are hidden and blocked.</p>
                  {permissionGroups.map(({ group, items }) => (
                    <div key={group} className="emp-perm-group">
                      <div className="emp-perm-group-label">{group}</div>
                      <div className="emp-perm-grid">
                        {items.map((item) => (
                          <label key={item.id} className="emp-perm-item">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(item.id)}
                              onChange={() => togglePermission(item.id)}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : (form.isMaster ? 'Save Master Admin' : 'Save Employee')}
              </button>
              <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setShowModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
