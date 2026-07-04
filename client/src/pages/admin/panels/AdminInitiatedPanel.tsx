import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { approveInitiatedCheckout, deleteInitiatedCheckout, getInitiatedCheckouts } from '../../../api/initiated';
import { useToast } from '../../../context/ToastContext';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import { formatCurrency } from '../../../utils/format';
import { abandonedCheckoutMessage, whatsappUrl } from '../../../utils/whatsapp';
import AdminSectionHeader from '../components/AdminSectionHeader';

export default function AdminInitiatedPanel() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['initiated-checkouts'], queryFn: getInitiatedCheckouts });

  const filtered = useMemo(
    () =>
      rows.filter((o) =>
        matchesAdminSearch(
          search,
          o.buyerName,
          o.buyerEmail,
          o.buyerPhone,
          o.shareName,
          o.shareTicker,
          o.sessionId,
          o.paymentMode,
        ),
      ),
    [rows, search],
  );

  const approveMut = useMutation({
    mutationFn: (sessionId: string) => approveInitiatedCheckout(sessionId),
    onSuccess: (res) => {
      showToast(`Order ${res.orderId} created`, 'success');
      queryClient.invalidateQueries({ queryKey: ['initiated-checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteInitiatedCheckout,
    onSuccess: () => {
      showToast('Removed', 'success');
      queryClient.invalidateQueries({ queryKey: ['initiated-checkouts'] });
    },
  });

  return (
    <div>
      <AdminSectionHeader
        compact
        title="Abandoned Checkouts"
        subtitle="Follow up via WhatsApp to recover sales from buyers who didn't complete payment."
        badge={`${filtered.length}${search.trim() ? ` / ${rows.length}` : ''} abandoned`}
      />

      <div className="stock-list-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search mobile, name, email, share..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search abandoned checkouts by mobile, name or email"
        />
        {search.trim() && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}

      {!isLoading && !rows.length && (
        <div className="empty-admin"><p>No abandoned checkouts — great!</p></div>
      )}

      {!isLoading && !!rows.length && !filtered.length && (
        <div className="empty-admin">
          <p>No checkouts match “{search.trim()}”</p>
        </div>
      )}

      {!!filtered.length && (
        <div className="price-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Mobile</th>
                <th>Share</th>
                <th>Qty</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Started</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const msg = abandonedCheckoutMessage(
                  o.buyerName || 'Guest',
                  o.shareName,
                  o.qty,
                  formatCurrency(o.totalAmount),
                );
                return (
                  <tr key={o.sessionId}>
                    <td>
                      <div>{o.buyerName || 'Guest'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.buyerEmail || '—'}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.buyerPhone || '—'}</td>
                    <td>{o.shareName}</td>
                    <td>{o.qty}</td>
                    <td>{formatCurrency(o.totalAmount)}</td>
                    <td>{o.paymentMode || '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{new Date(o.initiatedAt).toLocaleString()}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {o.buyerPhone && (
                        <a
                          href={whatsappUrl(o.buyerPhone, msg)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#25D366', marginRight: 4 }}
                        >
                          WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (confirm('Mark payment received offline and create confirmed order?')) {
                            approveMut.mutate(o.sessionId);
                          }
                        }}
                      >
                        Approve Offline
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          if (confirm('Dismiss this abandoned checkout?')) {
                            deleteMut.mutate(o.sessionId);
                          }
                        }}
                      >
                        Dismiss
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
