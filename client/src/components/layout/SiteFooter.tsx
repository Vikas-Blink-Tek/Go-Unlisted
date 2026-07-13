import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../hooks/useSiteSettings';

import { formatSitePhoneDisplay } from '../../constants/siteContact';
import { whatsappUrl } from '../../utils/whatsapp';

const WarnIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4, color: '#ffc107' }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const PinIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const MailIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default function SiteFooter() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();

  const email = settings.email;
  const phone = formatSitePhoneDisplay(settings.mobile);
  const whatsapp = settings.whatsapp || settings.mobile;
  const address = settings.address;
  const disclaimer = settings.disclaimer;

  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-top">
          <div>
            <div className="nav-logo" style={{ marginBottom: '0.75rem' }}>
              <img src="/logo.png" alt="Go-Unlisted Logo" className="nav-logo-img" />
              <span className="nav-logo-text">
                <span className="logo-go">GO</span>{' '}
                <span className="logo-unlisted">UNLISTED</span>
              </span>
            </div>
            <p className="footer-brand-text">
              Investment and Stock Market Solutions. Access exclusive Pre-IPO shares of India&apos;s most promising companies before they go public.
            </p>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <div className="footer-links">
              <Link to="/shares" className="footer-link">Browse Shares</Link>
              <Link to="/about" className="footer-link">How It Works</Link>
              <Link
                to={user ? '/dashboard' : '/login'}
                state={user ? undefined : { from: '/dashboard', reason: 'portfolio' }}
                className="footer-link"
              >
                Portfolio
              </Link>
              <Link to="/login" className="footer-link">Login / Register</Link>
            </div>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <div className="footer-links">
              <Link to="/about" className="footer-link">About Us</Link>
              <a href={`mailto:${email}`} className="footer-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                {email}
              </a>
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="footer-link" style={{ color: 'inherit', textDecoration: 'none' }}>
                {phone}
              </a>
              <span className="footer-link">{address}</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <div className="footer-links">
              <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
              <Link to="/terms-and-conditions" className="footer-link">Terms &amp; Conditions</Link>
              <Link to="/disclaimer" className="footer-link">Disclaimer</Link>
              <Link to="/risk-disclosure" className="footer-link">Risk Disclosure</Link>
            </div>
          </div>
        </div>

        <hr className="footer-divider" />

        <div className="site-disclaimer-block">
          <strong>Disclaimer:</strong>
          <p id="site-disclaimer">{disclaimer}</p>
        </div>

        <div className="footer-bottom">
          <div className="footer-disclaimer">
            <strong><WarnIcon /> Disclaimer:</strong> GO UNLISTED is not a SEBI-registered broker.
            This platform is for informational and transactional facilitation only.
            Invest at your own risk. Unlisted shares are subject to market risks.
            Please read all related documents carefully before investing.
            <br />
            <strong><PinIcon /> Address:</strong> {address} {' | '}
            <strong><MailIcon /></strong>{' '}
            <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a>
            {' | '}
            <strong><PhoneIcon /></strong>{' '}
            <a href={`tel:${phone.replace(/\s/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>{phone}</a>
            {' · '}
            <a href={whatsappUrl(whatsapp)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>WhatsApp</a>
          </div>
          <div className="footer-copyright">© {new Date().getFullYear()} GO UNLISTED. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
