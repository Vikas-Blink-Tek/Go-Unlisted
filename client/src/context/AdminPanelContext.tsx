import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { checkAuth } from '../api/auth';

export type AdminPanelId =
  | 'dashboard'
  | 'pending'
  | 'initiated'
  | 'orders'
  | 'manual-order'
  | 'users'
  | 'cancel-refund'
  | 'employees'
  | 'prices'
  | 'articles'
  | 'reports'
  | 'settings';

export interface AdminPanelDef {
  id: AdminPanelId;
  label: string;
  group: string;
  hint?: string;
  /** Only master admin can manage employees */
  masterOnly?: boolean;
}

/** Permissions master can assign to employees (maps to sidebar panels). */
export const EMPLOYEE_PERMISSION_OPTIONS: { id: AdminPanelId; label: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { id: 'pending', label: 'Verify Payments', group: 'Orders' },
  { id: 'initiated', label: 'Abandoned Checkouts', group: 'Orders' },
  { id: 'orders', label: 'All Orders', group: 'Orders' },
  { id: 'manual-order', label: 'Manual Order', group: 'Orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Orders' },
  { id: 'users', label: 'Users & KYC', group: 'Clients' },
  { id: 'prices', label: 'Stocks & Listings', group: 'Catalog' },
  { id: 'articles', label: 'Articles / Blog', group: 'Content' },
  { id: 'reports', label: 'Reports & Export', group: 'Analytics' },
  { id: 'settings', label: 'Site Settings', group: 'System' },
];

export const DEFAULT_EMPLOYEE_PERMISSIONS: AdminPanelId[] = [
  'dashboard',
  'pending',
  'initiated',
  'orders',
  'manual-order',
  'cancel-refund',
  'users',
];

export const ADMIN_PANELS: AdminPanelDef[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', hint: 'Orders, signups & revenue' },
  { id: 'pending', label: 'Verify Payments', group: 'Order Pipeline', hint: 'Confirm NEFT / IMPS / UPI transfers' },
  { id: 'initiated', label: 'Abandoned Checkouts', group: 'Order Pipeline', hint: 'Buyers who started but did not pay' },
  { id: 'orders', label: 'All Orders', group: 'Order Pipeline', hint: 'Full order history' },
  { id: 'manual-order', label: 'Manual Order', group: 'Order Pipeline', hint: 'Enter offline / phone orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Order Pipeline', hint: 'Update order status' },
  { id: 'users', label: 'Users & KYC', group: 'Clients', hint: 'Registered investors' },
  { id: 'employees', label: 'Employees', group: 'Team', masterOnly: true },
  { id: 'prices', label: 'Stocks & Listings', group: 'Catalog', hint: 'Description, pricing, inventory' },
  { id: 'articles', label: 'Articles / Blog', group: 'Content' },
  { id: 'reports', label: 'Reports & Export', group: 'Analytics' },
  { id: 'settings', label: 'Site Settings', group: 'System' },
];

export function panelsForRole(isMaster: boolean, permissions: string[] = []) {
  if (isMaster || permissions.includes('*')) {
    return ADMIN_PANELS;
  }
  return ADMIN_PANELS.filter((p) => !p.masterOnly && permissions.includes(p.id));
}

interface AdminAuthValue {
  isMaster: boolean;
  adminId: string;
  permissions: string[];
  loading: boolean;
  can: (permission: string) => boolean;
}

interface AdminPanelContextValue extends AdminAuthValue {
  activePanel: AdminPanelId;
  setActivePanel: (id: AdminPanelId) => void;
}

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null);

export function AdminPanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<AdminPanelId>('dashboard');
  const [isMaster, setIsMaster] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        if (res.authenticated && res.type === 'admin') {
          setIsMaster(!!res.isMaster);
          setAdminId(res.id || '');
          setPermissions(
            res.isMaster || (res.permissions || []).includes('*')
              ? ['*']
              : (res.permissions as string[]) || DEFAULT_EMPLOYEE_PERMISSIONS,
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const allowedPanels = panelsForRole(isMaster, permissions);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '') as AdminPanelId;
      const allowed = allowedPanels.some((p) => p.id === hash);
      if (allowed) setActivePanelState(hash);
      else if (allowedPanels.length) setActivePanelState(allowedPanels[0].id);
    };
    if (!loading) syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [isMaster, permissions, loading, allowedPanels]);

  const setActivePanel = (id: AdminPanelId) => {
    if (!allowedPanels.some((p) => p.id === id)) return;
    setActivePanelState(id);
    window.location.hash = id;
  };

  const can = (permission: string) =>
    isMaster || permissions.includes('*') || permissions.includes(permission);

  return (
    <AdminPanelContext.Provider
      value={{ activePanel, setActivePanel, isMaster, adminId, permissions, loading, can }}
    >
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel() {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) throw new Error('useAdminPanel must be used within AdminPanelProvider');
  return ctx;
}
