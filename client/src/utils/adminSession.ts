export type AdminPortal = 'master' | 'staff';

const PORTAL_KEY = 'gu_admin_portal';

export function storeAdminPortal(portal: AdminPortal) {
  sessionStorage.setItem(PORTAL_KEY, portal);
}

export function readAdminPortal(): AdminPortal | null {
  const v = sessionStorage.getItem(PORTAL_KEY);
  return v === 'master' || v === 'staff' ? v : null;
}

export function clearAdminPortal() {
  sessionStorage.removeItem(PORTAL_KEY);
}

export function portalFromAuth(isMaster?: boolean, portal?: AdminPortal): AdminPortal {
  if (portal === 'master' || portal === 'staff') return portal;
  return isMaster ? 'master' : 'staff';
}
