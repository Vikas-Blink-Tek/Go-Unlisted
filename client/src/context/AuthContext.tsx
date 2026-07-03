import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { checkAuth, loginUser, logout as apiLogout } from '../api/auth';
import { setCsrfToken } from '../api/csrf';
import type { User } from '../types';

const USER_KEY = 'gu_current_user';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        if (res.csrfToken) setCsrfToken(res.csrfToken);
        if (res.authenticated && res.type === 'user' && res.user) {
          setUser(res.user);
        } else if (!res.authenticated) {
          setUser(null);
        }
      })
      .catch(() => {
        // Keep cached user if API unreachable (offline / PHP not running)
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await loginUser(email, password);
      if (res.success && res.user) {
        setUser(res.user);
        const auth = await checkAuth();
        if (auth.csrfToken) setCsrfToken(auth.csrfToken);
        return { success: true };
      }
      return { success: false, error: res.error || 'Login failed' };
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      setUser,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
