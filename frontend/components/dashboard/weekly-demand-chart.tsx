type ForecastDay = {
  id: string;
  label: string;
  demand: number;
  safeLevel: number;
};

type WeeklyDemandChartProps = {
  points: ForecastDay[];
};

function buildLine(points: ForecastDay[], width: number, height: number, accessor: (point: ForecastDay) => number) {
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

function buildArea(points: ForecastDay[], width: number, height: number) {
  const line = buildLine(points, width, height, (point) => point.demand);
  return `0,${height} ${line} ${width},${height}`;
}

export function WeeklyDemandChart({ points }: WeeklyDemandChartProps) {
  const width = 620;
  const height = 250;
  const demandLine = buildLine(points, width, height, (point) => point.demand);
  const safeLine = buildLine(points, width, height, (point) => point.safeLevel);
  const area = buildArea(points, width, height);
  const max = Math.max(...points.map((point) => point.demand));
  const min = Math.min(...points.map((point) => point.safeLevel));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
          Predicted demand
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          Safe operating level
        </div>
      </div>

      <div className="surface-subtle px-4 py-5 sm:px-5">
        <svg viewBox={`0 0 ${width} ${height + 44}`} className="h-[320px] w-full">
          <defs>
            <linearGradient id="demand-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(14, 116, 232, 0.18)" />
              <stop offset="100%" stopColor="rgba(14, 116, 232, 0.02)" />
            </linearGradient>
          </defs>

          {Array.from({ length: 5 }).map((_, index) => {
            const y = (height / 4) * index;
            const value = Math.round(max - ((max - min) / 4) * index);

            return (
              <g key={index}>
                <line x1="0" x2={width} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="6 8" />
                <text x="0" y={y - 8} className="fill-slate-400 text-[11px]">
                  {value}
                </text>
              </g>
            );
          })}

          <polygon points={area} fill="url(#demand-fill)" />
          <polyline fill="none" stroke="#0f172a" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={safeLine} />
          <polyline fill="none" stroke="#0e74e8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={demandLine} />

          {points.map((point, index) => {
            const x = (index / Math.max(points.length - 1, 1)) * width;
            const y = height - ((point.demand - min) / (max - min || 1)) * height;

            return (
              <g key={point.id}>
                <circle cx={x} cy={y} r="4" fill="#0e74e8" />
                <circle cx={x} cy={y} r="9" fill="rgba(14, 116, 232, 0.08)" />
                <text x={x} y={height + 26} textAnchor="middle" className="fill-slate-500 text-[12px] font-medium">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
