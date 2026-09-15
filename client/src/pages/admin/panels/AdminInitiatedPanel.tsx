import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { approveInitiatedCheckout, deleteInitiatedCheckout, getInitiatedCheckouts } from '../../../api/initiated';
import { useToast } from '../../../context/ToastContext';
import { matchesAdminSearch } from '../../../utils/adminSearch';
import {
  formatCurrency,
  formatDateTime,
  formatIndianPhoneDisplay,
  formatPersonName,
} from '../../../utils/format';
import { displayUserCode } from '../../../utils/userCode';
import { initiateCheckoutMessage, whatsappUrl } from '../../../utils/whatsapp';
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
          o.employeeCode,
          displayUserCode(o.employeeCode),
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
        title="Initiate"
        subtitle="Follow up via WhatsApp with buyers who started checkout but did not complete payment."
        badge={`${filtered.length}${search.trim() ? ` / ${rows.length}` : ''} initiate`}
      />

      <div className="stock-list-toolbar admin-orders-toolbar">
        <input
          type="search"
          inputMode="search"
          className="report-filter-input stock-list-search"
          placeholder="Search mobile, name, email, share, user code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search initiate checkouts by mobile, name, email or user code"
        />
        {search.trim() && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Loading...</p>}

      {!isLoading && !rows.length && (
        <div className="price-table-wrap">
          <div className="admin-table-empty">
            <strong>No initiate checkouts yet</strong>
            Buyers who start checkout but do not pay will show up here for follow-up.
          </div>
        </div>
      )}

      {!isLoading && !!rows.length && !filtered.length && (
        <div className="price-table-wrap">
          <div className="admin-table-empty">
            <strong>No checkouts match “{search.trim()}”</strong>
            Try another mobile, name, share, or user code.
          </div>
        </div>
      )}

      {!!filtered.length && (
        <div className="price-table-wrap admin-orders-table-wrap">
          <table className="data-table admin-orders-table">
            <thead>
              <tr>
                <th className="admin-orders-col-id">Started</th>
                <th className="admin-orders-col-buyer">Buyer</th>
                <th className="admin-orders-col-share">Share</th>
                <th className="admin-orders-col-amount">Amount</th>
                <th className="admin-orders-col-utr">Payment</th>
                <th className="admin-orders-col-status">Status</th>
                <th className="admin-orders-col-actions admin-initiated-col-actions"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const shareLabel = o.shareName || o.shareTicker || '—';
                const paymentMode = (o.paymentMode || '').trim();
                const msg = initiateCheckoutMessage(
                  o.buyerName || 'Guest',
                  o.shareName,
                  o.qty,
                  formatCurrency(o.totalAmount),
                );

                return (
                  <tr key={o.sessionId} className="admin-order-row">
                    <td className="admin-orders-col-id">
                      <div className="admin-orders-col-date" style={{ marginTop: 0 }}>
                        {formatDateTime(o.initiatedAt)}
                      </div>
                      <div className="admin-orders-id-meta" title={displayUserCode(o.employeeCode)}>
                        {displayUserCode(o.employeeCode)}
                      </div>
                    </td>
                    <td className="admin-orders-col-buyer">
                      <div className="admin-orders-buyer-name">{formatPersonName(o.buyerName)}</div>
                      <div className="admin-orders-buyer-meta">
                        {o.buyerPhone
                          ? formatIndianPhoneDisplay(o.buyerPhone)
                          : o.buyerEmail || '—'}
                      </div>
                    </td>
                    <td className="admin-orders-col-share">
                      <div className="admin-orders-share-name" title={shareLabel}>{shareLabel}</div>
                      <div className="admin-orders-col-deal">
                        <span className="admin-orders-deal-qty">{o.qty}</span>
                        <span className="admin-orders-deal-sep">×</span>
                        <span className="admin-orders-deal-price">{formatCurrency(o.pricePerShare || 0)}</span>
                      </div>
                    </td>
                    <td className="admin-orders-col-amount">{formatCurrency(o.totalAmount || 0)}</td>
                    <td className="admin-orders-col-utr">
                      {paymentMode ? (
                        <code className="admin-utr-code" title={paymentMode}>{paymentMode}</code>
                      ) : (
                        <span className="admin-orders-empty-ref">—</span>
                      )}
                    </td>
                    <td className="admin-orders-col-status">
                      <span className="status-badge status-badge--admin status-pending">
                        Checkout started
                      </span>
                    </td>
                    <td className="admin-orders-col-actions admin-initiated-col-actions">
                      <div className="admin-orders-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={approveMut.isPending}
                          onClick={() => {
                            if (confirm('Mark payment received offline and create confirmed order?')) {
                              approveMut.mutate(o.sessionId);
                            }
                          }}
                        >
                          Approve
                        </button>
                        {o.buyerPhone && (
                          <a
                            href={whatsappUrl(o.buyerPhone, msg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm admin-orders-open-btn"
                            style={{ color: '#16a34a' }}
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm admin-orders-danger-btn"
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (confirm('Dismiss this initiate checkout?')) {
                              deleteMut.mutate(o.sessionId);
                            }
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
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
