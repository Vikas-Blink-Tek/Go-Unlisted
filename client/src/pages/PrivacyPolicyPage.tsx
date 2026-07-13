import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="view active" id="view-privacy-policy">
      <div className="legal-hero">
        <div className="legal-hero-bg" />
        <div className="section-tag">Legal</div>
        <h1>Privacy <span>Policy</span></h1>
        <p>This Privacy Policy explains how Go-Unlisted collects, uses, stores and protects personal information collected through www.go-unlisted.com and associated services.</p>
        <div className="legal-meta">Last updated: July 2025</div>
      </div>

      <div className="legal-content">
        <nav className="legal-toc">
          <div className="legal-toc-title">Contents</div>
          <a href="#pp-intro" className="legal-toc-link">Introduction</a>
          <a href="#pp-info" className="legal-toc-link">Information Collected</a>
          <a href="#pp-purpose" className="legal-toc-link">Purpose of Collection</a>
          <a href="#pp-marketing" className="legal-toc-link">Marketing Communications</a>
          <a href="#pp-sharing" className="legal-toc-link">Sharing Information</a>
          <a href="#pp-cookies" className="legal-toc-link">Cookies</a>
          <a href="#pp-security" className="legal-toc-link">Data Security</a>
          <a href="#pp-retention" className="legal-toc-link">Data Retention</a>
          <a href="#pp-rights" className="legal-toc-link">Your Rights</a>
          <a href="#pp-third" className="legal-toc-link">Third Party Links</a>
          <a href="#pp-children" className="legal-toc-link">Children&apos;s Privacy</a>
          <a href="#pp-changes" className="legal-toc-link">Changes</a>
          <a href="#pp-contact" className="legal-toc-link">Contact</a>
        </nav>

        <div className="legal-body">
          <section id="pp-intro" className="legal-section">
            <h2>1. Introduction</h2>
            <p>
              This Privacy Policy explains how Go-Unlisted collects, uses, stores and protects personal information collected through <strong>www.go-unlisted.com</strong> and associated services.
            </p>
          </section>

          <section id="pp-info" className="legal-section">
            <h2>2. Information Collected</h2>
            <p>We may collect the following information:</p>
            <ul>
              <li>Your name</li>
              <li>Email address</li>
              <li>Mobile number</li>
              <li>City</li>
              <li>Investment preferences</li>
              <li>Investment budget</li>
              <li>KYC details where required</li>
              <li>IP address</li>
              <li>Browser information</li>
              <li>Cookies and website analytics</li>
            </ul>
          </section>

          <section id="pp-purpose" className="legal-section">
            <h2>3. Purpose of Collection</h2>
            <p>Information is used to:</p>
            <ul>
              <li>Respond to enquiries</li>
              <li>Provide requested services</li>
              <li>Contact you regarding investment opportunities</li>
              <li>Improve our website</li>
              <li>Comply with applicable laws</li>
              <li>Prevent fraud</li>
            </ul>
          </section>

          <section id="pp-marketing" className="legal-section">
            <h2>4. Marketing Communications</h2>
            <p>
              By submitting your details, you consent to receive communication by phone, email, SMS or WhatsApp. You may opt out at any time.
            </p>
          </section>

          <section id="pp-sharing" className="legal-section">
            <h2>5. Sharing Information</h2>
            <p>
              We do <strong>not</strong> sell your personal information. Information may be shared with:
            </p>
            <ul>
              <li>Technology providers</li>
              <li>KYC partners</li>
              <li>Payment providers</li>
              <li>Professional advisers</li>
              <li>Regulators where required by law</li>
            </ul>
          </section>

          <section id="pp-cookies" className="legal-section">
            <h2>6. Cookies</h2>
            <p>Cookies are used for:</p>
            <ul>
              <li>Authentication</li>
              <li>Analytics</li>
              <li>Advertising performance</li>
              <li>User experience</li>
            </ul>
            <p>Browser settings may be used to disable cookies.</p>
          </section>

          <section id="pp-security" className="legal-section">
            <h2>7. Data Security</h2>
            <p>
              Reasonable administrative, technical and organisational safeguards are implemented to protect information.
            </p>
          </section>

          <section id="pp-retention" className="legal-section">
            <h2>8. Data Retention</h2>
            <p>
              Information is retained only for legitimate business, legal or regulatory purposes.
            </p>
          </section>

          <section id="pp-rights" className="legal-section">
            <h2>9. Your Rights</h2>
            <p>
              Subject to applicable law you may request access, correction or deletion of your personal information.
            </p>
          </section>

          <section id="pp-third" className="legal-section">
            <h2>10. Third Party Links</h2>
            <p>
              External websites are governed by their own privacy policies.
            </p>
          </section>

          <section id="pp-children" className="legal-section">
            <h2>11. Children&apos;s Privacy</h2>
            <p>
              Services are intended only for users aged 18 years or above.
            </p>
          </section>

          <section id="pp-changes" className="legal-section">
            <h2>12. Changes</h2>
            <p>
              We may revise this Privacy Policy from time to time.
            </p>
          </section>

          <section id="pp-contact" className="legal-section">
            <h2>13. Contact</h2>
            <div className="legal-contact-card">
              <p><strong>Go-Unlisted</strong></p>
              <p>Email: <a href="mailto:support@go-unlisted.com">support@go-unlisted.com</a></p>
              <p>Website: <a href="https://www.go-unlisted.com" target="_blank" rel="noopener noreferrer">www.go-unlisted.com</a></p>
            </div>
          </section>

          <div className="legal-back-link">
            <Link to="/" className="btn btn-ghost">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
