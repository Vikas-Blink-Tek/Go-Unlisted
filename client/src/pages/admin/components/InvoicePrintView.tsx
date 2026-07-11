import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../../utils/format';
import { updateInvoiceCharges, type Invoice } from '../../../api/invoices';
import { useToast } from '../../../context/ToastContext';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { formatSitePhoneDisplay } from '../../../constants/siteContact';

interface Props {
  invoice: Invoice;
  onClose?: () => void;
  onUpdated?: (invoice: Invoice) => void;
}

function calcPreview(subtotal: number, includeFee: boolean, includeStamp: boolean) {
  const platformFee = includeFee ? Math.round(subtotal * 0.01 * 100) / 100 : 0;
  const stampDuty = includeStamp ? Math.round(subtotal * 0.00015 * 100) / 100 : 0;
  const totalAmount = Math.round((subtotal + platformFee + stampDuty) * 100) / 100;
  return { platformFee, stampDuty, totalAmount };
}

export default function InvoicePrintView({ invoice, onClose, onUpdated }: Props) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { settings } = useSiteSettings();
  const companyPhone = formatSitePhoneDisplay(settings.mobile);
  const companyAddress = settings.address;
  const companyEmail = settings.email;
  const [includePlatformFee, setIncludePlatformFee] = useState(
    invoice.includePlatformFee ?? invoice.platformFee > 0,
  );
  const [includeStampDuty, setIncludeStampDuty] = useState(
    invoice.includeStampDuty ?? invoice.stampDuty > 0,
  );

  useEffect(() => {
    setIncludePlatformFee(invoice.includePlatformFee ?? invoice.platformFee > 0);
    setIncludeStampDuty(invoice.includeStampDuty ?? invoice.stampDuty > 0);
  }, [invoice.invoiceId, invoice.platformFee, invoice.stampDuty, invoice.includePlatformFee, invoice.includeStampDuty]);

  const chargesMut = useMutation({
    mutationFn: (opts: { includePlatformFee: boolean; includeStampDuty: boolean }) =>
      updateInvoiceCharges(invoice.invoiceId, opts),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      if (res.invoice) onUpdated?.(res.invoice);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const applyCharges = (fee: boolean, stamp: boolean) => {
    setIncludePlatformFee(fee);
    setIncludeStampDuty(stamp);
    chargesMut.mutate({ includePlatformFee: fee, includeStampDuty: stamp });
  };

  const preview = calcPreview(invoice.subtotal, includePlatformFee, includeStampDuty);
  const savedMismatch =
    includePlatformFee !== (invoice.platformFee > 0) ||
    includeStampDuty !== (invoice.stampDuty > 0);

  const handlePrint = async () => {
    if (savedMismatch) {
      try {
        const res = await updateInvoiceCharges(invoice.invoiceId, {
          includePlatformFee,
          includeStampDuty,
        });
        if (res.invoice) onUpdated?.(res.invoice);
        queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not save charges', 'error');
        return;
      }
    }
    // Let React paint updated totals before print dialog
    requestAnimationFrame(() => window.print());
  };

  return (
    <div className="invoice-modal-overlay" onClick={onClose}>
      <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="invoice-modal-actions no-print">
          <div className="invoice-charge-toggles">
            <span className="invoice-charge-hint">Include on invoice:</span>
            <label className="invoice-charge-check">
              <input
                type="checkbox"
                checked={includePlatformFee}
                disabled={chargesMut.isPending}
                onChange={(e) => applyCharges(e.target.checked, includeStampDuty)}
              />
              Platform fee (1%)
            </label>
            <label className="invoice-charge-check">
              <input
                type="checkbox"
                checked={includeStampDuty}
                disabled={chargesMut.isPending}
                onChange={(e) => applyCharges(includePlatformFee, e.target.checked)}
              />
              Stamp duty
            </label>
            {chargesMut.isPending && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Saving…</span>
            )}
          </div>
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
            {includePlatformFee && (
              <div className="invoice-totals-row">
                <span>Platform fee (1%)</span>
                <span>{formatCurrency(preview.platformFee)}</span>
              </div>
            )}
            {includeStampDuty && (
              <div className="invoice-totals-row">
                <span>Stamp duty</span>
                <span>{formatCurrency(preview.stampDuty)}</span>
              </div>
            )}
            <div className="invoice-totals-row invoice-totals-grand">
              <span>Total</span>
              <span>{formatCurrency(preview.totalAmount)}</span>
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
