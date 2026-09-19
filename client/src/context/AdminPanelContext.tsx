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
  | 'signups'
  | 'cancel-refund'
  | 'employees'
  | 'franchises'
  | 'inventory'
  | 'invoices'
  | 'prices'
  | 'offers'
  | 'articles'
  | 'reports'
  | 'settings'
  | 'view-all-orders'
  | 'view-all-kyc'
  | 'view-all-initiated';

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
  isFranchiseMaster?: boolean;
  franchiseId?: string;
  franchiseName?: string;
  permissions: string[];
  name?: string;
  employeeCode?: string;
}

const FRANCHISE_MASTER_BLOCKED: AdminPanelId[] = ['franchises', 'settings', 'inventory', 'prices', 'articles'];

/** Not assignable when a franchise master creates / edits their team. */
export const FRANCHISE_EMPLOYEE_BLOCKED: AdminPanelId[] = [
  'prices',
  'articles',
  'reports',
  'settings',
];

export function employeePermissionOptions(forFranchiseMaster = false) {
  if (!forFranchiseMaster) return EMPLOYEE_PERMISSION_OPTIONS;
  return EMPLOYEE_PERMISSION_OPTIONS.filter((o) => !FRANCHISE_EMPLOYEE_BLOCKED.includes(o.id));
}

export function filterEmployeePermissionsForFranchise(perms: AdminPanelId[]): AdminPanelId[] {
  return perms.filter((p) => !FRANCHISE_EMPLOYEE_BLOCKED.includes(p));
}

export const EMPLOYEE_PERMISSION_OPTIONS: { id: AdminPanelId; label: string; group: string }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { id: 'pending', label: 'Verify Payments', group: 'Orders' },
  { id: 'initiated', label: 'Initiate', group: 'Orders' },
  { id: 'orders', label: 'All Orders', group: 'Orders' },
  { id: 'manual-order', label: 'Manual Order', group: 'Orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Orders' },
  { id: 'users', label: 'Users & KYC', group: 'Clients' },
  { id: 'signups', label: 'User Signups', group: 'Clients' },
  { id: 'view-all-orders', label: 'View All Orders (all codes)', group: 'Data Scope' },
  { id: 'view-all-kyc', label: 'View All KYC (all codes)', group: 'Data Scope' },
  { id: 'view-all-initiated', label: 'View All Initiate (all codes)', group: 'Data Scope' },
  { id: 'prices', label: 'Stocks & Listings', group: 'Catalog' },
  { id: 'offers', label: 'Festival Offers & Banners', group: 'Content' },
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
  'signups',
];

export const ADMIN_PANELS: AdminPanelDef[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', hint: 'Orders, signups & revenue' },
  { id: 'pending', label: 'Verify Payments', group: 'Order Pipeline', hint: 'Confirm NEFT / IMPS / UPI transfers' },
  { id: 'initiated', label: 'Initiate', group: 'Order Pipeline', hint: 'Buyers who started checkout but did not pay' },
  { id: 'orders', label: 'All Orders', group: 'Order Pipeline', hint: 'Full order history' },
  { id: 'manual-order', label: 'Manual Order', group: 'Order Pipeline', hint: 'Enter offline / phone orders' },
  { id: 'cancel-refund', label: 'Cancel / Refund', group: 'Order Pipeline', hint: 'Update order status' },
  { id: 'users', label: 'Users & KYC', group: 'Clients', hint: 'Registered investors' },
  { id: 'signups', label: 'User Signups', group: 'Clients', hint: 'Signup dates, timing & employee codes' },
  { id: 'employees', label: 'Employees', group: 'Team' },
  { id: 'franchises', label: 'Franchises', group: 'Team', masterOnly: true, hint: 'Create franchise masters & login access' },
  { id: 'inventory', label: 'Inventory', group: 'Back Office', masterOnly: true, hint: 'Qty on hand, cost & margins' },
  { id: 'invoices', label: 'Invoices', group: 'Back Office', masterOnly: true, hint: 'Tax invoices for confirmed orders' },
  { id: 'prices', label: 'Stocks & Listings', group: 'Catalog', hint: 'Description, pricing, inventory' },
  { id: 'offers', label: 'Festival Offers', group: 'Content', hint: 'Promotions, countdown banners, and deals' },
  { id: 'articles', label: 'Articles / Blog', group: 'Content' },
  { id: 'reports', label: 'Reports & Export', group: 'Analytics' },
  { id: 'settings', label: 'Site Settings', group: 'System' },
];

export function panelsForRole(isMaster: boolean, permissions: string[] = [], isFranchiseMaster = false) {
  if (isMaster || permissions.includes('*')) {
    return ADMIN_PANELS;
  }
  if (isFranchiseMaster) {
    return ADMIN_PANELS.filter((p) => !p.masterOnly && !FRANCHISE_MASTER_BLOCKED.includes(p.id));
  }
  return ADMIN_PANELS.filter((p) => !p.masterOnly && permissions.includes(p.id));
}

interface AdminPanelContextValue {
  isMaster: boolean;
  isFranchiseMaster: boolean;
  franchiseId: string;
  franchiseName: string;
  adminId: string;
  adminName: string;
  employeeCode: string;
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
  const isFranchiseMaster = !!verifiedAuth.isFranchiseMaster && !isMaster;
  const permissions = useMemo(
    () => normalizeAdminPermissions(isMaster, verifiedAuth.permissions),
    [isMaster, verifiedAuth.permissions],
  );
  const allowedPanels = useMemo(
    () => panelsForRole(isMaster, permissions, isFranchiseMaster),
    [isMaster, permissions, isFranchiseMaster],
  );

  const [activePanel, setActivePanelState] = useState<AdminPanelId>(() =>
    resolveAdminPanel(parseAdminPanelHash(), isMaster, permissions, isFranchiseMaster),
  );

  const applyPanel = (requested: AdminPanelId | null) => {
    const resolved = resolveAdminPanel(requested, isMaster, permissions, isFranchiseMaster);
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
  }, [isMaster, permissions, isFranchiseMaster]);

  useEffect(() => {
    const onHashChange = () => applyPanel(parseAdminPanelHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, permissions, isFranchiseMaster]);

  const setActivePanel = (id: AdminPanelId) => {
    if (!isPanelAllowed(id, isMaster, permissions, isFranchiseMaster)) return;
    setActivePanelState(id);
    window.location.hash = id;
  };

  const can = (permission: string) => {
    if (isMaster || permissions.includes('*')) return true;
    if (isFranchiseMaster) {
      if (FRANCHISE_MASTER_BLOCKED.includes(permission as AdminPanelId)) return false;
      return permissions.includes(permission);
    }
    return permissions.includes(permission);
  };

  const canAccessPanel = (panelId: AdminPanelId) =>
    isPanelAllowed(panelId, isMaster, permissions, isFranchiseMaster);

  return (
    <AdminPanelContext.Provider
      value={{
        isMaster,
        isFranchiseMaster,
        franchiseId: (verifiedAuth.franchiseId || '').trim(),
        franchiseName: (verifiedAuth.franchiseName || '').trim(),
        adminId: verifiedAuth.id,
        adminName: (verifiedAuth.name || '').trim(),
        employeeCode: (verifiedAuth.employeeCode || '').trim().toUpperCase(),
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
