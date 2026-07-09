import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import OtpModal from '../components/auth/OtpModal';
import { deleteMyAccount, getAccountContacts, sendResetOtp, verifyOtp } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatIndianPhoneDisplay } from '../utils/format';
import { whatsappUrl } from '../utils/whatsapp';

export default function AccountManagerPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showDeleteOtp, setShowDeleteOtp] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contactsQuery = useQuery({
    queryKey: ['account-contacts'],
    queryFn: getAccountContacts,
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: '/dashboard/support' } });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="view" id="view-account-manager">
        <p className="page-subtitle" style={{ padding: '2rem 1rem' }}>Loading…</p>
      </div>
    );
  }

  const support = contactsQuery.data?.support;
  const rm = contactsQuery.data?.relationManager;
  const rmPhone = rm?.phone || '';
  const supportPhone = support?.phone || '';
  const whatsappTarget = rmPhone || support?.whatsapp || supportPhone;
  const emailTarget = rm?.email || support?.email || user.email;

  const startDelete = async () => {
    if (!window.confirm('Delete your account permanently? This cannot be undone. Your order history will be removed.')) {
      return;
    }
    try {
      const res = await sendResetOtp(user.email);
      if (!res.success) throw new Error(res.error || 'Could not send verification email');
      setDeleteOtp(res.dev_otp || null);
      if (res.dev_otp) {
        showToast('Local dev: OTP shown on screen', 'info');
      } else if (res.email_sent === false) {
        showToast('Email could not be sent. Check SMTP settings or try Resend.', 'error');
      } else {
        showToast(`Verification OTP sent to ${res.email || user.email}`, 'success');
      }
      setShowDeleteOtp(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send OTP', 'error');
    }
  };

  const confirmDelete = async (otp: string) => {
    await verifyOtp(user.email, otp);
    setDeleting(true);
    try {
      const res = await deleteMyAccount('delete');
      if (!res.success) throw new Error(res.error || 'Could not delete account');
      await logout();
      showToast('Your account has been deleted', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Account deletion failed', 'error');
      throw err;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="view" id="view-account-manager">
      <div className="account-manager-wrap">
        <div className="account-manager-header">
          <Link to="/dashboard" className="account-manager-back" aria-label="Back to dashboard">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="account-manager-title">Connect Account Manager</h1>
        </div>

        <p className="account-manager-intro">
          Reach out to your dedicated account manager for personalized support on KYC, orders, payments, and any other queries.
        </p>

        <div className="account-manager-card glass-card">
          {contactsQuery.isLoading ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>Loading contact details…</p>
          ) : (
            <>
              {rm?.phone ? (
                <div className="account-manager-row">
                  <span className="account-manager-label">Relation Manager</span>
                  <a href={`tel:+91${rmPhone}`} className="account-manager-value">
                    {formatIndianPhoneDisplay(rmPhone)}
                  </a>
                  {rm.name && <span className="account-manager-sub">{rm.name}</span>}
                </div>
              ) : contactsQuery.data?.referralCode ? (
                <div className="account-manager-row">
                  <span className="account-manager-label">Relation Manager</span>
                  <span className="account-manager-value muted">Not assigned — contact support below</span>
                </div>
              ) : null}

              <div className="account-manager-row">
                <span className="account-manager-label">Support</span>
                <a href={`tel:+91${supportPhone}`} className="account-manager-value">
                  {formatIndianPhoneDisplay(supportPhone)}
                </a>
              </div>

              <div className="account-manager-actions">
                <a
                  href={whatsappUrl(whatsappTarget, 'Hi, I need help with my Go-Unlisted account.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline account-manager-btn"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Whatsapp
                </a>
                <a href={`mailto:${emailTarget}`} className="btn btn-outline account-manager-btn">
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email
                </a>
              </div>
            </>
          )}
        </div>

        <div className="account-manager-danger glass-card">
          <h3>Delete my account</h3>
          <p>Permanently remove your profile and login. Completed orders may be retained for compliance records.</p>
          <button type="button" className="btn btn-ghost account-manager-delete" onClick={startDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>

      {showDeleteOtp && (
        <OtpModal
          email={user.email}
          title="Verify to delete account"
          subtitle={`Enter the OTP sent to ${user.email} to confirm account deletion`}
          devOtp={deleteOtp}
          onClose={() => setShowDeleteOtp(false)}
          onVerify={confirmDelete}
          onResend={async () => {
            const res = await sendResetOtp(user.email);
            if (!res.success) throw new Error(res.error || 'Failed to resend OTP');
            if (res.dev_otp) setDeleteOtp(res.dev_otp);
            return res.dev_otp;
          }}
        />
      )}
    </div>
  );
}
