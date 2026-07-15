import { useMemo, useRef, useState } from 'react';
import CompanyLogo, { initialsFromName } from '../../../components/shares/CompanyLogo';
import { formatCurrency } from '../../../utils/format';
import { trendFromGrowth } from '../../../utils/priceHistory';

const LISTING_TYPES = ['Pre-IPO', 'Unlisted', 'Delisted', 'ESOP'];
const INVENTORY_STATUSES = ['In Stock', 'Limited', 'On Request', 'Out of Stock'];

const GRADIENTS = [
  'linear-gradient(135deg, #003478, #0050a8)',
  'linear-gradient(135deg, #6a0dad, #9c27b0)',
  'linear-gradient(135deg, #c62828, #ef5350)',
  'linear-gradient(135deg, #1565C0, #42a5f5)',
  'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #004d40, #00897b)',
  'linear-gradient(135deg, #e65100, #ff7043)',
  'linear-gradient(135deg, #880e4f, #e91e63)',
  'linear-gradient(135deg, #33691e, #7cb342)',
  'linear-gradient(135deg, #4a148c, #7b1fa2)',
];

type TabId = 'essentials' | 'branding' | 'profile' | 'advanced';

export type StockFormState = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  listingType: string;
  basePrice: string;
  buyPrice: string;
  listingPrice: string;
  minQty: string;
  inventoryStatus: string;
  founded: string;
  revenue: string;
  valuation: string;
  growth: string;
  isin: string;
  week52High: string;
  week52Low: string;
  marketCap: string;
  peRatio: string;
  pbRatio: string;
  debtEquity: string;
  roe: string;
  bookValue: string;
  faceValue: string;
  logoInitials: string;
  logoUrl: string;
  changePositive: boolean;
  isFeatured: boolean;
  logoGradient: string;
  description: string;
  keyHighlights: string;
};

interface Props {
  form: StockFormState;
  set: (patch: Partial<StockFormState>) => void;
  formError: string;
  isPending: boolean;
  logoUploading: boolean;
  sectorOptions: string[];
  onClose: () => void;
  onSave: () => void;
  onLogoUpload: (file: File | undefined) => void;
}

function Field({
  label,
  required,
  hint,
  children,
  span,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  span?: 'full';
}) {
  return (
    <div className={`slm-field${span === 'full' ? ' slm-field--full' : ''}`}>
      <label className="slm-label">
        {label}
        {required && <span className="slm-req">*</span>}
      </label>
      {children}
      {hint && <p className="slm-hint">{hint}</p>}
    </div>
  );
}

function PricePreview({ preIpo, listing }: { preIpo: number; listing: number | null }) {
  const gain =
    listing != null && preIpo > 0 ? ((listing - preIpo) / preIpo) * 100 : null;

  return (
    <div className="slm-preview">
      <div className="slm-preview-label">Homepage preview</div>
      <div className="slm-preview-row">
        <div className="slm-preview-box pre">
          <span>Pre-IPO</span>
          <strong>{preIpo > 0 ? formatCurrency(preIpo) : '—'}</strong>
        </div>
        <span className="slm-preview-arrow" aria-hidden>→</span>
        <div className={`slm-preview-box list${listing == null ? ' empty' : ''}`}>
          <span>Listing</span>
          <strong>{listing != null ? formatCurrency(listing) : '—'}</strong>
        </div>
      </div>
      {gain != null ? (
        <div className={`slm-preview-gain ${gain >= 0 ? 'pos' : 'neg'}`}>
          {gain >= 0 ? '+' : ''}
          {gain.toFixed(0)}% gain · {(listing! / preIpo).toFixed(1)}x
        </div>
      ) : (
        <p className="slm-preview-note">Add Listing Price below to show comparison on homepage</p>
      )}
    </div>
  );
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'essentials', label: 'Prices', icon: '₹' },
  { id: 'branding', label: 'Brand', icon: '◆' },
  { id: 'profile', label: 'Profile', icon: '¶' },
  { id: 'advanced', label: 'More', icon: '⋯' },
];

