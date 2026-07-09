import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "@/types/medintel";

const toneMap = {
  sky: "sky" as const,
  amber: "amber" as const,
  emerald: "emerald" as const,
  rose: "rose" as const,
};

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Card className="glass-card border-white/80">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-900">{metric.value}</p>
          </div>
          <Badge tone={toneMap[metric.tone]}>{metric.delta}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

