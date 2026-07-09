"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, BellRing, CheckCheck, CheckCircle2, ClipboardCheck, Loader2, Search, TriangleAlert } from "lucide-react";
import { AlertFocusPanel } from "@/components/alerts/alert-focus-panel";
import { PageHeader } from "@/components/shell/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppData } from "@/hooks/use-app-data";
import { buildAlertsUrl, buildOperationsUrl, formatDateTime, formatRelativeTime } from "@/lib/experience";
import { cn } from "@/lib/utils";
import type { AlertItem, AuditLogItem, ProcurementOrder } from "@/types/medintel";

type AlertSortOption = "recent" | "oldest" | "critical" | "source";

const PAGE_SIZE = 8;

function getSeverityRank(severity: AlertItem["severity"]) {
  if (severity === "critical") {
    return 3;
  }

  if (severity === "warning") {
    return 2;
  }

  return 1;
}

function getAlertTone(severity: AlertItem["severity"]) {
  if (severity === "critical") {
    return "rose" as const;
  }

  if (severity === "warning") {
    return "amber" as const;
  }

  return "sky" as const;
}

function getOrderStatusRank(status: ProcurementOrder["status"]) {
  if (status === "pending-approval") {
    return 6;
  }

  if (status === "modified") {
    return 5;
  }

  if (status === "approved" || status === "escalated") {
    return 4;
  }

  if (status === "in-transit") {
    return 3;
  }

  if (status === "received") {
    return 2;
  }

  return 1;
}

function sortAlerts(alerts: AlertItem[], sort: AlertSortOption) {
  const next = [...alerts];

  next.sort((left, right) => {
    if (sort === "oldest") {
      return new Date(left.time).getTime() - new Date(right.time).getTime();
    }

    if (sort === "critical") {
      return getSeverityRank(right.severity) - getSeverityRank(left.severity) || new Date(right.time).getTime() - new Date(left.time).getTime();
    }

    if (sort === "source") {
      return left.source.localeCompare(right.source) || new Date(right.time).getTime() - new Date(left.time).getTime();
    }

    return new Date(right.time).getTime() - new Date(left.time).getTime();
  });

  return next;
}

function findRelatedOrder(orders: ProcurementOrder[], alert: AlertItem) {
  return (
    [...orders]
      .filter((order) => order.medicineName === alert.medicineName && order.status !== "rejected")
      .sort(
        (left, right) =>
          getOrderStatusRank(right.status) - getOrderStatusRank(left.status) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )[0] ?? null
  );
}

