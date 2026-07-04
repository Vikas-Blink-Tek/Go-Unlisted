import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { deleteEmployee, getEmployees, saveEmployee } from '../../api/admin';
import AutofillBlocker from '../../components/forms/AutofillBlocker';
import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  EMPLOYEE_PERMISSION_OPTIONS,
  type AdminPanelId,
} from '../../context/AdminPanelContext';
import { useToast } from '../../context/ToastContext';
import { blockEmailInput, blockNewPasswordInput, blockTextInput } from '../../utils/autofill';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  is_master: number;
  permissions?: string[];
  created_at?: string;
}

const emptyForm = {
  id: '',
  name: '',
  email: '',
  employeeId: '',
  password: '',
  permissions: [...DEFAULT_EMPLOYEE_PERMISSIONS] as AdminPanelId[],
};

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

  const saveMutation = useMutation({
    mutationFn: saveEmployee,
    onSuccess: () => {
      showToast('Employee saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setShowModal(false);
      setForm(emptyForm);
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

  const openAdd = () => {
    setForm({ ...emptyForm, permissions: [...DEFAULT_EMPLOYEE_PERMISSIONS] });
    setIsEdit(false);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    const perms = (emp.permissions || DEFAULT_EMPLOYEE_PERMISSIONS).filter(
      (p): p is AdminPanelId => p !== '*' && EMPLOYEE_PERMISSION_OPTIONS.some((o) => o.id === p),
    );
    setForm({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      employeeId: emp.employee_id || '',
      password: '',
      permissions: emp.is_master ? EMPLOYEE_PERMISSION_OPTIONS.map((o) => o.id) : perms,
    });
    setIsEdit(true);
    setShowModal(true);
  };

  const togglePermission = (id: AdminPanelId) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id)
        ? f.permissions.filter((p) => p !== id)
        : [...f.permissions, id],
    }));
  };

  const selectAll = () => {
    setForm((f) => ({ ...f, permissions: EMPLOYEE_PERMISSION_OPTIONS.map((o) => o.id) }));
  };

  const selectDefault = () => {
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
    if (!form.permissions.length) {
      showToast('Select at least one permission', 'error');
      return;
    }
    const payload: Record<string, unknown> = {
      id: form.id,
      name: form.name,
      email: form.email,
      employeeId: form.employeeId,
      permissions: form.permissions,
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

  const permissionLabels = (perms?: string[]) => {
    if (!perms?.length) return 'Orders pipeline (default)';
    if (perms.includes('*')) return 'Full access (Master)';
    return perms
      .map((p) => EMPLOYEE_PERMISSION_OPTIONS.find((o) => o.id === p)?.label || p)
      .join(', ');
  };

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <div className="admin-section-subtitle">
            Create employees and choose what they can access in the admin panel.
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
              <th>Employee ID</th>
              <th>Email</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.name}{emp.is_master ? ' (Master)' : ''}</td>
                <td>{emp.employee_id || '—'}</td>
                <td>{emp.email}</td>
                <td style={{ fontSize: '0.78rem', maxWidth: 280 }}>
                  {permissionLabels(emp.permissions)}
                </td>
                <td>
                  {!emp.is_master && (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>Edit</button>
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
                    </>
                  )}
                  {emp.is_master && <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Full access</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!employees.length && !isLoading && (
          <div className="admin-table-empty">
            <strong>No employees yet</strong>
            Add team members and set their permissions.
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card emp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{isEdit ? 'Edit Employee' : 'Add New Employee'}</h3>
            <p className="modal-subtitle">
              Choose what this employee can open and edit. Login: {siteOrigin}/admin/login
            </p>
            <form onSubmit={handleSave} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} {...blockTextInput({ name: 'employee-full-name' })} />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input className="form-input" placeholder="e.g. GU001" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })} {...blockTextInput({ name: 'employee-ref-id' })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} {...blockEmailInput({ name: 'employee-work-email' })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isEdit ? 'Password (leave blank to keep)' : 'Password *'}</label>
                <input className="form-input" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" {...blockNewPasswordInput({ name: 'employee-new-password' })} />
              </div>

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

              <button type="submit" className="btn btn-primary btn-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Employee'}
              </button>
              <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setShowModal(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
