import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import type { ChartPeriod, Share } from '../../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface PriceChartProps {
  share: Share;
  period: ChartPeriod;
}

export default function PriceChart({ share, period }: PriceChartProps) {
  const positive = share.changePositive;
  const lineColor = positive ? '#7ac142' : '#ef4444';
  const fillColor = positive ? 'rgba(122, 193, 66, 0.12)' : 'rgba(239, 68, 68, 0.12)';

  return (
    <div className="chart-wrap">
      <Line
        data={{
          labels: share.chartLabels[period],
          datasets: [{
            data: share.priceHistory[period],
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: lineColor,
            borderWidth: 2.5,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              borderColor: 'rgba(0, 0, 0, 0.08)',
              borderWidth: 1,
              titleColor: '#0f172a',
              bodyColor: lineColor,
              padding: 12,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(0, 0, 0, 0.04)' },
              ticks: { maxTicksLimit: 6, color: '#64748b', font: { size: 11 } },
            },
            y: {
              grid: { color: 'rgba(0, 0, 0, 0.04)' },
              ticks: { color: '#64748b', font: { size: 11 } },
            },
          },
          animation: { duration: 900 },
        }}
      />
    </div>
  );
}
