import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdmin, checkAuth } from '../../api/auth';
import { setCsrfToken } from '../../api/csrf';
import { useToast } from '../../context/ToastContext';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    document.title = 'Admin Login — Go-Unlisted';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginAdmin(email, password);
      if (res.success) {
        sessionStorage.setItem('gu_admin', JSON.stringify({ id: res.id, isMaster: res.isMaster }));
        const auth = await checkAuth();
        if (auth.csrfToken) setCsrfToken(auth.csrfToken);
        showToast('Welcome back, Admin!', 'success');
        navigate('/admin');
      } else {
        showToast(res.error || 'Login failed', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-screen">
      <div className="admin-login-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Go-Unlisted" style={{ width: 56, marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--white)' }}>Admin Portal</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Secure access for administrators &amp; employees</p>
        </div>
        <form onSubmit={handleSubmit} autoComplete="on">
          <div className="form-group">
            <label className="form-label">Email / Employee ID</label>
            <input className="form-input" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gounlisted.com or GU001" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}
