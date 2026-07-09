"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Bot, ClipboardCheck, Database, Link2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppData } from "@/hooks/use-app-data";
import { buildAlertsUrl, buildMemoryUrl, buildOperationsUrl, formatRelativeTime } from "@/lib/experience";

export function OperationsInbox() {
  const router = useRouter();
  const { dataset, activeExecution } = useAppData();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const criticalAlerts = dataset.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").slice(0, 3);
  const pendingApprovals = dataset.orders.filter((order) => order.status === "pending-approval" || order.status === "modified").slice(0, 3);
  const processingFiles = dataset.files.filter((file) => file.status !== "indexed").slice(0, 3);
  const integrationIssues = dataset.apis.filter((api) => api.status !== "healthy").slice(0, 3);
  const notificationCount = criticalAlerts.length + pendingApprovals.length + processingFiles.length + integrationIssues.length + (activeExecution ? 1 : 0);

  const navigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative"
        aria-expanded={isOpen}
        aria-label="Open operations inbox"
        onClick={() => setIsOpen((current) => !current)}
      >
        <BellRing className="h-4 w-4" />
        {notificationCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        ) : null}
      </Button>

      {isOpen ? (
        <Card className="absolute right-0 top-full z-50 mt-3 w-[420px] max-w-[calc(100vw-2rem)] border-slate-200/80 shadow-2xl shadow-sky-100/80">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <CardTitle>Operations Inbox</CardTitle>
                <CardDescription>Critical signals, approval work, knowledge readiness, and live AI activity.</CardDescription>
              </div>
              <Badge tone={notificationCount > 0 ? "rose" : "emerald"}>{notificationCount} active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeExecution ? (
              <button
                type="button"
                className="surface-azure w-full rounded-[1.5rem] p-4 text-left transition hover:bg-sky-100/80"
                onClick={() => navigate("/agents")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sky-700 ring-azure">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-950">MediIntel AI mission active</p>
                      <p className="text-sm leading-6 text-slate-600">{activeExecution.nextAction}</p>
                    </div>
                  </div>
                  <Badge tone="sky">{activeExecution.confidenceScore}%</Badge>
                </div>
              </button>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Critical Alerts</p>
                <Badge tone={criticalAlerts.length > 0 ? "rose" : "slate"}>{criticalAlerts.length}</Badge>
              </div>
              {criticalAlerts.length ? (
                criticalAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white px-4 py-4 text-left transition hover:border-rose-200 hover:bg-rose-50/40"
                    onClick={() => navigate(buildAlertsUrl({ alertId: alert.id, severity: alert.severity }))}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                      <TriangleAlert className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-950">{alert.title}</p>
                        <Badge tone="rose">{alert.severity}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{alert.source} - {formatRelativeTime(alert.time)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">No unresolved critical alerts right now.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Pending Approvals</p>
                <Badge tone={pendingApprovals.length > 0 ? "amber" : "slate"}>{pendingApprovals.length}</Badge>
              </div>
              {pendingApprovals.length ? (
                pendingApprovals.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white px-4 py-4 text-left transition hover:border-amber-200 hover:bg-amber-50/40"
                    onClick={() =>
                      navigate(
                        order.trace?.approvalId
                          ? buildOperationsUrl("approvals", { kind: "approval", id: order.trace.approvalId })
                          : buildOperationsUrl("procurement", { kind: "order", id: order.id }),
                      )
                    }
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                      <ClipboardCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-950">{order.id}</p>
                        <Badge tone={order.priority === "critical" ? "rose" : "amber"}>{order.priority}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">
                        {order.medicineName} - {order.trace?.approvalId ?? "Approval queue"} - {formatRelativeTime(order.createdAt)}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">No approval items are waiting for review.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Knowledge Queue</p>
                <Badge tone={processingFiles.length > 0 ? "sky" : "slate"}>{processingFiles.length}</Badge>
              </div>
              {processingFiles.length ? (
                processingFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white px-4 py-4 text-left transition hover:border-sky-200 hover:bg-sky-50/40"
                    onClick={() => navigate(buildMemoryUrl(file.id, { status: file.status }))}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                      <Database className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate font-semibold text-slate-950">{file.filename}</p>
                        <Badge tone={file.status === "processing" ? "sky" : "amber"}>{file.status}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{file.category} - {formatRelativeTime(file.uploadDate)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">All repository files are indexed and retrieval-ready.</div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Integration Attention</p>
                <Badge tone={integrationIssues.length > 0 ? "amber" : "slate"}>{integrationIssues.length}</Badge>
              </div>
              {integrationIssues.length ? (
                integrationIssues.map((api) => (
                  <button
                    key={api.id}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-[1.5rem] border border-slate-200/70 bg-white px-4 py-4 text-left transition hover:border-amber-200 hover:bg-amber-50/40"
                    onClick={() => navigate(buildOperationsUrl("apis"))}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-slate-950">{api.name}</p>
                        <Badge tone={api.status === "degraded" ? "amber" : "rose"}>{api.status}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-600">{api.endpoint} - {api.latencyMs} ms</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="surface-subtle p-4 text-sm text-slate-600">All registered integration services are healthy.</div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/alerts")}>
                View Alerts
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/tools#approvals")}>
                Review Approvals
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/memory")}>
                Knowledge Repository
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => navigate(buildOperationsUrl("apis"))}>
                API Registry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
