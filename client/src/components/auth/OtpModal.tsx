import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OtpModalProps {
  email?: string;
  phone?: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
}

export default function OtpModal({ email, phone, title = 'Verify OTP', subtitle, onClose, onVerify, onResend }: OtpModalProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 5) {
      document.getElementById(`otp-${idx + 1}`)?.focus();
    }
    if (val && idx === 5) {
      const full = next.join('');
      if (full.length === 6) handleVerify(full);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  const handleVerify = async (otpOverride?: string) => {
    const otp = otpOverride || digits.join('');
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onVerify(otp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP');
      setDigits(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await onResend();
      setDigits(['', '', '', '', '', '']);
      setError('');
    } finally {
      setResending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-card"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <motion.span
              style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              🔐
            </motion.span>
            <h2>{title}</h2>
            <p className="modal-subtitle">
              {subtitle || (
                <>
                  Code sent to{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {phone ? `+91 ${phone}` : email}
                  </strong>
                </>
              )}
            </p>
          </div>

          <div className="otp-inputs">
            {digits.map((d, i) => (
              <motion.input
                key={i}
                id={`otp-${i}`}
                className="otp-input"
                maxLength={1}
                value={d}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
              />
            ))}
          </div>

          {error && (
            <motion.div
              className="form-error text-center show"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className="otp-hint">
            Didn&apos;t receive?{' '}
            <span onClick={resending ? undefined : handleResend} style={{ opacity: resending ? 0.5 : 1 }}>
              {resending ? 'Sending...' : 'Resend OTP'}
            </span>
          </div>

          <motion.button
            className="btn btn-primary btn-full"
            onClick={() => handleVerify()}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Verifying...' : 'Verify & Continue →'}
          </motion.button>
          <button className="btn btn-ghost btn-full mt-1" onClick={onClose}>Cancel</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
