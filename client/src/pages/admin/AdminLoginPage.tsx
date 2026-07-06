import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loginAdmin, checkAuth } from '../../api/auth';
import { setCsrfToken } from '../../api/csrf';
import { useToast } from '../../context/ToastContext';
import {
  adminPanelPath,
  normalizeAdminPermissions,
  resolveAdminPanel,
} from '../../utils/adminPanelHash';
import type { AdminPanelId } from '../../context/AdminPanelContext';
import type { AdminPortal } from '../../utils/adminSession';
import { clearAdminPortal, portalFromAuth, storeAdminPortal } from '../../utils/adminSession';

interface Props {
  portal: AdminPortal;
}

const COPY = {
  master: {
    title: 'Master Admin',
    subtitle: 'Owner access only — manage site, team, inventory & settings',
    toast: 'Welcome back, Admin!',
    otherLabel: 'Employee login',
    otherPath: '/staff/login',
  },
  staff: {
    title: 'Employee Portal',
    subtitle: 'Team sign-in — use your work email or employee ID',
    toast: 'Welcome back!',
    otherLabel: 'Master Admin login',
    otherPath: '/admin/login',
  },
} as const;

function persistAdminSession(
  id: string,
  isMaster: boolean,
  portal: AdminPortal,
) {
  sessionStorage.setItem('gu_admin', JSON.stringify({ id, isMaster }));
  storeAdminPortal(portal);
}

export default function AdminLoginPage({ portal }: Props) {
  const copy = COPY[portal];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { loginId: routeLoginId } = useParams();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const returnPanel = searchParams.get('panel') as AdminPanelId | null;
  const prefilledLogin =
    (routeLoginId && routeLoginId !== 'login' ? decodeURIComponent(routeLoginId) : '')
    || searchParams.get('u')
    || searchParams.get('email')
    || searchParams.get('id')
    || '';

  useEffect(() => {
    if (portal === 'staff' && prefilledLogin) {
      setEmail(prefilledLogin);
    }
  }, [portal, prefilledLogin]);

  useEffect(() => {
    document.title = portal === 'master' ? 'Master Admin Login — Go-Unlisted' : 'Employee Login — Go-Unlisted';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, [portal]);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        if (res.authenticated && res.type === 'admin') {
          const isMaster = !!res.isMaster;
          const sessionPortal = portalFromAuth(isMaster, res.portal);
          const perms = normalizeAdminPermissions(isMaster, res.permissions);
          persistAdminSession(res.id!, isMaster, sessionPortal);
          const panel = resolveAdminPanel(returnPanel, isMaster, perms);
          navigate(adminPanelPath(panel, isMaster, perms), { replace: true });
        }
      })
      .finally(() => setCheckingSession(false));
  }, [navigate, returnPanel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginAdmin(email, password, portal);
      if (res.success) {
        const isMaster = !!res.isMaster;
        const sessionPortal = portalFromAuth(isMaster, res.portal ?? portal);
        const perms = normalizeAdminPermissions(isMaster, res.permissions);
        persistAdminSession(res.id!, isMaster, sessionPortal);
        const auth = await checkAuth();
        if (auth.csrfToken) setCsrfToken(auth.csrfToken);
        showToast(copy.toast, 'success');
        const panel = resolveAdminPanel(returnPanel, isMaster, perms);
        navigate(adminPanelPath(panel, isMaster, perms));
      } else {
        showToast(res.error || 'Login failed', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="admin-login-screen">
        <p style={{ color: 'var(--muted)' }}>Checking session...</p>
      </div>
    );
  }

  return (
    <div className="admin-login-screen">
      <div className="admin-login-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Go-Unlisted" style={{ width: 56, marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--white)' }}>{copy.title}</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>{copy.subtitle}</p>
        </div>
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label className="form-label">{portal === 'staff' ? 'Email / Employee ID' : 'Email'}</label>
            <input
              className="form-input"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={portal === 'staff' ? 'you@company.com or GUE001' : 'jgond1992@gmail.com'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          {copy.otherLabel}?{' '}
          <Link
            to={returnPanel ? `${copy.otherPath}?panel=${encodeURIComponent(returnPanel)}` : copy.otherPath}
            onClick={() => clearAdminPortal()}
            style={{ color: 'var(--green-light)', fontWeight: 600 }}
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
