import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import OtpModal from '../components/auth/OtpModal';
import ForgotMpinModal from '../components/auth/ForgotMpinModal';
import AutofillBlocker from '../components/forms/AutofillBlocker';
import { sendOtp, verifyOtp, saveUser, checkAuth } from '../api/auth';
import { setCsrfToken } from '../api/csrf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { blockEmailInput, blockNewPasswordInput, blockTelInput, blockTextInput } from '../utils/autofill';
import { isValidMpin } from '../utils/mpin';

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const { login, setUser, user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { from?: string; reason?: string; tab?: 'login' | 'register' } | null) ?? {};
  const from = navState.from || '/';
  const portfolioGate = navState.reason === 'portfolio';
  const paymentGate = navState.reason === 'payment';

  const [loginForm, setLoginForm] = useState({ email: '', mpin: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', mpin: '', confirmMpin: '', referral: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showForgotMpin, setShowForgotMpin] = useState(false);
  const [regDevOtp, setRegDevOtp] = useState<string | null>(null);

  // Always start with empty fields — never show browser-saved emails
  useEffect(() => {
    setLoginForm({ email: '', mpin: '' });
    setError('');
  }, [location.key]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from === '/login' ? '/dashboard' : from, { replace: true });
    }
  }, [authLoading, user, from, navigate]);

  useEffect(() => {
    if (navState.tab === 'register' || navState.tab === 'login') {
      setTab(navState.tab);
    }
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      setTab('register');
      setRegForm((f) => ({ ...f, referral: ref.toUpperCase() }));
    }
  }, [navState.tab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMpin(loginForm.mpin)) {
      setError('Enter your 4-6 digit MPIN');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await login(loginForm.email, loginForm.mpin);
      if (res.success) {
        showToast('Welcome back!', 'success');
        navigate(from);
      } else {
        setError(res.error || 'Login failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phone = regForm.phone.replace(/\D/g, '').slice(0, 10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (!isValidMpin(regForm.mpin)) {
      setError('MPIN must be 4-6 digits');
      return;
    }
    if (regForm.mpin !== regForm.confirmMpin) {
      setError('MPINs do not match');
      return;
    }
    setLoading(true);
    try {
      const otpRes = await sendOtp(regForm.email);
      if (!otpRes.success) throw new Error(otpRes.error || 'Failed to send OTP');
      if (otpRes.email_sent === false && !otpRes.dev_otp) {
        throw new Error(otpRes.error || 'Could not deliver OTP email. Try again or contact support.');
      }
      setRegDevOtp(otpRes.dev_otp || null);
      setShowOtp(true);
      if (otpRes.dev_otp) {
        showToast('Local dev: OTP shown on screen below', 'info');
      } else {
        showToast(`OTP sent to ${regForm.email}. Check inbox and spam folder.`, 'success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (otp: string) => {
    const verifyRes = await verifyOtp(regForm.email, otp);
    if (!verifyRes.success) throw new Error(verifyRes.error || 'Invalid OTP');

    const saveRes = await saveUser({
      name: regForm.name,
      email: regForm.email,
      phone: regForm.phone.replace(/\D/g, '').slice(0, 10),
      password: regForm.mpin,
      role: 'user',
      kycStatus: 'Not Submitted',
      referralCode: regForm.referral,
    });

    if (!saveRes.success) throw new Error('Failed to create account');

    const auth = await checkAuth();
    if (auth.csrfToken) setCsrfToken(auth.csrfToken);
    if (auth.user) {
      setUser(auth.user);
    } else {
      setUser({
        id: saveRes.id || '',
        name: regForm.name,
        email: regForm.email,
        phone: regForm.phone,
        kycStatus: 'Not Submitted',
      });
    }

    setShowOtp(false);
    showToast('Account created! Welcome to Go-Unlisted', 'success');
    navigate('/');
  };

  const onMpinInput = (value: string) => value.replace(/\D/g, '').slice(0, 6);

  return (
    <div className="view" id="view-auth">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/logo.png" alt="Go-Unlisted Logo" style={{ width: 80, height: 80, objectFit: 'contain', margin: '0 auto 0.875rem', display: 'block' }} />
            <h2 className="auth-card-title">
              <span className="logo-go">GO</span>{' '}
              <span className="logo-unlisted">UNLISTED</span>
            </h2>
            <p className="auth-card-subtitle">India&apos;s Pre-IPO Investment Platform</p>
          </div>

          <div className="auth-tabs">
            <button type="button" className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Login</button>
            <button type="button" className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Register</button>
          </div>

          {portfolioGate && (
            <div className="auth-gate-banner">
              Login to view your portfolio, orders, and KYC status.
            </div>
          )}
          {paymentGate && (
            <div className="auth-gate-banner">
              Login or sign up to continue payment. Guest checkout is not allowed.
            </div>
          )}

          {error && <div className="form-error show" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          {tab === 'login' ? (
            <form id="login-form" onSubmit={handleLogin} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              <div className="form-group">
                <label className="form-label">Email or Phone Number</label>
                <input
                  className="form-input"
                  placeholder="you@example.com or 9876543210"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  {...blockTextInput({ name: 'login-id', autoComplete: 'off' })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">MPIN</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="form-input mpin-input"
                  placeholder="4-6 digit MPIN"
                  required
                  value={loginForm.mpin}
                  onChange={(e) => setLoginForm({ ...loginForm, mpin: onMpinInput(e.target.value) })}
                  {...blockNewPasswordInput({ name: 'login-mpin' })}
                />
                <p className="auth-forgot-wrap">
                  <button type="button" className="auth-forgot-link" onClick={() => setShowForgotMpin(true)}>
                    Forgot MPIN?
                  </button>
                </p>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Login to Account'}
              </button>
              <div className="auth-divider">or</div>
              <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)' }}>
                Don&apos;t have an account?{' '}
                <span style={{ color: 'var(--gold)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setTab('register')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setTab('register')}>
                  Register here
                </span>
              </p>
            </form>
          ) : (
            <form id="register-form" onSubmit={handleRegister} autoComplete="off" style={{ position: 'relative' }}>
              <AutofillBlocker />
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" placeholder="Rahul Sharma" required value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} {...blockTextInput({ name: 'register-full-name' })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    className="form-input"
                    placeholder="9876543210"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    {...blockTelInput({ name: 'register-phone' })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input className="form-input" placeholder="you@example.com" required value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} {...blockEmailInput({ name: 'register-email' })} />
                <p className="form-hint" style={{ marginTop: '0.35rem' }}>We&apos;ll send a one-time code to verify this email</p>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Create MPIN</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="form-input mpin-input"
                    placeholder="4-6 digits"
                    required
                    value={regForm.mpin}
                    onChange={(e) => setRegForm({ ...regForm, mpin: onMpinInput(e.target.value) })}
                    {...blockNewPasswordInput({ name: 'register-mpin' })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm MPIN</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="form-input mpin-input"
                    placeholder="Re-enter MPIN"
                    required
                    value={regForm.confirmMpin}
                    onChange={(e) => setRegForm({ ...regForm, confirmMpin: onMpinInput(e.target.value) })}
                    {...blockNewPasswordInput({ name: 'register-mpin-confirm' })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Referral Code (Optional)</label>
                <input className="form-input" placeholder="Enter referral code" style={{ textTransform: 'uppercase' }} value={regForm.referral} onChange={(e) => setRegForm({ ...regForm, referral: e.target.value.toUpperCase() })} {...blockTextInput({ name: 'register-referral' })} />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Verify Email & Create Account'}
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1rem' }}>
                By registering, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          )}
        </div>
      </div>

      {showOtp && (
        <OtpModal
          email={regForm.email}
          devOtp={regDevOtp}
          title="Verify Your Email"
          subtitle={`Enter the 6-digit code sent to ${regForm.email}`}
          onClose={() => setShowOtp(false)}
          onVerify={completeRegistration}
          onResend={async () => {
            const res = await sendOtp(regForm.email);
            if (!res.success) throw new Error(res.error || 'Failed to resend');
            if (res.dev_otp) setRegDevOtp(res.dev_otp);
            showToast(res.dev_otp ? 'New OTP shown below' : `OTP resent to ${regForm.email}`, 'info');
            return res.dev_otp;
          }}
        />
      )}

      {showForgotMpin && (
        <ForgotMpinModal
          onClose={() => setShowForgotMpin(false)}
          onSuccess={() => showToast('MPIN reset successfully. You can log in now.', 'success')}
        />
      )}
    </div>
  );
}
