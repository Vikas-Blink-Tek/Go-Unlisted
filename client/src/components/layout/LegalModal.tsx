import { SITE_CONTACT_DEFAULTS, formatSitePhoneDisplay } from '../../constants/siteContact';
import type { SiteSettings } from '../../types';

export type LegalModalType = 'Privacy Policy' | 'Terms of Service' | 'Refund Policy' | 'Grievance';

const BASE_CONTENT: Record<LegalModalType, string> = {
  'Privacy Policy':
    '<p>Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information...</p><p><em>(Placeholder for detailed Privacy Policy)</em></p>',
  'Terms of Service':
    '<p>By using Go-Unlisted, you agree to our Terms of Service. Please read them carefully before using our platform...</p><p><em>(Placeholder for detailed Terms of Service)</em></p>',
  'Refund Policy':
    '<p>Due to the nature of unlisted share transactions, all sales are final. Refunds are only processed if a transaction fails before shares are transferred...</p><p><em>(Placeholder for detailed Refund Policy)</em></p>',
  Grievance:
    '<p>If you have any grievances, please contact our support team. We aim to resolve all issues within 48 hours...</p><p><em>(Placeholder for detailed Grievance Redressal Policy)</em></p>',
};

type Props = {
  type: LegalModalType | null;
  settings?: SiteSettings;
  onClose: () => void;
};

export default function LegalModal({ type, settings, onClose }: Props) {
  if (!type) return null;

  const email = settings?.email || SITE_CONTACT_DEFAULTS.email;
  const phone = formatSitePhoneDisplay(settings?.mobile || SITE_CONTACT_DEFAULTS.mobile);
  const address = settings?.address || SITE_CONTACT_DEFAULTS.address;

  let html = BASE_CONTENT[type];
  if (type === 'Grievance') {
    html += `<p><strong>Contact:</strong> <a href="mailto:${email}">${email}</a> · ${phone}<br/><strong>Address:</strong> ${address}</p>`;
  }
  if (settings?.legal) {
    const escaped = settings.legal
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
    html += `<br><br><hr style="border-color:rgba(0,0,0,0.08);margin:15px 0;" /><p><strong>Additional Terms:</strong><br>${escaped}</p>`;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        style={{ maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="legal-modal-title"
      >
        <h3 className="modal-title" id="legal-modal-title" style={{ marginBottom: '1rem' }}>
          {type}
        </h3>
        <div
          id="legal-modal-content"
          style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <button type="button" className="btn btn-primary btn-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
