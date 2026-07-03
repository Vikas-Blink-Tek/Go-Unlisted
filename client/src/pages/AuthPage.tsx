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
import { isValidIndianMobile, normalizeIndianPhone } from '../utils/phone';
import { isValidMpin } from '../utils/mpin';

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const { login, setUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const [loginForm, setLoginForm] = useState({ email: '', mpin: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', mpin: '', confirmMpin: '', referral: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [showForgotMpin, setShowForgotMpin] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      setTab('register');
      setRegForm((f) => ({ ...f, referral: ref.toUpperCase() }));
    }
  }, []);

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
    if (!isValidIndianMobile(regForm.phone)) {
      setError('Enter a valid 10-digit Indian mobile number (starts with 6–9)');
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
      const phone = normalizeIndianPhone(regForm.phone);
      const otpRes = await sendOtp(regForm.email, phone);
      if (!otpRes.success) throw new Error(otpRes.error || 'Failed to send OTP');
      if (!otpRes.dev_mode && !otpRes.sms_sent) {
        throw new Error(otpRes.error || 'Could not send OTP to your phone. Check the number and try again.');
      }
      setShowOtp(true);
      if (otpRes.sms_sent) {
        showToast(`OTP sent to +91 ${phone}`, 'success');
      } else if (otpRes.dev_mode) {
        showToast('Dev mode: OTP is in api/php_errors.log on the server', 'info');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (otp: string) => {
    const phone = normalizeIndianPhone(regForm.phone);
    const verifyRes = await verifyOtp(phone, otp);
    if (!verifyRes.success) throw new Error(verifyRes.error || 'Invalid OTP');

    const saveRes = await saveUser({
      name: regForm.name,
      email: regForm.email,
      phone,
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

          {error && <div className="form-error show" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          {tab === 'login' ? (
            <form id="login-form" onSubmit={handleLogin} autoComplete="on">
              <div className="form-group">
                <label className="form-label">Email or Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="you@example.com or 9876543210"
                  required
                  autoComplete="username"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">MPIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="form-input mpin-input"
                  placeholder="4-6 digit MPIN"
                  required
                  autoComplete="current-password"
                  value={loginForm.mpin}
                  onChange={(e) => setLoginForm({ ...loginForm, mpin: onMpinInput(e.target.value) })}
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
                  <p className="form-hint" style={{ marginTop: '0.35rem' }}>We&apos;ll send a one-time code to verify this number</p>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" placeholder="you@example.com" required value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} {...blockEmailInput({ name: 'register-email' })} />
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
                {loading ? 'Sending OTP...' : 'Verify Phone & Create Account'}
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
          phone={normalizeIndianPhone(regForm.phone)}
          title="Verify Your Phone"
          subtitle={`Enter the 6-digit code sent to +91 ${normalizeIndianPhone(regForm.phone)}`}
          onClose={() => setShowOtp(false)}
          onVerify={completeRegistration}
          onResend={async () => {
            const phone = normalizeIndianPhone(regForm.phone);
            const res = await sendOtp(regForm.email, phone);
            if (!res.success) throw new Error(res.error || 'Failed to resend');
            if (!res.dev_mode && !res.sms_sent) throw new Error(res.error || 'SMS failed');
            showToast(`OTP resent to +91 ${phone}`, 'info');
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
