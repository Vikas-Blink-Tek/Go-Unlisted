import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getSettings } from '../../api/content';
import SiteFooter from './SiteFooter';
import LegalModal, { type LegalModalType } from './LegalModal';
import WhatsAppFloat from './WhatsAppFloat';
import WelcomeAuthModal from '../auth/WelcomeAuthModal';
import { kycBadgeClass, kycBadgeLabel, userInitials } from '../../utils/kyc';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/shares', label: 'Shares' },
  { to: '/dashboard', label: 'Portfolio' },
  { to: '/articles', label: 'Articles' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const mobileIcons: Record<string, ReactNode> = {
  '/': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  '/shares': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  '/dashboard': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  '/articles': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  '/about': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  '/contact': (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [legalType, setLegalType] = useState<LegalModalType | null>(null);

  const settingsQuery = useQuery({ queryKey: ['site-settings'], queryFn: getSettings });

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => {
    setDropdown(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = () => setDropdown(false);
    if (dropdown) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [dropdown]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setDropdown(false);
  };

  const profilePath = user ? '/dashboard' : '/login';

  return (
    <>
      <nav id="main-nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Go-Unlisted Logo" className="nav-logo-img" />
            <span className="nav-logo-text">
              <span className="logo-go">GO</span>{' '}
              <span className="logo-unlisted">UNLISTED</span>
            </span>
          </Link>

          <ul className="nav-links" id="nav-links">
            {navLinks.map((l) => {
              const isPortfolio = l.to === '/dashboard';
              const to = isPortfolio && !user ? '/login' : l.to;
              const state = isPortfolio && !user ? { from: '/dashboard', reason: 'portfolio' } : undefined;
              return (
                <li key={l.to}>
                  <Link className={`nav-link ${isActive(l.to) ? 'active' : ''}`} to={to} state={state}>
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="nav-actions">
            <div id="nav-user-section">
              {user ? (
                <div className="nav-user-dropdown-container">
                  <button
                    type="button"
                    className="nav-user-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdown(!dropdown);
                    }}
                  >
                    <div className="nav-avatar">{userInitials(user.name, user.email)}</div>
                    <span className="nav-username">{user.name || user.email.split('@')[0]}</span>
                    <span className="nav-user-badge-wrap" style={{ marginLeft: 4 }}>
                      <span className={`kyc-badge ${kycBadgeClass(user.kycStatus)}`}>
                        {kycBadgeLabel(user.kycStatus)}
                      </span>
                    </span>
                    <svg className="dropdown-arrow-icon" width="10" height="10" viewBox="0 0 24 24" strokeWidth="3" fill="none" stroke="currentColor" style={{ marginLeft: 6, transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div className={`nav-user-dropdown-menu${dropdown ? ' show' : ''}`} id="nav-user-dropdown-menu">
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-name">{user.name || user.email.split('@')[0]}</div>
                      <div className="dropdown-user-email">{user.email}</div>
                      <div className="dropdown-user-kyc" style={{ marginTop: 6 }}>
                        KYC Status:{' '}
                        <span className={`kyc-badge ${kycBadgeClass(user.kycStatus)}`}>
                          {kycBadgeLabel(user.kycStatus)}
                        </span>
                      </div>
                    </div>
                    <hr className="dropdown-divider" />
                    <Link to="/dashboard" className="dropdown-item" onClick={() => setDropdown(false)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                      My Orders
                    </Link>
                    <Link to="/dashboard?tab=kyc" className="dropdown-item" onClick={() => setDropdown(false)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                      KYC Verification
                    </Link>
                    <hr className="dropdown-divider" />
                    <button type="button" className="dropdown-item logout" onClick={handleLogout}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <Link to="/login" className="btn-nav-login">Login / Register</Link>
              )}
            </div>
            <button type="button" className={`hamburger ${menuOpen ? 'open' : ''}`} aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} id="mobile-menu">
        {navLinks.map((l) => {
          const isPortfolio = l.to === '/dashboard';
          const to = isPortfolio && !user ? '/login' : l.to;
          const state = isPortfolio && !user ? { from: '/dashboard', reason: 'portfolio' } : undefined;
          return (
            <Link key={l.to} className="nav-link" to={to} state={state} onClick={() => setMenuOpen(false)}>
              {mobileIcons[l.to]}
              {l.label}
            </Link>
          );
        })}
        {!user && (
          <Link className="nav-link" to="/login" onClick={() => setMenuOpen(false)}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Login / Register
          </Link>
        )}
      </div>

      <main>
        <Outlet />
      </main>

      <SiteFooter onLegalOpen={setLegalType} />

      <LegalModal type={legalType} settings={settingsQuery.data} onClose={() => setLegalType(null)} />

      <WhatsAppFloat />
      <WelcomeAuthModal pathname={location.pathname} />

      <nav className="bottom-nav">
        <Link to="/" className={`bottom-nav-item${location.pathname === '/' ? ' active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          <span>Home</span>
        </Link>
        <Link
          to={user ? '/dashboard' : '/login'}
          state={user ? undefined : { from: '/dashboard', reason: 'portfolio' }}
          className={`bottom-nav-item${location.pathname.startsWith('/dashboard') || (!user && location.pathname === '/login') ? ' active' : ''}`}
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          <span>Portfolio</span>
        </Link>
        <Link to="/articles" className={`bottom-nav-item${location.pathname.startsWith('/articles') ? ' active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <span>Articles</span>
        </Link>
        <Link to={profilePath} className={`bottom-nav-item${location.pathname === '/login' ? ' active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
