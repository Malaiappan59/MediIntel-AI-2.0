import type { ForecastPoint } from "@/types/medintel";

type ForecastChartProps = {
  points: ForecastPoint[];
};

function buildPolyline(points: ForecastPoint[], width: number, height: number, accessor: (point: ForecastPoint) => number) {
  const values = points.map(accessor);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((accessor(point) - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

export function ForecastChart({ points }: ForecastChartProps) {
  const width = 560;
  const height = 220;
  const consumptionLine = buildPolyline(points, width, height, (point) => point.consumption);
  const forecastLine = buildPolyline(points, width, height, (point) => point.forecast);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
          Medicine Consumption
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
          Forecast
        </div>
      </div>
      <div className="rounded-[1.75rem] border border-sky-100 bg-sky-50/60 p-4">
        <svg viewBox={`0 0 ${width} ${height + 28}`} className="h-[260px] w-full">
          <defs>
            <linearGradient id="forecast-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.22)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0.02)" />
            </linearGradient>
          </defs>
          {Array.from({ length: 5 }).map((_, index) => (
            <line
              key={index}
              x1="0"
              x2={width}
              y1={(height / 4) * index}
              y2={(height / 4) * index}
              stroke="rgba(148, 163, 184, 0.18)"
              strokeDasharray="4 6"
            />
          ))}
          <polyline fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={consumptionLine} />
          <polyline fill="none" stroke="#7dd3fc" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={forecastLine} />
          {points.map((point, index) => (
            <text
              key={point.id}
              x={(index / Math.max(points.length - 1, 1)) * width}
              y={height + 20}
              textAnchor="middle"
              className="fill-slate-500 text-[12px]"
            >
              {point.month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

