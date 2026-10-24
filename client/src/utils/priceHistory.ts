import type { ChartPeriod } from '../types';

const LABELS: Record<ChartPeriod, string[]> = {
  '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
  '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
  '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
};

/** Parse growth text like "+45%", "-12%", "45" into a fraction (0.45). */
export function parseGrowthPercent(growth: string): number {
  const m = growth.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return 0.15;
  return Math.min(2, Math.max(0.02, Math.abs(parseFloat(m[0])) / 100));
}

/**
 * Build indicative price history ending at `currentPrice`.
 * Rising: starts lower, ends at current (green chart).
 * Falling: starts higher, ends at current (red chart).
 */
export function buildPriceHistory(
  currentPrice: number,
  rising: boolean,
  growthText = '',
): Record<ChartPeriod, number[]> {
  const points = 13;
  const move = parseGrowthPercent(growthText || (rising ? '+15%' : '-10%'));
  const start = rising
    ? currentPrice / (1 + move)
    : currentPrice * (1 + move);

  const series: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Slight curve + tiny noise so the line isn't perfectly straight
    const ease = t * t * (3 - 2 * t);
    const wobble = Math.sin(i * 1.7) * currentPrice * 0.008;
    const value = start + (currentPrice - start) * ease + wobble;
    series.push(Math.max(1, Math.round(value * 100) / 100));
  }
  // Force last point to exact sell price
  series[points - 1] = currentPrice;

  return {
    '3M': [...series],
    '6M': [...series],
    '1Y': [...series],
  };
}

export function defaultChartLabels(): Record<ChartPeriod, string[]> {
  return {
    '3M': [...LABELS['3M']],
    '6M': [...LABELS['6M']],
    '1Y': [...LABELS['1Y']],
  };
}

/** Infer rising/falling from growth text if admin typed + or -. */
export function trendFromGrowth(growth: string): boolean | null {
  const t = growth.trim();
  if (!t) return null;
  if (t.startsWith('-') || t.toLowerCase().includes('down') || t.toLowerCase().includes('fall')) {
    return false;
  }
  if (t.startsWith('+') || t.toLowerCase().includes('up') || t.toLowerCase().includes('rise')) {
    return true;
  }
  return null;
}

export const PERIOD_DAYS: Record<ChartPeriod, number> = { '3M': 91, '6M': 182, '1Y': 365 };

/** Change across a real price series (first → last point); null when there is nothing to compare. */
export function priceSeriesChange(data: number[]): { abs: number; pct: number } | null {
  if (data.length < 2 || !data[0]) return null;
  const abs = data[data.length - 1] - data[0];
  return { abs, pct: (abs / data[0]) * 100 };
}

/** True when recorded history is shorter than the selected period. */
export function historyShorterThan(since: string | null | undefined, period: ChartPeriod): boolean {
  if (!since) return false;
  const start = new Date(`${since}T00:00:00`).getTime();
  return Number.isFinite(start) && Date.now() - start < PERIOD_DAYS[period] * 86400000;
}
