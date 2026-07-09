"use client";

import { ArrowUpRight, BellRing, CheckCircle2, ClipboardCheck, History, Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateLabel, formatDateTime, formatRelativeTime } from "@/lib/experience";
import { cn } from "@/lib/utils";
import type { AlertItem, AuditLogItem, ProcurementOrder } from "@/types/medintel";

type AlertFocusPanelProps = {
  alert: AlertItem | null;
  relatedOrder: ProcurementOrder | null;
  relatedAuditLogs: AuditLogItem[];
  siblingAlerts: AlertItem[];
  isResolving: boolean;
  onOpenAlert: (alertId: string) => void;
  onClearFocus: () => void;
  onOpenOrder: (orderId: string) => void;
  onOpenApproval: (approvalId: string) => void;
  onOpenAudit: (auditId: string) => void;
  onResolve: (alertId: string) => void;
};

function getAlertTone(severity: AlertItem["severity"]) {
  if (severity === "critical") {
    return "rose" as const;
  }

  if (severity === "warning") {
    return "amber" as const;
  }

  return "sky" as const;
}

function getAlertStatusTone(status: AlertItem["status"]) {
  return status === "resolved" ? ("emerald" as const) : ("slate" as const);
}

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

function getAuditStatusTone(status: AuditLogItem["status"]) {
  if (status === "completed") {
    return "emerald" as const;
  }

  if (status === "rejected") {
    return "rose" as const;
  }

  if (status === "attention" || status === "modified") {
    return "amber" as const;
  }

  return "sky" as const;
}

function formatStatusLabel(value: string) {
  return value.replace(/-/g, " ");
}

export function AlertFocusPanel({
  alert,
  relatedOrder,
  relatedAuditLogs,
  siblingAlerts,
  isResolving,
  onOpenAlert,
  onClearFocus,
  onOpenOrder,
  onOpenApproval,
  onOpenAudit,
  onResolve,
}: AlertFocusPanelProps) {
  if (!alert) {
    return (
      <Card className="border border-dashed border-sky-200 bg-white/90">
        <CardContent className="space-y-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="section-title text-xl font-semibold text-slate-950">Focus an alert</p>
            <p className="text-sm leading-6 text-slate-600">
              Select an alert from the timeline to inspect linked procurement, approval posture, sibling-risk clusters, and audit activity.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openSiblings = siblingAlerts.filter((item) => item.id !== alert.id && item.status === "open");
  const primaryAuditLog = relatedAuditLogs[0] ?? null;

  return (
    <Card className="border border-sky-100">
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <CardTitle>Focused Alert</CardTitle>
          <CardDescription>Review the selected signal with procurement, approvals, and audit context in one place.</CardDescription>
        </div>

        <div className="surface-subtle space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-950">{alert.title}</p>
              <p className="text-sm leading-6 text-slate-600">{alert.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={getAlertTone(alert.severity)}>{alert.severity}</Badge>
              <Badge tone={getAlertStatusTone(alert.status)}>{alert.status}</Badge>
              <Badge tone="slate">{alert.source}</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medicine</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{alert.medicineName ?? "Operational signal"}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reported</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatRelativeTime(alert.time)}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDateTime(alert.time)}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Open Cluster</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{openSiblings.length + (alert.status === "open" ? 1 : 0)} related alerts</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Audit Context</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{relatedAuditLogs.length} linked events</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {alert.status === "open" ? (
              <Button type="button" size="sm" onClick={() => onResolve(alert.id)} disabled={isResolving}>
                {isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Resolve Alert
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={onClearFocus}>
              Clear Focus
            </Button>
            {relatedOrder ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenOrder(relatedOrder.id)}>
                Open Procurement
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            {relatedOrder?.trace?.approvalId ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenApproval(relatedOrder.trace?.approvalId ?? relatedOrder.id)}>
                Approval Queue
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            {relatedOrder?.trace?.auditId ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenAudit(relatedOrder.trace?.auditId ?? alert.id)}>
                Open Audit
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : primaryAuditLog ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenAudit(primaryAuditLog.id)}>
                Open Audit
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Linked workflow</p>
          </div>
          {relatedOrder ? (
            <div className="surface-subtle space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{relatedOrder.id}</p>
                  <p className="mt-1 text-sm text-slate-600">{relatedOrder.supplierName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={getOrderStatusTone(relatedOrder.status)}>{formatStatusLabel(relatedOrder.status)}</Badge>
                  <Badge tone={getAlertTone(relatedOrder.priority)}>{relatedOrder.priority}</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">ETA</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateLabel(relatedOrder.eta)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Spend</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatCurrency(relatedOrder.totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approval</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{relatedOrder.trace?.approvalId ?? "Pending linkage"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Requested By</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{relatedOrder.requestedBy}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              No procurement request is currently linked to this alert. The alert remains in triage until a replenishment workflow is generated.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-slate-950">Related alert cluster</p>
          </div>
          {openSiblings.length ? (
            <div className="space-y-3">
              {openSiblings.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="surface-subtle w-full space-y-2 p-4 text-left transition-colors duration-200 hover:bg-sky-50"
                  onClick={() => onOpenAlert(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                    <Badge tone={getAlertTone(item.severity)}>{item.severity}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{item.source}</span>
                    <span>{formatRelativeTime(item.time)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              No additional open alerts are currently clustered with this medicine signal.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Recent audit context</p>
          </div>
          {relatedAuditLogs.length ? (
            <div className="space-y-3">
              {relatedAuditLogs.slice(0, 4).map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className={cn("surface-subtle w-full space-y-2 p-4 text-left transition-colors duration-200 hover:bg-sky-50")}
                  onClick={() => onOpenAudit(log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{log.action}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{log.detail}</p>
                    </div>
                    <Badge tone={getAuditStatusTone(log.status)}>{log.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{log.agent}</span>
                    <span>{formatRelativeTime(log.time)}</span>
                    {log.entityId ? <span>{log.entityId}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              Audit entries will appear here after alert escalations, resolutions, or linked procurement actions are recorded.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
