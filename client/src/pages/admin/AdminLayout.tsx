import { Link, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkAuth, logout } from '../../api/auth';
import {
  AdminPanelProvider,
  useAdminPanel,
  type AdminPanelId,
  type VerifiedAdminAuth,
} from '../../context/AdminPanelContext';
import { adminLoginPath, portalLoginPath, staffLoginPath } from '../../utils/adminPanelHash';
import { clearAdminPortal, portalFromAuth, readAdminPortal, storeAdminPortal } from '../../utils/adminSession';
import { adminNavIcon } from './adminNavIcons';

function AdminShell() {
  const { activePanel, setActivePanel, isMaster, allowedPanels, adminName, employeeCode } = useAdminPanel();
  const navigate = useNavigate();
  const current = allowedPanels.find((p) => p.id === activePanel);
  const groups = [...new Set(allowedPanels.map((p) => p.group))];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    const portal = readAdminPortal();
    await logout();
    sessionStorage.removeItem('gu_admin');
    clearAdminPortal();
    navigate(portal === 'staff' ? staffLoginPath() : adminLoginPath());
  };

  const goPanel = (id: AdminPanelId) => {
    setActivePanel(id);
    setSidebarOpen(false);
  };

  return (
    <div className="admin-app visible" id="admin-app">
      <button type="button" className="admin-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
        <span aria-hidden>☰</span>
      </button>
      {sidebarOpen && <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden />}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Go-Unlisted Logo" className="sidebar-logo-img" />
          <div>
            <div className="sidebar-logo-text"><span className="logo-go">GO</span> <span className="logo-unlisted">UNLISTED</span></div>
            <span className="sidebar-logo-badge">{isMaster ? 'Master Admin' : 'Employee Panel'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="sidebar-group-label">{group}</div>
              {allowedPanels.filter((p) => p.group === group).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-link${activePanel === item.id ? ' active' : ''}`}
                  onClick={() => goPanel(item.id)}
                  title={item.hint}
                >
                  <span className="sidebar-link-icon" aria-hidden>{adminNavIcon(item.id)}</span>
                  <span className="sidebar-link-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
            Sign out
          </button>
          <Link to="/" className="sidebar-site-link">View public site ↗</Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <h1 className="admin-topbar-title">{current?.label || 'Dashboard'}</h1>
            {current?.hint && <p className="admin-topbar-hint">{current.hint}</p>}
          </div>
          <div className="admin-topbar-right">
            {isMaster ? (
              <span className="admin-badge">Master Admin</span>
            ) : (
              <div className="admin-user-chip" title={employeeCode ? `${adminName || 'Employee'} · ${employeeCode}` : (adminName || 'Employee')}>
                <div className="admin-user-chip-text">
                  <span className="admin-user-chip-name">{adminName || 'Employee'}</span>
                  {employeeCode && <span className="admin-user-chip-code">{employeeCode}</span>}
                </div>
                <span className="emp-badge">Employee</span>
              </div>
            )}
          </div>
        </header>
        <div className="admin-page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout() {
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [verifiedAuth, setVerifiedAuth] = useState<VerifiedAdminAuth | null>(null);

  useEffect(() => {
    document.title = 'Admin Panel — Go-Unlisted';
    document.documentElement.classList.add('admin-route');
    document.body.classList.add('admin-route');
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.documentElement.classList.remove('admin-route');
      document.body.classList.remove('admin-route');
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    checkAuth()
      .then((res) => {
        if (cancelled) return;
        if (res.authenticated && res.type === 'admin' && res.id) {
          const auth: VerifiedAdminAuth = {
            id: res.id,
            isMaster: !!res.isMaster,
            permissions: res.permissions || [],
            name: res.name || '',
            employeeCode: res.employeeCode || res.employeeId || '',
          };
          sessionStorage.setItem('gu_admin', JSON.stringify({
            id: auth.id,
            isMaster: auth.isMaster,
            name: auth.name,
            employeeCode: auth.employeeCode,
          }));
          storeAdminPortal(portalFromAuth(auth.isMaster, res.portal));
          setVerifiedAuth(auth);
          setAuthState('ok');
        } else {
          sessionStorage.removeItem('gu_admin');
          setAuthState('denied');
        }
      })
      .catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem('gu_admin');
          setAuthState('denied');
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Re-verify session when tab regains focus (blocks stale UI after logout elsewhere)
  useEffect(() => {
    if (authState !== 'ok') return;
    const recheck = () => {
      checkAuth().then((res) => {
        if (!res.authenticated || res.type !== 'admin') {
          sessionStorage.removeItem('gu_admin');
          setVerifiedAuth(null);
          setAuthState('denied');
        }
      }).catch(() => {
        sessionStorage.removeItem('gu_admin');
        setVerifiedAuth(null);
        setAuthState('denied');
      });
    };
    window.addEventListener('focus', recheck);
    return () => window.removeEventListener('focus', recheck);
  }, [authState]);

  if (authState === 'loading') {
    return <div className="admin-login-screen"><p style={{ color: 'var(--muted)' }}>Verifying session...</p></div>;
  }
  if (authState === 'denied' || !verifiedAuth) {
    const portal = readAdminPortal() ?? 'master';
    return <Navigate to={portalLoginPath(portal)} replace />;
  }

  return (
    <AdminPanelProvider verifiedAuth={verifiedAuth}>
      <AdminShell />
    </AdminPanelProvider>
  );
}
