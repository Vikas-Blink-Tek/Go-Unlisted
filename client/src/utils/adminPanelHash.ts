import {
  panelsForRole,
  type AdminPanelId,
  DEFAULT_EMPLOYEE_PERMISSIONS,
} from '../context/AdminPanelContext';

export function parseAdminPanelHash(): AdminPanelId | null {
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return null;
  const allowedIds = panelsForRole(true, ['*']).map((p) => p.id);
  return allowedIds.includes(raw as AdminPanelId) ? (raw as AdminPanelId) : null;
}

export function normalizeAdminPermissions(isMaster: boolean, perms?: string[]): string[] {
  if (isMaster || perms?.includes('*')) return ['*'];
  return perms?.length ? perms : [...DEFAULT_EMPLOYEE_PERMISSIONS];
}

/** Resolve URL hash to a panel this admin is allowed to open (blocks URL manipulation). */
export function resolveAdminPanel(
  requested: AdminPanelId | null,
  isMaster: boolean,
  permissions: string[],
): AdminPanelId {
  const allowed = panelsForRole(isMaster, permissions);
  const target = requested || 'dashboard';
  return allowed.some((p) => p.id === target) ? target : (allowed[0]?.id ?? 'dashboard');
}

export function isPanelAllowed(
  panelId: AdminPanelId,
  isMaster: boolean,
  permissions: string[],
): boolean {
  return panelsForRole(isMaster, permissions).some((p) => p.id === panelId);
}

export function adminLoginPath(panel?: string | null): string {
  const p = panel || parseAdminPanelHash();
  return p ? `/admin/login?panel=${encodeURIComponent(p)}` : '/admin/login';
}

export function staffLoginPath(panel?: string | null, loginId?: string | null): string {
  const id = loginId?.trim();
  if (id) return `/staff/${encodeURIComponent(id)}`;
  const p = panel || parseAdminPanelHash();
  return p ? `/staff/login?panel=${encodeURIComponent(p)}` : '/staff/login';
}

/** Short direct link — prefers employee ID (/staff/GUE001) over long email query. */
export function staffDirectLoginPath(emp: { email?: string; employee_id?: string }): string {
  const empId = emp.employee_id?.trim();
  if (empId) return `/staff/${encodeURIComponent(empId)}`;
  const email = emp.email?.trim();
  if (email) return `/staff/login?u=${encodeURIComponent(email)}`;
  return '/staff/login';
}

export function staffDirectLoginUrl(origin: string, emp: { email?: string; employee_id?: string }): string {
  return `${origin.replace(/\/$/, '')}${staffDirectLoginPath(emp)}`;
}

/** Investor signup link — ties user to this employee's code for orders/initiate. */
export function staffSignupReferralUrl(origin: string, employeeId: string): string {
  const id = employeeId.trim();
  if (!id) return `${origin.replace(/\/$/, '')}/login`;
  return `${origin.replace(/\/$/, '')}/login?ref=${encodeURIComponent(id)}`;
}

export function portalLoginPath(portal: 'master' | 'staff', panel?: string | null): string {
  return portal === 'staff' ? staffLoginPath(panel) : adminLoginPath(panel);
}

export function adminPanelPath(
  panel?: AdminPanelId | null,
  isMaster?: boolean,
  permissions?: string[],
): string {
  const resolved =
    isMaster !== undefined && permissions
      ? resolveAdminPanel(panel || parseAdminPanelHash(), isMaster, permissions)
      : panel || parseAdminPanelHash() || 'dashboard';
  return `/admin#${resolved}`;
}
