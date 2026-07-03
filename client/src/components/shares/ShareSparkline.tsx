import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

interface ShareSparklineProps {
  data: number[];
  positive?: boolean;
  height?: number;
}

export default function ShareSparkline({ data, positive = true, height }: ShareSparklineProps) {
  const color = positive ? '#39b54a' : '#ef4444';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const padding = Math.max((max - min) * 0.15, 1);

  return (
    <div className="sparkline-wrap" style={height ? { height } : undefined}>
      <Line
        data={{
          labels: data.map((_, i) => i),
          datasets: [{
            data,
            borderColor: color,
            backgroundColor: positive ? 'rgba(57, 181, 74, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 4, bottom: 4 } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: {
              display: false,
              min: min - padding,
              max: max + padding,
            },
          },
          animation: { duration: 800 },
        }}
      />
    </div>
  );
}
