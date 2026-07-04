import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/format';
import type { Share } from '../../types';

interface ReturnsCalculatorProps {
  shares: Share[];
}

export default function ReturnsCalculator({ shares }: ReturnsCalculatorProps) {
  const list = useMemo(
    () => [...shares].sort((a, b) => a.name.localeCompare(b.name)),
    [shares],
  );

  const [shareId, setShareId] = useState('');
  const [amount, setAmount] = useState(50000);
  const [gain, setGain] = useState(50);

  // Keep selection valid when stocks are added, updated, or removed
  useEffect(() => {
    if (!list.length) {
      setShareId('');
      return;
    }
    setShareId((current) =>
      list.some((s) => s.id === current) ? current : list[0].id,
    );
  }, [list]);

  const share = list.find((s) => s.id === shareId) ?? list[0] ?? null;

  const calc = useMemo(() => {
    if (!share || !share.price || share.price <= 0) return null;
    const fee = amount * 0.01;
    const investable = amount - fee;
    const qty = Math.floor(investable / share.price);
    const invested = qty * share.price;
    const multiplier = 1 + gain / 100;
    const estValue = invested * multiplier;
    const profit = estValue - invested;
    return { qty, invested, profit, estValue, multiplier };
  }, [share, amount, gain]);

  if (!list.length) {
    return (
      <section className="section" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', paddingTop: '3.5rem', paddingBottom: '3.5rem' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">Returns Simulator</div>
            <h2 className="section-title">Pre-IPO Returns <span>Calculator</span></h2>
            <p className="section-subtitle">Add stocks in admin to simulate returns here.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!share || !calc) return null;

  const dashOffset = 440 - (440 * Math.min(gain, 300)) / 300;
  const unitPrice = share.price;

  return (
    <section className="section" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)', paddingTop: '3.5rem', paddingBottom: '3.5rem' }}>
      <div className="container">
        <div className="section-header">
          <div className="section-tag">Returns Simulator</div>
          <h2 className="section-title">Pre-IPO Returns <span>Calculator</span></h2>
          <p className="section-subtitle">Simulate potential returns based on target price expectations and see your estimated profits.</p>
        </div>

        <div className="calc-grid">
          <div className="calc-inputs">
            <div className="form-group">
              <label className="form-label">Select Pre-IPO Company</label>
              <select
                className="form-input"
                value={share.id}
                onChange={(e) => setShareId(e.target.value)}
              >
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(s.price)}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--muted)' }}>
                Live price {formatCurrency(unitPrice)}
                {share.minQty > 0 ? ` · Min ${share.minQty} shares` : ''}
              </div>
            </div>

            <div className="slider-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Investment Amount (INR)</label>
                <strong style={{ color: 'var(--white)', fontSize: '0.9rem' }}>{formatCurrency(amount)}</strong>
              </div>
              <input type="range" className="price-slider" min={5000} max={500000} step={5000} value={amount} onChange={(e) => setAmount(+e.target.value)} />
              <div className="slider-labels"><span>₹5,000</span><span>₹5,00,000</span></div>
            </div>

            <div className="slider-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Expected Listing Gain</label>
                <strong style={{ color: 'var(--gold)', fontSize: '0.9rem' }}>+{gain}%</strong>
              </div>
              <input type="range" className="price-slider" min={10} max={300} step={10} value={gain} onChange={(e) => setGain(+e.target.value)} />
              <div className="slider-labels"><span>+10% (1.1x)</span><span>+300% (4.0x)</span></div>
            </div>
          </div>

          <div className="calc-outputs">
            <div className="calc-gauge-wrap">
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" stroke="var(--navy-mid)" strokeWidth="10" fill="transparent" />
                <circle cx="80" cy="80" r="70" stroke="var(--gold)" strokeWidth="10" fill="transparent"
                  strokeDasharray="440" strokeDashoffset={dashOffset} strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.4s ease' }} />
              </svg>
              <div className="calc-gauge-text">
                <div className="calc-multiplier">{calc.multiplier.toFixed(1)}x</div>
                <div className="calc-multiplier-label">Multiplier</div>
              </div>
            </div>

            <div className="calc-metrics">
              <div className="calc-metric-row"><span className="lbl">Share Price</span><span className="val">{formatCurrency(unitPrice)}</span></div>
              <div className="calc-metric-row"><span className="lbl">Shares Purchased</span><span className="val">{calc.qty}</span></div>
              <div className="calc-metric-row"><span className="lbl">Total Invested</span><span className="val">{formatCurrency(calc.invested)}</span></div>
              <div className="calc-metric-row"><span className="lbl">Est. Profit</span><span className="val" style={{ color: 'var(--green)' }}>{formatCurrency(calc.profit)}</span></div>
              <div className="calc-metric-row"><span className="lbl">Est. Value at Listing</span><span className="val">{formatCurrency(calc.estValue)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
