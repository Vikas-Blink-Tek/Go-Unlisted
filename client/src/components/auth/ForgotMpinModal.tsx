import { useState } from 'react';
import OtpModal from './OtpModal';
import { resetMpin, sendResetOtp, verifyOtp } from '../../api/auth';
import { isValidMpin } from '../../utils/mpin';
import AutofillBlocker from '../forms/AutofillBlocker';
import { blockNewPasswordInput, blockTextInput } from '../../utils/autofill';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

type Step = 'identify' | 'otp' | 'mpin';

export default function ForgotMpinModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('identify');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [mpin, setMpin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!loginId.trim()) {
      setError('Enter your registered email or phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await sendResetOtp(loginId.trim());
      if (!res.success) throw new Error(res.error || 'Failed to send OTP');
      if (res.email) setEmail(res.email);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = async (otp: string) => {
    if (!email) throw new Error('Account email not found. Please try again.');
    const res = await verifyOtp(email, otp);
    if (!res.success) throw new Error(res.error || 'Invalid OTP');
    setStep('mpin');
  };

  const submitNewMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMpin(mpin)) {
      setError('MPIN must be 4-6 digits');
      return;
    }
    if (mpin !== confirm) {
      setError('MPINs do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await resetMpin(email, mpin);
      if (!res.success) throw new Error(res.error || 'Failed to reset MPIN');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset MPIN');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <OtpModal
        email={email}
        title="Reset MPIN"
        subtitle="Enter the OTP sent to your registered email"
        onClose={onClose}
        onVerify={handleOtpVerified}
        onResend={async () => {
          await sendResetOtp(loginId.trim());
        }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3 className="modal-title">Forgot MPIN?</h3>
        <p className="modal-subtitle">
          {step === 'identify'
            ? 'Enter your registered email or phone. We will send an OTP to reset your MPIN.'
            : 'Create a new 4-6 digit MPIN for your account.'}
        </p>

        {error && <div className="form-error show" style={{ marginBottom: '0.75rem' }}>{error}</div>}

        {step === 'identify' ? (
          <>
            <div className="form-group">
              <label className="form-label">Email or Phone Number</label>
              <input
                className="form-input"
                placeholder="you@example.com or 9876543210"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                {...blockTextInput({ name: 'forgot-mpin-login' })}
              />
            </div>
            <button type="button" className="btn btn-primary btn-full" disabled={loading} onClick={sendOtp}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <form onSubmit={submitNewMpin} autoComplete="off" style={{ position: 'relative' }}>
            <AutofillBlocker />
            <div className="form-group">
              <label className="form-label">New MPIN</label>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="form-input mpin-input"
                placeholder="4-6 digit MPIN"
                value={mpin}
                onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                {...blockNewPasswordInput({ name: 'forgot-new-mpin' })}
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
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                {...blockNewPasswordInput({ name: 'forgot-confirm-mpin' })}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Saving...' : 'Reset MPIN'}
            </button>
          </form>
        )}

        <button type="button" className="btn btn-ghost btn-full mt-1" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
