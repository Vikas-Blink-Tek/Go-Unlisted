import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContact } from '../api/contact';
import AutofillBlocker from '../components/forms/AutofillBlocker';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useToast } from '../context/ToastContext';
import { blockAutofillOnFocus, blockEmailInput, blockTextInput } from '../utils/autofill';
import { formatSitePhoneDisplay } from '../constants/siteContact';
import { whatsappUrl } from '../utils/whatsapp';

export default function ContactPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const email = settings.email;
  const phone = formatSitePhoneDisplay(settings.mobile);
  const whatsapp = settings.whatsapp || settings.mobile;
  const address = settings.address;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await submitContact(form);
      showToast('Message sent! We will get back to you within 24 hours.', 'success');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="view active" id="view-contact">
      <div className="contact-wrap">
        <div className="contact-info">
          <div className="section-tag">Get In Touch</div>
          <h2>Have <span>Questions?</span><br />We&apos;re Here to Help</h2>
          <p>Whether you need help with a purchase, want to know more about a listing, or need investor support — our team responds within 24 hours.</p>

          <div className="contact-item">
            <div className="contact-item-label">Email</div>
            <div className="contact-item-value">
              <a href={`mailto:${email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{email}</a>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-item-label">Phone</div>
            <div className="contact-item-value" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <a href={`tel:${phone.replace(/\s/g, '')}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>{phone}</a>
                {' · '}
                <a href={whatsappUrl(whatsapp)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.82rem' }}>WhatsApp</a>
              </div>
            </div>
          </div>

          <div className="contact-item">
            <div className="contact-item-label">Address</div>
            <div className="contact-item-value">{address}</div>
          </div>

          {user && (
            <div className="contact-item contact-logged-in">
              <div className="contact-item-label">Account support</div>
              <div className="contact-item-value" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/dashboard/support" style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'none' }}>
                  Connect Account Manager
                </Link>
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Your referral RM number and support line · delete account
                </span>
              </div>
            </div>
          )}
        </div>

        <form className="contact-form" onSubmit={handleSubmit} autoComplete="off" style={{ position: 'relative' }}>
          <AutofillBlocker />
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" {...blockTextInput({ name: 'contact-name' })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" {...blockEmailInput({ name: 'contact-email' })} />
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea className="form-input" rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Write your message here..." style={{ resize: 'vertical' }} autoComplete="off" {...blockAutofillOnFocus} />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={sending}>
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
