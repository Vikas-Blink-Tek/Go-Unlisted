import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteEmployee, getEmployees, saveEmployee } from '../../api/admin';
import AutofillBlocker from '../../components/forms/AutofillBlocker';
import { useToast } from '../../context/ToastContext';
import { blockEmailInput, blockNewPasswordInput, blockTextInput } from '../../utils/autofill';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  email: string;
  is_master: number;
  created_at?: string;
}

const emptyForm = { id: '', name: '', email: '', employeeId: '', password: '' };

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
    setForm(emptyForm);
    setIsEdit(false);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      employeeId: emp.employee_id || '',
      password: '',
    });
    setIsEdit(true);
    setShowModal(true);
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
    const payload: Record<string, string> = {
      id: form.id,
      name: form.name,
      email: form.email,
      employeeId: form.employeeId,
    };
    if (form.password) payload.password = form.password;
    saveMutation.mutate(payload);
  };

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div>
      <div className="admin-section-header">
        <div>
          <div className="admin-section-subtitle">Create and manage employee login accounts for the admin panel.</div>
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
              <th>Direct Links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.name}{emp.is_master ? ' (Master)' : ''}</td>
                <td>{emp.employee_id || '—'}</td>
                <td>{emp.email}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {emp.employee_id && (
                    <>
                      <a href={`${siteOrigin}/?ref=${emp.employee_id}`} target="_blank" rel="noopener noreferrer">Client</a>
                      {' · '}
                      <a href={`${siteOrigin}/admin/login`} target="_blank" rel="noopener noreferrer">Panel</a>
                    </>
                  )}
                </td>
                <td>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>Edit</button>
                  {!emp.is_master && (
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
            ))}
          </tbody>
        </table>
        {!employees.length && !isLoading && (
          <div className="admin-table-empty">
            <strong>No employees yet</strong>
            Add team members so they can log in at /admin/login.
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{isEdit ? 'Edit Employee' : 'Add New Employee'}</h3>
            <p className="modal-subtitle">They will use email and password to log in at /admin/login</p>
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
