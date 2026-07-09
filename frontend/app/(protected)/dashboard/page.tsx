"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, ClipboardCheck, Database, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { ConsumptionBars } from "@/components/dashboard/consumption-bars";
import { WeeklyDemandChart } from "@/components/dashboard/weekly-demand-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { buildOperationsUrl, buildWeeklyDemandForecast, formatCurrency, formatDateLabel, formatRelativeTime, getInventoryHealthSummary } from "@/lib/experience";
import type { ProcurementOrder } from "@/types/medintel";

function getOrderStatusTone(status: ProcurementOrder["status"]) {
  if (status === "approved" || status === "received") {
    return "emerald" as const;
  }

  if (status === "rejected") {
    return "rose" as const;
  }

  if (status === "modified" || status === "escalated") {
    return "amber" as const;
  }

  return "sky" as const;
}

export default function DashboardPage() {
  const router = useRouter();
  const { username } = useAuth();
  const { dataset } = useAppData();

  const displayName = dataset.settings.user.displayName || username || "Operations Lead";
  const forecastPoints = buildWeeklyDemandForecast(dataset);
  const inventoryHealth = getInventoryHealthSummary(dataset);
  const criticalMedicines = dataset.inventory.filter((item) => item.status === "critical");
  const predictedShortages = dataset.inventory.filter((item) => item.shortageRisk >= 78);
  const pendingApprovals = [...dataset.orders]
    .filter((order) => order.status === "pending-approval" || order.status === "modified")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const atRiskMedicines = [...dataset.inventory]
    .sort((left, right) => right.shortageRisk - left.shortageRisk || left.daysRemaining - right.daysRemaining)
    .slice(0, 5);
  const criticalAlerts = dataset.alerts
    .filter((alert) => alert.status === "open" && alert.severity === "critical")
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 4);
  const openCriticalAlertCount = dataset.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const latestOrders = [...dataset.orders]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 5);
  const indexedRepositoryCount = dataset.files.filter((file) => file.status === "indexed").length;
  const repositoryAttentionCount = dataset.files.filter((file) => file.status !== "indexed").length;
  const topRiskMedicine = atRiskMedicines[0] ?? null;
  const latestApprovalOwner = pendingApprovals[0]?.trace?.assignedRole ?? "Procurement leadership";

  return (
    <section className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="workspace-glow overflow-hidden">
          <CardContent className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-sky-100/70 blur-3xl" />
            <div className="relative space-y-5">
              <div className="panel-label">Executive Overview</div>
              <div className="space-y-3">
                <h2 className="section-title text-3xl font-semibold text-slate-950 sm:text-4xl">Hello {displayName}</h2>
                <p className="text-lg font-medium text-sky-700">Current Mission</p>
                <p className="max-w-3xl text-base leading-7 text-slate-600">
                  {dataset.hospital.mission}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Hospital</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{dataset.hospital.name}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Departments</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{dataset.hospital.departments.length} active lanes</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Beds Covered</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{dataset.hospital.beds}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sky-600 text-white shadow-lg shadow-sky-200/90">
          <CardContent className="flex h-full flex-col justify-between gap-6 p-6 sm:p-8">
            <div className="space-y-4">
              <div className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                AI Workspace
              </div>
              <div className="space-y-3">
                <h3 className="section-title text-3xl font-semibold">Ask MediIntel AI</h3>
                <p className="max-w-xl text-sm leading-7 text-sky-50/90">
                  Launch the AI workspace to review live inventory posture, predict shortages, generate procurement, and validate decisions with traceable agent activity.
                </p>
              </div>
            </div>
            <Button className="w-full bg-white text-sky-700 hover:bg-slate-50" size="lg" type="button" onClick={() => router.push("/agents")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Ask AI Agent
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Critical Medicines</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{criticalMedicines.length}</p>
            <p className="mt-3 text-sm text-slate-600">Items already below acceptable continuity buffer.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Predicted Shortages (Next 7 Days)</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{predictedShortages.length}</p>
            <p className="mt-3 text-sm text-slate-600">Forecast-driven risks requiring proactive intervention.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Pending Approvals</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{pendingApprovals.length}</p>
            <p className="mt-3 text-sm text-slate-600">Procurement requests awaiting leadership review.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Inventory Health</p>
                <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{inventoryHealth.score}%</p>
              </div>
              <Badge tone={inventoryHealth.tone}>{inventoryHealth.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">{inventoryHealth.detail}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operational Priorities</CardTitle>
            <CardDescription>Current decision lanes that need review across approvals, alerts, and knowledge readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Top Risk Medicine</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">{topRiskMedicine?.name ?? "No active risk"}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {topRiskMedicine ? `${topRiskMedicine.daysRemaining} days left at ${topRiskMedicine.shortageRisk}% risk.` : "Inventory posture is currently within the safe range."}
                </p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approval Owner</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">{latestApprovalOwner}</p>
                <p className="mt-2 text-sm text-slate-600">{pendingApprovals.length} procurement decisions are still awaiting review.</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Repository Readiness</p>
                <p className="mt-3 text-sm font-semibold text-slate-950">{indexedRepositoryCount} indexed documents</p>
                <p className="mt-2 text-sm text-slate-600">{repositoryAttentionCount} files still need indexing or review.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/tools#approvals")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Review Approvals
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/alerts")}>
                <TriangleAlert className="mr-2 h-4 w-4" />
                View Alerts
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/memory")}>
                <Database className="mr-2 h-4 w-4" />
                Open Repository
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-100 bg-sky-50/70">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <ShieldCheck className="h-4 w-4" />
                Command Brief
              </div>
              <p className="text-2xl font-semibold text-slate-950">{inventoryHealth.score}% hospital inventory health</p>
              <p className="text-sm leading-6 text-slate-600">
                {topRiskMedicine
                  ? `${topRiskMedicine.name} is the most exposed medicine in the current risk window and remains the priority continuity watch item.`
                  : "Hospital inventory is operating inside the current safe continuity threshold."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Critical Alerts</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{openCriticalAlertCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pending Approvals</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{pendingApprovals.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Repository Ready</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{indexedRepositoryCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>7 Day Demand Forecast</CardTitle>
            <CardDescription>Predicted medicine demand across the next seven operating days.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyDemandChart points={forecastPoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medicine Consumption</CardTitle>
            <CardDescription>Highest daily consumption signals across the live inventory profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConsumptionBars items={dataset.inventory} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 At Risk Medicines</CardTitle>
            <CardDescription>Inventory runway, minimum thresholds, and risk concentration ranked for immediate review.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-shell overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Medicine</th>
                    <th className="px-4 py-4 text-right">Current Stock</th>
                    <th className="px-4 py-4 text-right">Minimum Stock</th>
                    <th className="px-4 py-4 text-right">Days Left</th>
                    <th className="px-4 py-4 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {atRiskMedicines.map((medicine) => (
                    <tr key={medicine.id}>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{medicine.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{medicine.category}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-sm text-slate-700">{medicine.stockOnHand}</td>
                      <td className="px-4 py-4 text-right text-sm text-slate-700">{medicine.reorderLevel}</td>
                      <td className="px-4 py-4 text-right text-sm text-slate-700">{medicine.daysRemaining}</td>
                      <td className="px-4 py-4 text-right">
                        <Badge tone={medicine.shortageRisk >= 85 ? "rose" : medicine.shortageRisk >= 70 ? "amber" : "sky"}>
                          {medicine.shortageRisk}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Orders</CardTitle>
            <CardDescription>Most recent procurement requests with supplier timing, cost, and approval posture.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-shell overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Order</th>
                    <th className="px-4 py-4">Supplier</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">ETA</th>
                    <th className="px-4 py-4 text-right">Cost</th>
                    <th className="px-4 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {latestOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-950">{order.id}</p>
                          <p className="mt-1 text-sm text-slate-500">{order.medicineName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{order.supplierName}</td>
                      <td className="px-4 py-4">
                        <Badge tone={getOrderStatusTone(order.status)}>{order.status.replace(/-/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">{formatDateLabel(order.eta)}</td>
                      <td className="px-4 py-4 text-right text-sm font-semibold text-slate-950">{formatCurrency(order.totalCost)}</td>
                      <td className="px-4 py-4">
                        <Button type="button" size="sm" variant="ghost" onClick={() => router.push(buildOperationsUrl("procurement", { kind: "order", id: order.id }))}>
                          Review
                          <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Critical Alerts</CardTitle>
            <CardDescription>Highest-severity signals currently requiring operations attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalAlerts.map((alert) => (
              <div key={alert.id} className="surface-subtle p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                      <TriangleAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">{alert.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{alert.description}</p>
                    </div>
                  </div>
                  <Badge tone={alert.severity === "critical" ? "rose" : alert.severity === "warning" ? "amber" : "sky"}>
                    {alert.severity}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <span>{alert.source}</span>
                  <span>{formatRelativeTime(alert.time)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Procurement Activity</CardTitle>
            <CardDescription>AI-generated procurement activity, supplier handoffs, and approval progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestOrders.map((order) => (
              <div key={order.id} className="surface-subtle flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-700" />
                    <p className="font-semibold text-slate-950">{order.medicineName} with {order.supplierName}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    {order.quantity} units routed by {order.requestedBy} with {order.status.replace(/-/g, " ")} status.
                  </p>
                </div>
                <div className="space-y-2 text-right">
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(order.totalCost)}</p>
                  <p className="text-sm text-slate-500">{formatDateLabel(order.eta)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => router.push(buildOperationsUrl("procurement", { kind: "order", id: order.id }))}
                  >
                    Review
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
