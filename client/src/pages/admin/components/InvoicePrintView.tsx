import { formatCurrency, formatDate } from '../../../utils/format';
import { type Invoice } from '../../../api/invoices';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { formatSitePhoneDisplay } from '../../../constants/siteContact';

interface Props {
  invoice: Invoice;
  onClose?: () => void;
  onUpdated?: (invoice: Invoice) => void;
  readOnly?: boolean;
}

export default function InvoicePrintView({ invoice, onClose }: Props) {
  const { settings } = useSiteSettings();
  const companyPhone = formatSitePhoneDisplay(settings.mobile);
  const companyAddress = settings.address;
  const companyEmail = settings.email;
  
  let charges: { name: string; amount: number }[] = [];
  
  if (invoice.customChargesJson) {
    try {
      const parsed = JSON.parse(invoice.customChargesJson);
      if (Array.isArray(parsed)) {
        charges = parsed.map((c: any) => ({
          name: c.name,
          amount: Number(c.amount) || 0
        }));
      }
    } catch (e) {
      // Ignored
    }
  } else {
    // Legacy fallback for older invoices
    if (invoice.platformFee > 0) charges.push({ name: 'Platform Fee', amount: invoice.platformFee });
    if (invoice.stampDuty > 0) charges.push({ name: 'Stamp Duty', amount: invoice.stampDuty });
  }

  const invoiceChargesEnabled = settings.enable_invoice_charges !== '0';
  if (!invoiceChargesEnabled) {
    charges = [];
  }

  const chargesTotal = charges.reduce((acc, c) => acc + c.amount, 0);
  const totalAmount = Math.round((invoice.subtotal + chargesTotal) * 100) / 100;

  const handlePrint = () => {
    // Let React paint updated totals before print dialog
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="invoice-modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-modal-actions no-print">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void handlePrint()}>
            Print / PDF
          </button>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        <article className="invoice-doc" id="invoice-print-area">
          <header className="invoice-doc-header">
            <div>
              <img src="/logo.png" alt="Go-Unlisted" className="invoice-logo" />
              <p className="invoice-company">Go-Unlisted</p>
              <p className="invoice-tagline">Pre-IPO &amp; Unlisted Shares Marketplace</p>
              <p className="invoice-company-contact" style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.45 }}>
                {companyAddress}
                <br />
                {companyPhone} · {companyEmail}
              </p>
            </div>
            <div className="invoice-doc-meta">
              <h1>Tax Invoice</h1>
              <p>
                <strong>{invoice.invoiceId}</strong>
              </p>
              <p>Date: {formatDate(invoice.invoiceDate)}</p>
              <p>Order: {invoice.orderId}</p>
            </div>
          </header>

          <div className="invoice-parties">
            <div>
              <h3>Bill To</h3>
              <p>
                <strong>{invoice.buyerName}</strong>
              </p>
              <p>{invoice.buyerEmail}</p>
              {invoice.buyerPhone && <p>{invoice.buyerPhone}</p>}
            </div>
            <div>
              <h3>Payment</h3>
              <p>Method: {invoice.paymentMethod || '—'}</p>
              <p>UTR / Ref: {invoice.transactionId || '—'}</p>
              <p>Status: {invoice.status}</p>
            </div>
          </div>

          <table className="invoice-lines">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Rate (₹)</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{invoice.shareName}</strong>
                  <br />
                  <small>
                    {invoice.shareTicker} · Unlisted equity
                  </small>
                </td>
                <td>{invoice.qty}</td>
                <td>{invoice.pricePerShare.toLocaleString('en-IN')}</td>
                <td>{invoice.subtotal.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div className="invoice-totals">
            <div className="invoice-totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoiceChargesEnabled && charges.map((c: any, i: number) => (
              <div className="invoice-totals-row" key={i}>
                <span>{c.name}</span>
                <span>{formatCurrency(c.amount)}</span>
              </div>
            ))}
            <div className="invoice-totals-row invoice-totals-grand">
              <span>Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <footer className="invoice-footer">
            <p>
              This is a computer-generated invoice for unlisted share transactions facilitated through
              Go-Unlisted.
            </p>
            <p>
              For queries: {companyPhone} · {companyEmail} · {companyAddress}
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
