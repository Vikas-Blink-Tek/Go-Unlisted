import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function RiskDisclosurePage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="view active" id="view-risk-disclosure">
      <div className="legal-hero">
        <div className="legal-hero-bg" />
        <div className="section-tag">Legal</div>
        <h1>Risk <span>Disclosure</span></h1>
        <p>This page highlights important risks associated with investments in unlisted and pre-IPO securities.</p>
        <div className="legal-meta">Last updated: July 2025</div>
      </div>

      <div className="legal-content">
        <nav className="legal-toc">
          <div className="legal-toc-title">Contents</div>
          <a href="#rd-purpose" className="legal-toc-link">Purpose</a>
          <a href="#rd-risks" className="legal-toc-link">Key Risks</a>
          <a href="#rd-no-guarantee" className="legal-toc-link">No Guaranteed Returns</a>
          <a href="#rd-advice" className="legal-toc-link">Independent Advice</a>
          <a href="#rd-contact" className="legal-toc-link">Contact</a>
        </nav>

        <div className="legal-body">
          <div className="legal-alert legal-alert-red">
            <div className="legal-alert-icon">🔴</div>
            <div>
              <strong>High Risk Investment:</strong> Investments in unlisted and pre-IPO securities may be illiquid, subject to market volatility, and there is no guarantee an IPO will occur. Capital is at risk and returns are never guaranteed.
            </div>
          </div>

          <section id="rd-purpose" className="legal-section">
            <h2>Purpose</h2>
            <p>
              This page highlights important risks associated with investments in unlisted and pre-IPO securities.
            </p>
          </section>

          <section id="rd-risks" className="legal-section">
            <h2>Key Risks</h2>
            <p>
              Investments may be:
            </p>
            <ul>
              <li>Illiquid</li>
              <li>Subject to market volatility</li>
              <li>Subject to regulatory changes</li>
              <li>There is no guarantee an IPO will occur</li>
            </ul>
          </section>

          <section id="rd-no-guarantee" className="legal-section">
            <h2>No Guaranteed Returns</h2>
            <p>
              Past performance is not indicative of future results. Capital is at risk and returns are never guaranteed.
            </p>
          </section>

          <section id="rd-advice" className="legal-section">
            <h2>Independent Advice</h2>
            <p>
              Investors should perform their own due diligence and consult qualified financial, legal and tax advisers before investing.
            </p>
          </section>

          <section id="rd-contact" className="legal-section">
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
