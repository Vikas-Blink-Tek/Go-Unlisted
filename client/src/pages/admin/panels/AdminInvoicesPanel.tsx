import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { generateInvoice, getInvoices, deleteInvoice, type Invoice } from '../../../api/invoices';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency, formatDate } from '../../../utils/format';
import AdminSectionHeader from '../components/AdminSectionHeader';
import InvoicePrintView from '../components/InvoicePrintView';

export default function AdminInvoicesPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [includePlatformFee, setIncludePlatformFee] = useState(false);
  const [includeStampDuty, setIncludeStampDuty] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: getInvoices,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoiceId.toLowerCase().includes(q) ||
        inv.orderId.toLowerCase().includes(q) ||
        inv.buyerName.toLowerCase().includes(q) ||
        inv.buyerEmail.toLowerCase().includes(q) ||
        inv.shareName.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  const totalRevenue = useMemo(
    () => invoices.reduce((s, i) => s + (i.totalAmount || 0), 0),
    [invoices],
  );

  const generateMutation = useMutation({
    mutationFn: (orderId: string) =>
      generateInvoice(orderId, { includePlatformFee, includeStampDuty }),
    onSuccess: (res) => {
      showToast('Invoice generated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setShowGenerate(false);
      setOrderIdInput('');
      setIncludePlatformFee(false);
      setIncludeStampDuty(false);
      if (res.invoice) setViewInvoice(res.invoice);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (invoiceId: string) => deleteInvoice(invoiceId),
    onSuccess: () => {
      showToast('Invoice deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  return (
    <div className="inv-panel">
      <AdminSectionHeader
        compact
        title="Invoices"
        subtitle="Tax invoices for confirmed orders — tick platform fee / stamp duty only when needed"
        badge={`${invoices.length} invoices`}
      />

      <div className="inv-stats-grid">
        <div className="stat-card stat-card-highlight">
          <div className="stat-value">{formatCurrency(totalRevenue)}</div>
          <div className="stat-label">Total invoiced</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{invoices.length}</div>
          <div className="stat-label">Invoices issued</div>
        </div>
      </div>

      <div className="inv-toolbar">
        <input
          className="report-filter-input inv-search"
          placeholder="Search invoice, order, buyer, or stock..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}>
          + Generate from order
        </button>
      </div>

      <div className="price-table-wrap">
        {isLoading && <p style={{ padding: '1rem', color: 'var(--muted)' }}>Loading invoices...</p>}
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Buyer</th>
              <th>Stock</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.invoiceId}>
                <td>
                  <strong>{inv.invoiceId}</strong>
                </td>
                <td>{formatDate(inv.invoiceDate)}</td>
                <td>
                  <div>{inv.buyerName}</div>
                  <small style={{ color: 'var(--muted)' }}>{inv.buyerEmail}</small>
                </td>
                <td>
                  <div>{inv.shareName}</div>
                  <small style={{ color: 'var(--muted)' }}>{inv.shareTicker}</small>
                </td>
                <td>{inv.qty}</td>
                <td>
                  <strong>{formatCurrency(inv.totalAmount)}</strong>
                </td>
                <td>
                  <code className="inv-order-code">{inv.orderId}</code>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewInvoice(inv)}>
                    View / Print
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    style={{ color: 'var(--danger)' }}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Delete this invoice?')) {
                        deleteMutation.mutate(inv.invoiceId);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && !isLoading && (
          <div className="admin-table-empty">
            <strong>No invoices yet</strong>
            Invoices are created automatically when you confirm an order, or generate one manually from an
            order ID.
          </div>
        )}
      </div>

      {showGenerate && (
        <div className="modal-overlay" onClick={() => setShowGenerate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Generate Invoice</h3>
            <p className="modal-subtitle">
              Enter order ID. Leave fee boxes unchecked to keep them off the PDF (only subtotal).
            </p>
            <div className="form-group">
              <label className="form-label">Order ID</label>
              <input
                className="form-input"
                placeholder="e.g. GU0001"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
              />
            </div>
            <div className="invoice-charge-toggles" style={{ marginBottom: '1rem', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label className="invoice-charge-check">
                <input
                  type="checkbox"
                  checked={includePlatformFee}
                  onChange={(e) => setIncludePlatformFee(e.target.checked)}
                />
                Include platform fee (1%)
              </label>
              <label className="invoice-charge-check">
                <input
                  type="checkbox"
                  checked={includeStampDuty}
                  onChange={(e) => setIncludeStampDuty(e.target.checked)}
                />
                Include stamp duty (0.015%)
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-full"
              disabled={!orderIdInput.trim() || generateMutation.isPending}
              onClick={() => generateMutation.mutate(orderIdInput.trim())}
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Invoice'}
            </button>
            <button type="button" className="btn btn-ghost btn-full mt-1" onClick={() => setShowGenerate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {viewInvoice && (
        <InvoicePrintView
          key={`${viewInvoice.invoiceId}-${viewInvoice.platformFee}-${viewInvoice.stampDuty}`}
          invoice={viewInvoice}
          onClose={() => setViewInvoice(null)}
          onUpdated={setViewInvoice}
        />
      )}
    </div>
  );
}
