import { formatCurrency, formatDate } from '../../../utils/format';
import type { Invoice } from '../../../api/invoices';

interface Props {
  invoice: Invoice;
  onClose?: () => void;
}

export default function InvoicePrintView({ invoice, onClose }: Props) {
  const handlePrint = () => window.print();

  return (
    <div className="invoice-modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-modal-actions no-print">
          <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>Print / PDF</button>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          )}
        </div>

        <article className="invoice-doc" id="invoice-print-area">
          <header className="invoice-doc-header">
            <div>
              <img src="/logo.png" alt="Go-Unlisted" className="invoice-logo" />
              <p className="invoice-company">Go-Unlisted</p>
              <p className="invoice-tagline">Pre-IPO &amp; Unlisted Shares Marketplace</p>
            </div>
            <div className="invoice-doc-meta">
              <h1>Tax Invoice</h1>
              <p><strong>{invoice.invoiceId}</strong></p>
              <p>Date: {formatDate(invoice.invoiceDate)}</p>
              <p>Order: {invoice.orderId}</p>
            </div>
          </header>

          <div className="invoice-parties">
            <div>
              <h3>Bill To</h3>
              <p><strong>{invoice.buyerName}</strong></p>
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
                  <small>{invoice.shareTicker} · Unlisted equity</small>
                </td>
                <td>{invoice.qty}</td>
                <td>{invoice.pricePerShare.toLocaleString('en-IN')}</td>
                <td>{invoice.subtotal.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div className="invoice-totals">
            <div className="invoice-totals-row"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
            <div className="invoice-totals-row"><span>Platform fee (1%)</span><span>{formatCurrency(invoice.platformFee)}</span></div>
            <div className="invoice-totals-row"><span>Stamp duty</span><span>{formatCurrency(invoice.stampDuty)}</span></div>
            <div className="invoice-totals-row invoice-totals-grand"><span>Total</span><span>{formatCurrency(invoice.totalAmount)}</span></div>
          </div>

          <footer className="invoice-footer">
            <p>This is a computer-generated invoice for unlisted share transactions facilitated through Go-Unlisted.</p>
            <p>For queries, contact support via the website.</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
