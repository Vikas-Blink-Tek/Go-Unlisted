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
  const p = panel || parseAdminPanelHash();
  const base = p ? `/staff/login?panel=${encodeURIComponent(p)}` : '/staff/login';
  if (!loginId?.trim()) return base;
  const id = loginId.trim();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}u=${encodeURIComponent(id)}`;
}

/** Full URL for one employee — opens staff login with email/ID pre-filled. */
export function staffDirectLoginUrl(origin: string, emp: { email?: string; employee_id?: string }): string {
  const loginId = emp.email || emp.employee_id || '';
  const path = staffLoginPath(null, loginId);
  return `${origin.replace(/\/$/, '')}${path}`;
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
