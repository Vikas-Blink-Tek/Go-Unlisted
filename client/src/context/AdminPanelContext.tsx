import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  isPanelAllowed,
  normalizeAdminPermissions,
  parseAdminPanelHash,
  resolveAdminPanel,
} from '../utils/adminPanelHash';

export type AdminPanelId =
  | 'dashboard'
  | 'pending'
  | 'initiated'
  | 'orders'
  | 'manual-order'
  | 'users'
  | 'cancel-refund'
  | 'employees'
  | 'inventory'
  | 'invoices'
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

export interface VerifiedAdminAuth {
  id: string;
  isMaster: boolean;
  permissions: string[];
}

export const EMPLOYEE_PERMISSION_OPTIONS: { id: AdminPanelId; label: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { id: 'pending', label: 'Verify Payments', group: 'Orders' },
  { id: 'initiated', label: 'Initiate', group: 'Orders' },
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
  { id: 'initiated', label: 'Initiate', group: 'Order Pipeline', hint: 'Buyers who started checkout but did not pay' },
  { id: 'orders', label: 'All Orders', group: 'Order Pipeline', hint: 'Full order history' },
  { id: 'manual-order', label: 'Manual Order', group: 'Order Pipeline', hint: 'Enter offline / phone orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Order Pipeline', hint: 'Update order status' },
  { id: 'users', label: 'Users & KYC', group: 'Clients', hint: 'Registered investors' },
  { id: 'employees', label: 'Employees', group: 'Team', masterOnly: true },
  { id: 'inventory', label: 'Inventory', group: 'Back Office', masterOnly: true, hint: 'Qty on hand, cost & margins' },
  { id: 'invoices', label: 'Invoices', group: 'Back Office', masterOnly: true, hint: 'Tax invoices for confirmed orders' },
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

interface AdminPanelContextValue {
  isMaster: boolean;
  adminId: string;
  permissions: string[];
  allowedPanels: AdminPanelDef[];
  activePanel: AdminPanelId;
  setActivePanel: (id: AdminPanelId) => void;
  can: (permission: string) => boolean;
  canAccessPanel: (panelId: AdminPanelId) => boolean;
}

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null);

export function AdminPanelProvider({
  children,
  verifiedAuth,
}: {
  children: ReactNode;
  verifiedAuth: VerifiedAdminAuth;
}) {
  const isMaster = !!verifiedAuth.isMaster;
  const permissions = useMemo(
    () => normalizeAdminPermissions(isMaster, verifiedAuth.permissions),
    [isMaster, verifiedAuth.permissions],
  );
  const allowedPanels = useMemo(() => panelsForRole(isMaster, permissions), [isMaster, permissions]);

  const [activePanel, setActivePanelState] = useState<AdminPanelId>(() =>
    resolveAdminPanel(parseAdminPanelHash(), isMaster, permissions),
  );

  const applyPanel = (requested: AdminPanelId | null) => {
    const resolved = resolveAdminPanel(requested, isMaster, permissions);
    setActivePanelState(resolved);
    const hash = parseAdminPanelHash();
    if (hash !== resolved) {
      window.history.replaceState(null, '', `${window.location.pathname}#${resolved}`);
    }
  };

  // Block forbidden hash before first paint (URL manipulation)
  useLayoutEffect(() => {
    applyPanel(parseAdminPanelHash());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, permissions]);

  useEffect(() => {
    const onHashChange = () => applyPanel(parseAdminPanelHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, permissions]);

  const setActivePanel = (id: AdminPanelId) => {
    if (!isPanelAllowed(id, isMaster, permissions)) return;
    setActivePanelState(id);
    window.location.hash = id;
  };

  const can = (permission: string) =>
    isMaster || permissions.includes('*') || permissions.includes(permission);

  const canAccessPanel = (panelId: AdminPanelId) =>
    isPanelAllowed(panelId, isMaster, permissions);

  return (
    <AdminPanelContext.Provider
      value={{
        isMaster,
        adminId: verifiedAuth.id,
        permissions,
        allowedPanels,
        activePanel,
        setActivePanel,
        can,
        canAccessPanel,
      }}
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
