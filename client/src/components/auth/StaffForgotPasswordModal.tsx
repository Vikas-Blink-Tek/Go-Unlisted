import { useState } from 'react';
import OtpModal from './OtpModal';
import { resetStaffPassword, sendStaffResetOtp, verifyOtp } from '../../api/auth';
import { useToast } from '../../context/ToastContext';
import { blockNewPasswordInput, blockTextInput } from '../../utils/autofill';

interface Props {
  onClose: () => void;
}

type Step = 'identify' | 'otp' | 'password';

export default function StaffForgotPasswordModal({ onClose }: Props) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('identify');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await sendStaffResetOtp(loginId.trim());
      if (!res.success) throw new Error(res.error || 'Failed to send OTP');
      setEmail(res.email || loginId.trim());
      setDevOtp(res.dev_otp || null);
      if (res.dev_otp) {
        showToast('Local dev: OTP shown on screen below', 'info');
      } else if (res.email_sent === false) {
        showToast('Email could not be delivered. Ask admin to configure SMTP (info@go-unlisted.com).', 'error');
      } else {
        showToast(`OTP sent to ${res.email}. Check spam/promotions.`, 'success');
      }
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = async (otp: string) => {
    const targetEmail = email || loginId.trim();
    const res = await verifyOtp(targetEmail, otp);
    if (!res.success) throw new Error(res.error || 'Invalid OTP');
    setEmail(targetEmail);
    setStep('password');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await resetStaffPassword(email, password);
      if (!res.success) throw new Error(res.error || 'Reset failed');
      showToast('Password updated. You can sign in now.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <OtpModal
        email={email}
        devOtp={devOtp}
        title="Verify work email"
        subtitle={email ? `Enter the 6-digit OTP sent to ${email}` : 'Enter the OTP sent to your work email'}
        onClose={onClose}
        onVerify={handleOtpVerified}
        onResend={async () => {
          const res = await sendStaffResetOtp(loginId.trim());
          if (!res.success) throw new Error(res.error || 'Failed to resend OTP');
          if (res.dev_otp) setDevOtp(res.dev_otp);
          return res.dev_otp;
        }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        {step === 'identify' ? (
          <>
            <h3 style={{ marginBottom: '0.5rem' }}>Reset employee password</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Enter your work email or employee ID. OTP is sent to your registered work email.
            </p>
            {error && <div className="form-error show">{error}</div>}
            <div className="form-group">
              <label className="form-label">Email / Employee ID</label>
              <input
                className="form-input"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="you@company.com or GUE001"
                {...blockTextInput({ name: 'staff-reset-login' })}
              />
            </div>
            <button type="button" className="btn btn-primary btn-full" disabled={loading} onClick={sendOtp}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={onClose}>Cancel</button>
          </>
        ) : (
          <form onSubmit={handleReset}>
            <h3 style={{ marginBottom: '0.5rem' }}>Set new password</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Choose a new password for {email}
            </p>
            {error && <div className="form-error show">{error}</div>}
            <div className="form-group">
              <label className="form-label">New password</label>
              <input
                className="form-input"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...blockNewPasswordInput({ name: 'staff-new-password' })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <input
                className="form-input"
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                {...blockNewPasswordInput({ name: 'staff-confirm-password' })}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Saving...' : 'Update password'}
            </button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={onClose}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}
