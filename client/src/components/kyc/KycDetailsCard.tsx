import type { User } from '../../types';
import { formatIndianPhoneDisplay } from '../../utils/format';

type Props = {
  user: User;
  /** Verified users see full submitted values; under-review uses light masking on bank/demat */
  mode: 'verified' | 'review';
};

function formatDemat(demat?: string): string {
  const d = (demat || '').replace(/\D/g, '');
  if (d.length !== 16) return demat?.trim() || '—';
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)} ${d.slice(12, 16)}`;
}

function maskBank(account?: string): string {
  const a = (account || '').replace(/\s/g, '');
  if (!a) return '—';
  if (a.length <= 4) return a;
  return `•••• ${a.slice(-4)}`;
}

function isPdfProof(path?: string): boolean {
  return /\.pdf$/i.test(path || '');
}

export default function KycDetailsCard({ user, mode }: Props) {
  const verified = mode === 'verified';
  const hasKycData = Boolean(user.kycPan || user.kycDemat || user.bankAccount || user.ifsc || user.bankName);

  return (
    <div className={`kyc-details-card${verified ? ' kyc-details-card--verified' : ''}`}>
      <div className="kyc-details-header">
        <div>
          <h3 className="kyc-details-title">
            {verified ? 'Verified KYC profile' : 'Submitted for verification'}
          </h3>
          <p className="kyc-details-subtitle">
            {verified
              ? 'These are the details you submitted and we approved for demat transfer.'
              : 'Our team is reviewing the details below. You cannot edit until review completes.'}
          </p>
        </div>
        <span className={`kyc-details-status-pill kyc-details-status-pill--${user.kycStatus?.toLowerCase().replace(/\s+/g, '-') || 'pending'}`}>
          {user.kycStatus}
        </span>
      </div>

      {!hasKycData ? (
        <p className="kyc-details-empty">
          No KYC document details are saved on your account yet. If you already submitted KYC, please contact support.
        </p>
      ) : (
        <div className="kyc-details-grid">
          <section className="kyc-details-section">
            <h4>Account</h4>
            <dl>
              <div className="kyc-details-row">
                <dt>Name</dt>
                <dd>{user.name || '—'}</dd>
              </div>
              <div className="kyc-details-row">
                <dt>Email</dt>
                <dd>{user.email || '—'}</dd>
              </div>
              <div className="kyc-details-row">
                <dt>Mobile</dt>
                <dd>{user.phone ? formatIndianPhoneDisplay(user.phone) : '—'}</dd>
              </div>
              {user.referralCode && (
                <div className="kyc-details-row">
                  <dt>User code</dt>
                  <dd style={{ fontFamily: 'monospace' }}>{user.referralCode}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="kyc-details-section">
            <h4>Identity &amp; demat</h4>
            <dl>
              <div className="kyc-details-row">
                <dt>PAN</dt>
                <dd className="kyc-details-mono">{user.kycPan || '—'}</dd>
              </div>
              <div className="kyc-details-row">
                <dt>Demat account</dt>
                <dd className="kyc-details-mono">
                  {verified
                    ? formatDemat(user.kycDemat)
                    : user.kycDemat
                      ? `•••• •••• •••• ${user.kycDemat.replace(/\D/g, '').slice(-4)}`
                      : '—'}
                </dd>
              </div>
              <div className="kyc-details-row">
                <dt>CMR / Demat proof</dt>
                <dd>
                  {user.kycDematProof ? (
                    <a
                      href={`/${user.kycDematProof.replace(/^\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kyc-proof-link"
                    >
                      {isPdfProof(user.kycDematProof) ? 'View PDF proof' : 'View uploaded proof'}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
            {user.kycDematProof && !isPdfProof(user.kycDematProof) && (
              <div className="kyc-proof-preview">
                <img src={`/${user.kycDematProof.replace(/^\//, '')}`} alt="Demat / CMR proof" />
              </div>
            )}
          </section>

          <section className="kyc-details-section">
            <h4>Linked bank</h4>
            <dl>
              <div className="kyc-details-row">
                <dt>Bank name</dt>
                <dd>{user.bankName || '—'}</dd>
              </div>
              <div className="kyc-details-row">
                <dt>Account number</dt>
                <dd className="kyc-details-mono">
                  {verified ? user.bankAccount || '—' : maskBank(user.bankAccount)}
                </dd>
              </div>
              <div className="kyc-details-row">
                <dt>IFSC</dt>
                <dd className="kyc-details-mono">{user.ifsc || '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {verified && (
        <p className="kyc-details-footnote">
          Need to change PAN, demat, or bank details? Contact support — edits after verification are done by our team only.
        </p>
      )}
    </div>
  );
}
