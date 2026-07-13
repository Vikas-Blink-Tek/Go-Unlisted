import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function DisclaimerPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="view active" id="view-disclaimer">
      <div className="legal-hero">
        <div className="legal-hero-bg" />
        <div className="section-tag">Legal</div>
        <h1><span>Disclaimer</span></h1>
        <p>Important disclaimers regarding the use of Go-Unlisted platform and services. Please read carefully before making any investment decisions.</p>
        <div className="legal-meta">Last updated: July 2025</div>
      </div>

      <div className="legal-content">
        <nav className="legal-toc">
          <div className="legal-toc-title">Contents</div>
          <a href="#d-general" className="legal-toc-link">General Disclaimer</a>
          <a href="#d-no-offer" className="legal-toc-link">No Offer</a>
          <a href="#d-accuracy" className="legal-toc-link">Accuracy</a>
          <a href="#d-third-party" className="legal-toc-link">Third-Party Content</a>
          <a href="#d-liability" className="legal-toc-link">Liability</a>
          <a href="#d-contact" className="legal-toc-link">Contact</a>
        </nav>

        <div className="legal-body">
          <div className="legal-alert">
            <div className="legal-alert-icon">⚠️</div>
            <div>
              <strong>Important Notice:</strong> Information on this website is provided for informational purposes only. Go-Unlisted is not a SEBI-registered stock broker or investment advisor.
            </div>
          </div>

          <section id="d-general" className="legal-section">
            <h2>General Disclaimer</h2>
            <p>
              Information on this website is provided for informational purposes only.
            </p>
          </section>

          <section id="d-no-offer" className="legal-section">
            <h2>No Offer</h2>
            <p>
              Content does not constitute an offer, solicitation or recommendation to purchase or sell securities.
            </p>
          </section>

          <section id="d-accuracy" className="legal-section">
            <h2>Accuracy</h2>
            <p>
              While reasonable efforts are made to keep information accurate, Go-Unlisted makes no warranties regarding completeness or accuracy.
            </p>
          </section>

          <section id="d-third-party" className="legal-section">
            <h2>Third-Party Content</h2>
            <p>
              References to companies or trademarks do not imply endorsement unless expressly stated.
            </p>
          </section>

          <section id="d-liability" className="legal-section">
            <h2>Liability</h2>
            <p>
              Use of this website is entirely at your own risk.
            </p>
          </section>

          <section id="d-contact" className="legal-section">
            <h2>Contact</h2>
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
