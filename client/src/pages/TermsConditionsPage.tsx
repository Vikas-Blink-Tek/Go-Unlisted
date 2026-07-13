import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TermsConditionsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="view active" id="view-terms">
      <div className="legal-hero">
        <div className="legal-hero-bg" />
        <div className="section-tag">Legal</div>
        <h1>Terms &amp; <span>Conditions</span></h1>
        <p>By using this website you agree to these Terms &amp; Conditions. Please read them carefully before using the Go-Unlisted platform.</p>
        <div className="legal-meta">Last updated: July 2025</div>
      </div>

      <div className="legal-content">
        <nav className="legal-toc">
          <div className="legal-toc-title">Contents</div>
          <a href="#tc-acceptance" className="legal-toc-link">Acceptance</a>
          <a href="#tc-eligibility" className="legal-toc-link">Eligibility</a>
          <a href="#tc-services" className="legal-toc-link">Services</a>
          <a href="#tc-no-advice" className="legal-toc-link">No Investment Advice</a>
          <a href="#tc-risks" className="legal-toc-link">Investment Risks</a>
          <a href="#tc-user" className="legal-toc-link">User Responsibilities</a>
          <a href="#tc-ip" className="legal-toc-link">Intellectual Property</a>
          <a href="#tc-liability" className="legal-toc-link">Limitation of Liability</a>
          <a href="#tc-indemnity" className="legal-toc-link">Indemnity</a>
          <a href="#tc-governing" className="legal-toc-link">Governing Law</a>
          <a href="#tc-contact" className="legal-toc-link">Contact</a>
        </nav>

        <div className="legal-body">
          <section id="tc-acceptance" className="legal-section">
            <h2>1. Acceptance</h2>
            <p>
              By using this website you agree to these Terms &amp; Conditions.
            </p>
          </section>

          <section id="tc-eligibility" className="legal-section">
            <h2>2. Eligibility</h2>
            <p>
              Users must be at least 18 years old and legally capable of entering into binding agreements.
            </p>
          </section>

          <section id="tc-services" className="legal-section">
            <h2>3. Services</h2>
            <p>
              Go-Unlisted provides information relating to unlisted and pre-IPO securities. Availability of any opportunity is subject to applicable laws and eligibility.
            </p>
          </section>

          <section id="tc-no-advice" className="legal-section">
            <h2>4. No Investment Advice</h2>
            <p>
              Nothing on this website constitutes investment, financial, legal or tax advice or a recommendation to buy or sell securities.
            </p>
          </section>

          <section id="tc-risks" className="legal-section">
            <h2>5. Investment Risks</h2>
            <p>
              Investments in unlisted securities involve significant risks including loss of capital, illiquidity, regulatory changes and uncertainty regarding IPOs. Returns are not guaranteed.
            </p>
          </section>

          <section id="tc-user" className="legal-section">
            <h2>6. User Responsibilities</h2>
            <p>
              Users agree to provide accurate information and not misuse the website.
            </p>
          </section>

          <section id="tc-ip" className="legal-section">
            <h2>7. Intellectual Property</h2>
            <p>
              All content belongs to Go-Unlisted or respective rights holders.
            </p>
          </section>

          <section id="tc-liability" className="legal-section">
            <h2>8. Limitation of Liability</h2>
            <p>
              Go-Unlisted is not responsible for losses arising from reliance on website content or investment decisions.
            </p>
          </section>

          <section id="tc-indemnity" className="legal-section">
            <h2>9. Indemnity</h2>
            <p>
              Users agree to indemnify Go-Unlisted against claims arising from misuse of the platform.
            </p>
          </section>

          <section id="tc-governing" className="legal-section">
            <h2>10. Governing Law</h2>
            <p>
              Governed by the laws of India.
            </p>
          </section>

          <section id="tc-contact" className="legal-section">
            <h2>11. Contact</h2>
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