function formatSourceLabel(value: string) {
  return value === "all" ? "All sources" : value;
}

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataset, resolveAlert, resolveAlerts } = useAppData();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [severity, setSeverity] = useState(searchParams.get("severity") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [source, setSource] = useState(searchParams.get("source") ?? "all");
  const [sort, setSort] = useState<AlertSortOption>("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [resolvingState, setResolvingState] = useState<{ mode: "single" | "bulk"; alertIds: string[] } | null>(null);
  const focusedAlertId = searchParams.get("alert");

  useEffect(() => {
    const nextSeverity = searchParams.get("severity");
    const nextStatus = searchParams.get("status");
    const nextSource = searchParams.get("source");
    const nextQuery = searchParams.get("q");

    setSeverity(nextSeverity ?? "all");
    setStatus(nextStatus ?? "all");
    setSource(nextSource ?? "all");
    setQuery(nextQuery ?? "");
  }, [searchParams]);

  const sourceOptions = useMemo(() => Array.from(new Set(dataset.alerts.map((alert) => alert.source))).sort(), [dataset.alerts]);

  const filteredAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortAlerts(
      dataset.alerts.filter((alert) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          alert.title.toLowerCase().includes(normalizedQuery) ||
          alert.description.toLowerCase().includes(normalizedQuery) ||
          alert.source.toLowerCase().includes(normalizedQuery) ||
          (alert.medicineName ?? "").toLowerCase().includes(normalizedQuery);

        if (!matchesQuery) {
          return false;
        }
        if (severity !== "all" && alert.severity !== severity) {
          return false;
        }
        if (status !== "all" && alert.status !== status) {
          return false;
        }
        if (source !== "all" && alert.source !== source) {
          return false;
        }
        return true;
      }),
      sort,
    );
  }, [dataset.alerts, query, severity, sort, source, status]);

  const relatedOrderByAlertId = useMemo(
    () => new Map(dataset.alerts.map((alert) => [alert.id, findRelatedOrder(dataset.orders, alert)])),
    [dataset.alerts, dataset.orders],
  );

  const focusedAlert = useMemo(() => dataset.alerts.find((alert) => alert.id === focusedAlertId) ?? null, [dataset.alerts, focusedAlertId]);
  const focusedOrder = focusedAlert ? (relatedOrderByAlertId.get(focusedAlert.id) ?? null) : null;

  const relatedAuditLogs = useMemo(() => {
    if (!focusedAlert) {
      return [];
    }

    const normalizedMedicineName = focusedAlert.medicineName?.toLowerCase() ?? "";
    const seen = new Set<string>();

    return [...dataset.auditLogs]
      .filter((log) => {
        const entityType = log.entityType?.toLowerCase() ?? "";

        return (
          (entityType === "alert" && log.entityId === focusedAlert.id) ||
          (focusedOrder && entityType === "order" && log.entityId === focusedOrder.id) ||
          (focusedOrder?.trace?.approvalId ? log.entityId === focusedOrder.trace.approvalId : false) ||
          (focusedOrder?.trace?.auditId ? log.id === focusedOrder.trace.auditId : false) ||
          (log.agent === "Alert Monitor" &&
            (log.entityId === focusedAlert.id || (normalizedMedicineName.length > 0 && log.detail.toLowerCase().includes(normalizedMedicineName))))
        );
      })
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .filter((log) => {
        if (seen.has(log.id)) {
          return false;
        }

        seen.add(log.id);
        return true;
      });
  }, [dataset.auditLogs, focusedAlert, focusedOrder]);

  const siblingAlerts = useMemo(
    () =>
      focusedAlert
        ? [...dataset.alerts]
            .filter((alert) => alert.medicineName === focusedAlert.medicineName && alert.id !== focusedAlert.id)
            .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
        : [],
    [dataset.alerts, focusedAlert],
  );

  const sourcePressure = useMemo(
    () =>
      sourceOptions
        .map((option) => ({
          source: option,
          openCount: dataset.alerts.filter((alert) => alert.source === option && alert.status === "open").length,
        }))
        .filter((entry) => entry.openCount > 0)
        .sort((left, right) => right.openCount - left.openCount || left.source.localeCompare(right.source)),
    [dataset.alerts, sourceOptions],
  );

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, severity, sort, source, status]);

  useEffect(() => {
    if (!focusedAlertId) {
      return;
    }

    const focusedIndex = filteredAlerts.findIndex((alert) => alert.id === focusedAlertId);
    if (focusedIndex >= 0) {
      setCurrentPage(Math.floor(focusedIndex / PAGE_SIZE) + 1);
    }
  }, [filteredAlerts, focusedAlertId]);

  useEffect(() => {
    const validIds = new Set(dataset.alerts.filter((alert) => alert.status === "open").map((alert) => alert.id));
    setSelectedAlertIds((current) => current.filter((id) => validIds.has(id)));
  }, [dataset.alerts]);

  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleOpenAlertIds = paginatedAlerts.filter((alert) => alert.status === "open").map((alert) => alert.id);
  const allVisibleAlertsSelected = visibleOpenAlertIds.length > 0 && visibleOpenAlertIds.every((id) => selectedAlertIds.includes(id));
  const selectedOpenAlerts = dataset.alerts.filter((alert) => selectedAlertIds.includes(alert.id) && alert.status === "open");
  const selectedCriticalCount = selectedOpenAlerts.filter((alert) => alert.severity === "critical").length;
  const selectedWithOrdersCount = selectedOpenAlerts.filter((alert) => relatedOrderByAlertId.get(alert.id)).length;

  const counts = {
    critical: dataset.alerts.filter((alert) => alert.severity === "critical" && alert.status === "open").length,
    warning: dataset.alerts.filter((alert) => alert.severity === "warning" && alert.status === "open").length,
    open: dataset.alerts.filter((alert) => alert.status === "open").length,
    resolved: dataset.alerts.filter((alert) => alert.status === "resolved").length,
  };
  const sourcePressureLeader = sourcePressure[0] ?? null;
  const linkedWorkflowCount = dataset.alerts.filter((alert) => relatedOrderByAlertId.get(alert.id)).length;
  const oldestOpenAlert =
    [...dataset.alerts]
      .filter((alert) => alert.status === "open")
      .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())[0] ?? null;
  const latestResolvedAlert =
    [...dataset.alerts]
      .filter((alert) => alert.status === "resolved")
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())[0] ?? null;
  const commandAlert = focusedAlert ?? oldestOpenAlert ?? filteredAlerts[0] ?? null;
  const commandOrder = commandAlert ? (relatedOrderByAlertId.get(commandAlert.id) ?? null) : null;

  const buildAlertUrl = ({
    alertId,
    queryValue = query,
    severityValue = severity,
    statusValue = status,
    sourceValue = source,
  }: {
    alertId?: string | null;
    queryValue?: string;
    severityValue?: string;
    statusValue?: string;
    sourceValue?: string;
  } = {}) =>
    buildAlertsUrl({
      alertId: alertId === undefined ? (focusedAlertId ?? undefined) : (alertId ?? undefined),
      severity: severityValue !== "all" ? severityValue : undefined,
      status: statusValue !== "all" ? statusValue : undefined,
      source: sourceValue !== "all" ? sourceValue : undefined,
      query: (queryValue ?? "").trim() || undefined,
    });

  const focusAlert = (alertId: string) => {
    router.replace(buildAlertUrl({ alertId }));
  };

  const clearFocus = () => {
    router.replace(buildAlertUrl({ alertId: null }));
  };

  const clearFilters = () => {
    const nextUrl = buildAlertUrl({
      alertId: null,
      queryValue: "",
      severityValue: "all",
      statusValue: "all",
      sourceValue: "all",
    });

    setQuery("");
    setSeverity("all");
    setStatus("all");
    setSource("all");
    setSort("recent");
    router.replace(nextUrl);
  };

  const applyQuickScope = ({
    severityValue = "all",
    statusValue = "all",
    sourceValue = "all",
    sortValue = "recent",
  }: {
    severityValue?: string;
    statusValue?: string;
    sourceValue?: string;
    sortValue?: AlertSortOption;
  }) => {
    setQuery("");
    setSeverity(severityValue);
    setStatus(statusValue);
    setSource(sourceValue);
    setSort(sortValue);
    setSelectedAlertIds([]);
  };

  const toggleAlertSelection = (alert: AlertItem) => {
    if (alert.status !== "open") {
      return;
    }

    setSelectedAlertIds((current) => (current.includes(alert.id) ? current.filter((id) => id !== alert.id) : [...current, alert.id]));
  };

  const toggleVisibleAlerts = () => {
    setSelectedAlertIds((current) => {
      if (allVisibleAlertsSelected) {
        return current.filter((id) => !visibleOpenAlertIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleOpenAlertIds]));
    });
  };

  const handleResolveOne = async (alertId: string) => {
    setResolvingState({ mode: "single", alertIds: [alertId] });

    try {
      await resolveAlert(alertId);
    } finally {
      setResolvingState(null);
      setSelectedAlertIds((current) => current.filter((id) => id !== alertId));
    }
  };

  const handleResolveSelected = async () => {
    const ids = selectedOpenAlerts.map((alert) => alert.id);
    if (!ids.length) {
      return;
    }

    setResolvingState({ mode: "bulk", alertIds: ids });

    try {
      await resolveAlerts(ids);
      setSelectedAlertIds([]);
    } finally {
      setResolvingState(null);
    }
  };

  useEffect(() => {
    const nextFocusedAlertId = focusedAlertId && filteredAlerts.some((alert) => alert.id === focusedAlertId) ? focusedAlertId : undefined;
    const targetUrl = buildAlertsUrl({
      alertId: nextFocusedAlertId,
      severity: severity !== "all" ? severity : undefined,
      status: status !== "all" ? status : undefined,
      source: source !== "all" ? source : undefined,
      query: query.trim() || undefined,
    });
    const currentUrl = buildAlertsUrl({
      alertId: searchParams.get("alert") ?? undefined,
      severity: searchParams.get("severity") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      query: searchParams.get("q") ?? undefined,
    });

    if (currentUrl !== targetUrl) {
      router.replace(targetUrl);
    }
  }, [filteredAlerts, focusedAlertId, query, router, searchParams, severity, source, status]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Alert Center"
        title="Operational alert timeline"
        description="Track critical, warning, and resolved alerts across inventory, forecasting, procurement, compliance, and AI decision support."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Critical</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{counts.critical}</p>
            <p className="mt-3 text-sm text-slate-600">Immediate continuity risks requiring rapid action.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Warning</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{counts.warning}</p>
            <p className="mt-3 text-sm text-slate-600">Signals that should be triaged before service degradation.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Open Alerts</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{counts.open}</p>
            <p className="mt-3 text-sm text-slate-600">{sourcePressure[0] ? `${sourcePressure[0].source} is the highest-pressure source.` : "No active alert pressure."}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Resolved</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{counts.resolved}</p>
            <p className="mt-3 text-sm text-slate-600">Signals that have already moved through the review queue.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alert Command Brief</CardTitle>
            <CardDescription>Operational summary of the current alert posture, workflow linkage, and active triage pressure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-subtle space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                    <BellRing className="h-4 w-4" />
                    Active Mission
                  </div>
                  <p className="text-lg font-semibold text-slate-950">
                    {commandAlert ? `${commandAlert.title} is the current alert focus.` : "No active alert focus right now."}
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    {oldestOpenAlert
                      ? `The oldest open alert has been active since ${formatRelativeTime(oldestOpenAlert.time)}, and ${sourcePressureLeader ? sourcePressureLeader.source : "the active sources"} is carrying the highest pressure today.`
                      : "No open alerts are currently waiting in the triage queue."}
                  </p>
                </div>
                {commandAlert ? <Badge tone={getAlertTone(commandAlert.severity)}>{commandAlert.severity}</Badge> : <Badge tone="emerald">stable</Badge>}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pressure Source</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{sourcePressureLeader?.source ?? "Balanced queue"}</p>
                  <p className="mt-1 text-sm text-slate-500">{sourcePressureLeader ? `${sourcePressureLeader.openCount} open alerts` : "No open pressure"}</p>
                </div>
                <div className="surface-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Linked Workflows</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{linkedWorkflowCount} alerts</p>
                  <p className="mt-1 text-sm text-slate-500">Currently mapped to procurement or approval workflows.</p>
                </div>
                <div className="surface-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest Resolution</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{latestResolvedAlert ? formatRelativeTime(latestResolvedAlert.time) : "No recent resolution"}</p>
                  <p className="mt-1 text-sm text-slate-500">{latestResolvedAlert?.title ?? "Resolved alerts will appear here."}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {commandAlert ? (
                  <Button type="button" variant="secondary" onClick={() => focusAlert(commandAlert.id)}>
                    <TriangleAlert className="mr-2 h-4 w-4" />
                    Open Current Focus
                  </Button>
                ) : null}
                {commandOrder?.trace?.approvalId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(buildOperationsUrl("approvals", { kind: "approval", id: commandOrder.trace?.approvalId ?? commandOrder.id }))}
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Review Approval
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => router.push("/tools#procurement")}>
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Review Procurement
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-100">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <CheckCheck className="h-4 w-4" />
                Triage Shortcuts
              </div>
              <p className="text-sm leading-6 text-slate-600">
                Move the timeline instantly to the queue you want to review without rebuilding the current alert mechanics.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={status === "resolved" ? "emerald" : "sky"}>{status === "all" ? "All statuses" : status}</Badge>
              <Badge tone={severity === "critical" ? "rose" : severity === "warning" ? "amber" : "slate"}>{severity === "all" ? "All severities" : severity}</Badge>
              <Badge tone={source === "all" ? "slate" : "sky"}>{formatSourceLabel(source)}</Badge>
              <Badge tone="slate">{sort}</Badge>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={() => applyQuickScope({ statusValue: "open", severityValue: "all", sourceValue: "all", sortValue: "recent" })}>
                Open Queue
              </Button>
              <Button type="button" variant="secondary" onClick={() => applyQuickScope({ statusValue: "open", severityValue: "critical", sourceValue: "all", sortValue: "critical" })}>
                Critical First
              </Button>
              <Button type="button" variant="secondary" onClick={() => applyQuickScope({ statusValue: "open", severityValue: "warning", sourceValue: "all", sortValue: "recent" })}>
                Warning Watch
              </Button>
              <Button type="button" variant="secondary" onClick={() => applyQuickScope({ statusValue: "resolved", severityValue: "all", sourceValue: "all", sortValue: "recent" })}>
                Resolved Review
              </Button>
              <Button type="button" variant="outline" onClick={() => applyQuickScope({ statusValue: "open", severityValue: "all", sourceValue: "Procurement", sortValue: "recent" })}>
                Procurement Source
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear Scope
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Triage Filters</CardTitle>
              <CardDescription>Prioritize live issues by severity, status, source, and recency while keeping the timeline deep-linked.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 xl:grid-cols-[1.15fr_repeat(4,minmax(0,0.7fr))_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Search title, source, medicine, or description" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {["all", "critical", "warning", "info"].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {["all", "open", "resolved"].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">all</SelectItem>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as AlertSortOption)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Newest first</SelectItem>
                    <SelectItem value="critical">Highest severity</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="source">By source</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {sourcePressure.length ? (
                  sourcePressure.map((entry) => (
                    <Badge key={entry.source} tone={entry.openCount >= 4 ? "rose" : entry.openCount >= 2 ? "amber" : "sky"}>
                      {entry.source} {entry.openCount}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="emerald">No open alert pressure</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert Timeline</CardTitle>
              <CardDescription>Trace open and resolved alerts in time order, resolve them in batches, and inspect linked workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-subtle flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                    checked={allVisibleAlertsSelected}
                    disabled={!visibleOpenAlertIds.length}
                    onChange={() => toggleVisibleAlerts()}
                  />
                  Select visible open alerts
                </label>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="sky">{filteredAlerts.length} filtered</Badge>
                  <Badge tone={selectedCriticalCount > 0 ? "rose" : "slate"}>{selectedOpenAlerts.length} selected</Badge>
                  <Badge tone={selectedWithOrdersCount > 0 ? "amber" : "slate"}>{selectedWithOrdersCount} linked orders</Badge>
                </div>
              </div>

              {selectedOpenAlerts.length ? (
                <div className="surface-azure flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sky-700 ring-azure">
                      <CheckCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedOpenAlerts.length} open alerts ready for action</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedCriticalCount} critical alerts selected across {formatSourceLabel(source)}.
                      </p>
                    </div>
                  </div>
                  <Button type="button" disabled={!!resolvingState} onClick={() => void handleResolveSelected()}>
                    {resolvingState?.mode === "bulk" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Resolve Selected
                  </Button>
                </div>
              ) : null}

              <div className="space-y-4">
                {paginatedAlerts.length === 0 ? (
                  <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                    No alerts match the current filters. Adjust the triage criteria to inspect the timeline.
                  </div>
                ) : null}

                {paginatedAlerts.map((alert) => {
                  const relatedOrder = relatedOrderByAlertId.get(alert.id) ?? null;
                  const alertAuditLog =
                    dataset.auditLogs.find(
                      (log) => (log.entityType?.toLowerCase() === "alert" && log.entityId === alert.id) || log.id === relatedOrder?.trace?.auditId,
                    ) ?? null;
                  const isFocused = alert.id === focusedAlertId;
                  const isResolving = resolvingState?.alertIds.includes(alert.id) ?? false;

                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        "relative rounded-[1.5rem] border border-slate-200/70 bg-white p-5 transition-colors duration-200 hover:border-sky-200 hover:bg-sky-50/40",
                        isFocused && "border-sky-200 bg-sky-50/60",
                      )}
                      onClick={() => focusAlert(alert.id)}
                    >
                      <div className="absolute bottom-0 left-[47px] top-0 hidden w-px bg-slate-200 lg:block" />
                      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                              checked={selectedAlertIds.includes(alert.id)}
                              disabled={alert.status !== "open"}
                              onChange={() => toggleAlertSelection(alert)}
                            />
                          </div>
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                              alert.status === "resolved"
                                ? "bg-emerald-50 text-emerald-700"
                                : alert.severity === "critical"
                                  ? "bg-rose-50 text-rose-700"
                                  : alert.severity === "warning"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-sky-50 text-sky-700",
                            )}
                          >
                            {alert.status === "resolved" ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full bg-current" />}
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">{alert.title}</p>
                              <Badge tone={getAlertTone(alert.severity)}>{alert.severity}</Badge>
                              <Badge tone={alert.status === "resolved" ? "emerald" : "slate"}>{alert.status}</Badge>
                            </div>
                            <p className="text-sm leading-7 text-slate-600">{alert.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                              <span>{alert.source}</span>
                              <span>{formatDateTime(alert.time)}</span>
                              {alert.medicineName ? <span>{alert.medicineName}</span> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {relatedOrder ? <Badge tone="sky">{relatedOrder.id}</Badge> : null}
                              {relatedOrder?.trace?.approvalId ? <Badge tone="amber">{relatedOrder.trace.approvalId}</Badge> : null}
                              {alertAuditLog ? <Badge tone="slate">{alertAuditLog.id}</Badge> : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                          {relatedOrder?.trace?.approvalId && (relatedOrder.status === "pending-approval" || relatedOrder.status === "modified") ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => router.push(buildOperationsUrl("approvals", { kind: "approval", id: relatedOrder.trace?.approvalId ?? relatedOrder.id }))}
                            >
                              Approval Queue
                            </Button>
                          ) : relatedOrder ? (
                            <Button type="button" variant="outline" onClick={() => router.push(buildOperationsUrl("procurement", { kind: "order", id: relatedOrder.id }))}>
                              Review Procurement
                            </Button>
                          ) : null}
                          {alert.status === "open" ? (
                            <Button type="button" variant="secondary" disabled={isResolving} onClick={() => void handleResolveOne(alert.id)}>
                              {isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Resolve
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredAlerts.length > 0 ? (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredAlerts.length}
                  currentCount={paginatedAlerts.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="alerts"
                  onPageChange={setCurrentPage}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <AlertFocusPanel
          alert={focusedAlert}
          relatedOrder={focusedOrder}
          relatedAuditLogs={relatedAuditLogs}
          siblingAlerts={siblingAlerts}
          isResolving={focusedAlert ? resolvingState?.alertIds.includes(focusedAlert.id) ?? false : false}
          onOpenAlert={focusAlert}
          onClearFocus={clearFocus}
          onOpenOrder={(orderId) => router.push(buildOperationsUrl("procurement", { kind: "order", id: orderId }))}
          onOpenApproval={(approvalId) => router.push(buildOperationsUrl("approvals", { kind: "approval", id: approvalId }))}
          onOpenAudit={(auditId) => router.push(buildOperationsUrl("audit", { kind: "audit", id: auditId }))}
          onResolve={(alertId) => void handleResolveOne(alertId)}
        />
      </div>
    </section>
  );
}
