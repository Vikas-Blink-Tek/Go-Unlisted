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
  masterOnly?: boolean;
}

export const ADMIN_PANELS: AdminPanelDef[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', hint: 'Business snapshot at a glance' },
  { id: 'pending', label: 'Verify Payments', group: 'Order Pipeline', hint: 'Confirm NEFT / IMPS / UPI transfers' },
  { id: 'initiated', label: 'Abandoned Checkouts', group: 'Order Pipeline', hint: 'Buyers who started but did not pay' },
  { id: 'orders', label: 'All Orders', group: 'Order Pipeline', hint: 'Full order history' },
  { id: 'manual-order', label: 'Manual Order', group: 'Order Pipeline', hint: 'Enter offline / phone orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Order Pipeline', hint: 'Update order status' },
  { id: 'users', label: 'Users & KYC', group: 'Clients', hint: 'Registered investors' },
  { id: 'employees', label: 'Employees', group: 'Team', masterOnly: true },
  { id: 'prices', label: 'Stocks & Listings', group: 'Catalog', masterOnly: true, hint: 'Description, IPO info, pricing, inventory' },
  { id: 'articles', label: 'Articles / Blog', group: 'Content', masterOnly: true },
  { id: 'reports', label: 'Reports & Export', group: 'Analytics', masterOnly: true },
  { id: 'settings', label: 'Site Settings', group: 'System', masterOnly: true },
];

export function panelsForRole(isMaster: boolean) {
  return ADMIN_PANELS.filter((p) => isMaster || !p.masterOnly);
}

interface AdminAuthValue {
  isMaster: boolean;
  adminId: string;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        if (res.authenticated && res.type === 'admin') {
          setIsMaster(!!res.isMaster);
          setAdminId(res.id || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '') as AdminPanelId;
      const allowed = panelsForRole(isMaster).some((p) => p.id === hash);
      if (allowed) setActivePanelState(hash);
    };
    if (!loading) syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [isMaster, loading]);

  const setActivePanel = (id: AdminPanelId) => {
    if (!panelsForRole(isMaster).some((p) => p.id === id)) return;
    setActivePanelState(id);
    window.location.hash = id;
  };

  return (
    <AdminPanelContext.Provider value={{ activePanel, setActivePanel, isMaster, adminId, loading }}>
      {children}
    </AdminPanelContext.Provider>
  );
}

export function useAdminPanel() {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) throw new Error('useAdminPanel must be used within AdminPanelProvider');
  return ctx;
}
