import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Clear rates only after auth check finishes and user is logged in. */
export function useCanViewShareRates(): boolean {
  const { user, loading } = useAuth();
  if (loading) return false;
  return !!user;
}

/** Compact text link (detail pages, etc.). */
export function LoginToViewRates({ compact }: { compact?: boolean }) {
  const location = useLocation();
  return (
    <Link
      to="/login"
      state={{ from: location.pathname + location.search }}
      className={compact ? 'share-rate-login share-rate-login--compact' : 'share-rate-login'}
      onClick={(e) => e.stopPropagation()}
    >
      {compact ? 'Login for rates' : 'Login to see the share prices'}
    </Link>
  );
}

/**
 * Shows real rates underneath a blur + overlay.
 * Guests see genuine-looking prices (not ₹0) until they log in.
 */
export function BlurredRatesLock({
  children,
  className = '',
  message = 'Login to see the share prices',
}: {
  children: ReactNode;
  className?: string;
  message?: string;
}) {
  const canView = useCanViewShareRates();
  const location = useLocation();

  if (canView) {
    return <>{children}</>;
  }

  return (
    <div className={`share-rates-blur-wrap${className ? ` ${className}` : ''}`}>
      <div className="share-rates-blur-content" aria-hidden="true">
        {children}
      </div>
      <Link
        to="/login"
        state={{ from: location.pathname + location.search }}
        className="share-rates-blur-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <span>{message}</span>
      </Link>
    </div>
  );
}