export default function StockListingModal({
  form,
  set,
  formError,
  isPending,
  logoUploading,
  sectorOptions,
  onClose,
  onSave,
  onLogoUpload,
}: Props) {
  const [tab, setTab] = useState<TabId>('essentials');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const preIpo = parseFloat(form.basePrice) || 0;
  const listingRaw = parseFloat(form.listingPrice);
  const listing = form.listingPrice.trim() !== '' && listingRaw > 0 ? listingRaw : null;

  const profileDone = useMemo(
    () => form.description.trim().length >= 20,
    [form.description],
  );

  return (
    <div className="modal-overlay slm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="stock-modal-v2" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="slm-title">
        <header className="slm-header">
          <div className="slm-header-main">
            <CompanyLogo
              share={{
                name: form.name || 'Stock',
                logoInitials: form.logoInitials || '?',
                logoGradient: form.logoGradient,
                logoUrl: form.logoUrl,
              }}
              size={48}
            />
            <div className="slm-header-text">
              <h3 id="slm-title">{form.id ? 'Edit Listing' : 'Add New Stock'}</h3>
              <p>
                {form.name || 'Untitled'}
                {form.ticker ? ` · ${form.ticker}` : ''}
                {form.sector ? ` · ${form.sector}` : ''}
              </p>
            </div>
          </div>
          <button type="button" className="slm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <nav className="slm-tabs" aria-label="Listing sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`slm-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="slm-tab-icon" aria-hidden>{t.icon}</span>
              {t.label}
              {t.id === 'profile' && !profileDone && form.id && (
                <span className="slm-tab-dot" title="Description needed" />
              )}
            </button>
          ))}
        </nav>

        <div className="slm-body">
          {tab === 'essentials' && (
            <>
              <PricePreview preIpo={preIpo} listing={listing} />

              <div className="slm-card slm-card--highlight">
                <div className="slm-card-title">Pre-IPO vs Listing</div>
                <div className="slm-price-grid">
                  <Field label="Pre-IPO / Sell price (₹)" required>
                    <input
                      className="slm-input slm-input--lg"
                      type="number"
                      min={1}
                      value={form.basePrice}
                      onChange={(e) => set({ basePrice: e.target.value })}
                      placeholder="3200"
                    />
                  </Field>
                  <Field
                    label="Listing price (₹)"
                    hint="IPO / listing price — powers homepage comparison"
                  >
                    <input
                      className="slm-input slm-input--lg slm-input--accent"
                      type="number"
                      min={0}
                      value={form.listingPrice}
                      onChange={(e) => set({ listingPrice: e.target.value })}
                      placeholder="e.g. 4800"
                    />
                  </Field>
                </div>
              </div>

              <div className="slm-card">
                <div className="slm-card-title">Company basics</div>
                <div className="slm-grid">
                  <Field label="Company name" required span="full">
                    <input
                      className="slm-input"
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const prevAuto = initialsFromName(form.name, '');
                        const shouldAuto = !form.logoInitials || form.logoInitials === prevAuto;
                        set({
                          name,
                          ...(shouldAuto ? { logoInitials: initialsFromName(name, '') } : {}),
                        });
                      }}
                      placeholder="PhonePe"
                    />
                  </Field>
                  <Field label="Ticker" required>
                    <input
                      className="slm-input"
                      value={form.ticker}
                      onChange={(e) => set({ ticker: e.target.value.toUpperCase() })}
                      placeholder="PHONEPE"
                    />
                  </Field>
                  <Field label="Sector" required>
                    <input
                      list="sector-options"
                      className="slm-input"
                      value={form.sector}
                      onChange={(e) => set({ sector: e.target.value })}
                      placeholder="Select or type..."
                    />
                    <datalist id="sector-options">
                      {sectorOptions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Listing type">
                    <select
                      className="slm-input"
                      value={form.listingType}
                      onChange={(e) => set({ listingType: e.target.value })}
                    >
                      {LISTING_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Min quantity" required>
                    <input
                      className="slm-input"
                      type="number"
                      min={1}
                      value={form.minQty}
                      onChange={(e) => set({ minQty: e.target.value })}
                    />
                  </Field>
                  <Field label="Availability">
                    <select
                      className="slm-input"
                      value={form.inventoryStatus}
                      onChange={(e) => set({ inventoryStatus: e.target.value })}
                    >
                      {INVENTORY_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <label className="slm-toggle-row">
                <div>
                  <strong>★ Show on homepage</strong>
                  <span>Market Activity carousel</span>
                </div>
                <input
                  type="checkbox"
                  className="slm-toggle"
                  checked={form.isFeatured}
                  onChange={(e) => set({ isFeatured: e.target.checked })}
                />
              </label>
            </>
          )}

          {tab === 'branding' && (
            <div className="slm-card">
              <div className="slm-card-title">Logo &amp; colors</div>
              <div className="slm-logo-block">
                <CompanyLogo
                  share={{
                    name: form.name || 'Stock',
                    logoInitials: form.logoInitials,
                    logoGradient: form.logoGradient,
                    logoUrl: form.logoUrl,
                  }}
                  size={72}
                />
                <div className="slm-logo-actions">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="stock-logo-file-input"
                    disabled={logoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      onLogoUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoUploading ? 'Uploading…' : form.logoUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {form.logoUrl && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ logoUrl: '' })}>
                      Remove
                    </button>
                  )}
                  <p className="slm-hint">JPG, PNG or WEBP · max 2MB</p>
                </div>
              </div>
              <div className="slm-grid">
                <Field label="Logo initials" hint="Shown when no photo (e.g. PhonePe → PP)">
                  <input
                    className="slm-input"
                    maxLength={5}
                    value={form.logoInitials}
                    onChange={(e) =>
                      set({
                        logoInitials: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5),
                      })
                    }
                    placeholder="PP"
                  />
                </Field>
              </div>
              <Field label="Background color (no photo)" span="full">
                <div className="stock-color-picker">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`stock-color-option${form.logoGradient === g ? ' selected' : ''}`}
                      style={{ background: g }}
                      onClick={() => set({ logoGradient: g })}
                      aria-label="Pick logo color"
                    />
                  ))}
                </div>
              </Field>
            </div>
          )}

          {tab === 'profile' && (
            <div className="slm-card">
              <div className="slm-card-title">Public company page</div>
              <Field
                label="Description"
                required
                hint="Min 20 characters — shown on share detail page"
                span="full"
              >
                <textarea
                  className="slm-input slm-textarea"
                  rows={5}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="What does the company do? Why is it attractive pre-IPO?"
                />
              </Field>
              <div className="slm-grid">
                <Field label="Founded">
                  <input
                    className="slm-input"
                    type="number"
                    value={form.founded}
                    onChange={(e) => set({ founded: e.target.value })}
                    placeholder="2015"
                  />
                </Field>
                <Field label="Revenue">
                  <input
                    className="slm-input"
                    value={form.revenue}
                    onChange={(e) => set({ revenue: e.target.value })}
                    placeholder="₹5,000 Cr"
                  />
                </Field>
                <Field label="Valuation">
                  <input
                    className="slm-input"
                    value={form.valuation}
                    onChange={(e) => set({ valuation: e.target.value })}
                    placeholder="₹50,000 Cr"
                  />
                </Field>
                <Field label="Growth (YoY)" hint="Sets chart direction">
                  <input
                    className="slm-input"
                    value={form.growth}
                    onChange={(e) => {
                      const growth = e.target.value;
                      const inferred = trendFromGrowth(growth);
                      set({
                        growth,
                        ...(inferred === null ? {} : { changePositive: inferred }),
                      });
                    }}
                    placeholder="+45%"
                  />
                </Field>
              </div>
              <Field label="Key highlights" hint="One bullet per line" span="full">
                <textarea
                  className="slm-input slm-textarea"
                  rows={4}
                  value={form.keyHighlights}
                  onChange={(e) => set({ keyHighlights: e.target.value })}
                  placeholder={'Market leader in fintech\nBacked by top investors'}
                />
              </Field>
            </div>
          )}

          {tab === 'advanced' && (
            <>
              <div className="slm-card">
                <div className="slm-card-title">Internal &amp; chart</div>
                <div className="slm-grid">
                  <Field label="Cost / buy price (₹)" hint="Internal margin only — not public">
                    <input
                      className="slm-input"
                      type="number"
                      min={0}
                      value={form.buyPrice}
                      onChange={(e) => set({ buyPrice: e.target.value })}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Chart trend">
                    <select
                      className="slm-input"
                      value={form.changePositive ? 'up' : 'down'}
                      onChange={(e) => set({ changePositive: e.target.value === 'up' })}
                    >
                      <option value="up">▲ Rising (green)</option>
                      <option value="down">▼ Falling (red)</option>
                    </select>
                  </Field>
                </div>
              </div>
              <div className="slm-card">
                <div className="slm-card-title">Key data (optional)</div>
                <p className="slm-hint slm-hint--block">Leave blank — public site shows N/A</p>
                <div className="slm-grid slm-grid--dense">
                  {(
                    [
                      ['week52High', '52-wk high', '₹8.25'],
                      ['week52Low', '52-wk low', '₹2.75'],
                      ['marketCap', 'Market cap', '₹6,545 Cr'],
                      ['peRatio', 'P/E', 'N/A'],
                      ['pbRatio', 'P/B', '4.8'],
                      ['debtEquity', 'Debt / Equity', '0'],
                      ['roe', 'ROE', '-1.89%'],
                      ['bookValue', 'Book value', '₹1.24'],
                      ['faceValue', 'Face value', '₹1'],
                      ['isin', 'ISIN', 'INE312K01010'],
                    ] as const
                  ).map(([key, label, ph]) => (
                    <Field key={key} label={label}>
                      <input
                        className="slm-input"
                        value={form[key]}
                        onChange={(e) =>
                          set({
                            [key]: key === 'isin' ? e.target.value.toUpperCase() : e.target.value,
                          } as Partial<StockFormState>)
                        }
                        placeholder={ph}
                        maxLength={key === 'isin' ? 20 : undefined}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="slm-footer">
          {formError && <p className="stock-form-error slm-error">{formError}</p>}
          <div className="slm-footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary slm-save-btn"
              disabled={isPending}
              onClick={onSave}
            >
              {isPending ? 'Saving…' : form.id ? 'Save Listing' : 'Add Stock'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
