import { Link, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { checkAuth, logout } from '../../api/auth';
import { AdminPanelProvider, panelsForRole, useAdminPanel, type AdminPanelId } from '../../context/AdminPanelContext';
import { adminNavIcon } from './adminNavIcons';

function AdminShell() {
  const { activePanel, setActivePanel, isMaster, permissions, loading } = useAdminPanel();
  const navigate = useNavigate();
  const panels = panelsForRole(isMaster, permissions);
  const current = panels.find((p) => p.id === activePanel);
  const groups = [...new Set(panels.map((p) => p.group))];
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="admin-login-screen">
        <p style={{ color: 'var(--muted)' }}>Loading permissions...</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem('gu_admin');
    navigate('/admin/login');
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
              {panels.filter((p) => p.group === group).map((item) => (
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
            <span className={isMaster ? 'admin-badge' : 'emp-badge'}>{isMaster ? 'Master Admin' : 'Employee'}</span>
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
    checkAuth()
      .then((res) => {
        if (res.authenticated && res.type === 'admin') {
          sessionStorage.setItem('gu_admin', JSON.stringify({ id: res.id, isMaster: res.isMaster }));
          setAuthState('ok');
        } else {
          sessionStorage.removeItem('gu_admin');
          setAuthState('denied');
        }
      })
      .catch(() => { sessionStorage.removeItem('gu_admin'); setAuthState('denied'); });
  }, []);

  if (authState === 'loading') return <div className="admin-login-screen"><p style={{ color: 'var(--muted)' }}>Verifying session...</p></div>;
  if (authState === 'denied') return <Navigate to="/admin/login" replace />;

  return (
    <AdminPanelProvider>
      <AdminShell />
    </AdminPanelProvider>
  );
}
