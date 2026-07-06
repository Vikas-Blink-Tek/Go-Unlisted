import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const DISMISS_KEY = 'gu_welcome_auth_dismissed';

type Props = {
  /** Current path — hide on login/admin */
  pathname: string;
};

/**
 * Optional login/signup prompt when browsing.
 * User can dismiss and keep browsing; payment still requires login.
 */
export default function WelcomeAuthModal({ pathname }: Props) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || user) {
      setOpen(false);
      return;
    }
    if (pathname.startsWith('/login') || pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname.startsWith('/checkout')) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(t);
  }, [user, loading, pathname]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay welcome-auth-overlay" role="presentation">
      <div
        className="modal-card welcome-auth-card"
        role="dialog"
        aria-labelledby="welcome-auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="welcome-auth-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
        <img src="/logo.png" alt="" className="welcome-auth-logo" />
        <h2 id="welcome-auth-title">Welcome to GO UNLISTED</h2>
        <p className="welcome-auth-text">
          Login or create an account to track orders, complete KYC, and buy Pre-IPO shares.
          You can browse listings without signing in.
        </p>
        <div className="welcome-auth-actions">
          <Link to="/login" state={{ from: pathname }} className="btn btn-primary btn-full" onClick={dismiss}>
            Login
          </Link>
          <Link
            to="/login"
            state={{ from: pathname, tab: 'register' }}
            className="btn btn-outline btn-full"
            onClick={dismiss}
          >
            Sign up
          </Link>
          <button type="button" className="btn btn-ghost btn-full" onClick={dismiss}>
            Continue browsing
          </button>
        </div>
        <p className="welcome-auth-note">Payment requires login or signup.</p>
      </div>
    </div>
  );
}
