"use client";

import { ArrowUpRight, ClipboardCheck, History, Loader2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateLabel, formatDateTime, formatRelativeTime } from "@/lib/experience";
import { cn } from "@/lib/utils";
import type { AlertItem, AuditLogItem, ProcurementOrder } from "@/types/medintel";

type ReviewOrderStatus = Extract<ProcurementOrder["status"], "approved" | "rejected" | "modified">;

type OperationalReference = {
  view: "procurement" | "approvals" | "audit";
  kind: "order" | "approval" | "audit";
  id: string;
};

type OrderFocusPanelProps = {
  order: ProcurementOrder | null;
  auditLog?: AuditLogItem | null;
  relatedAlerts: AlertItem[];
  relatedLogs: AuditLogItem[];
  focusedAuditId?: string | null;
  canApprove: boolean;
  canReject: boolean;
  reviewState?: {
    orderId?: string | null;
    status: ReviewOrderStatus;
    bulk?: boolean;
  } | null;
  onOpenReference: (reference: OperationalReference) => void;
  onOpenAlert: (alertId: string, severity?: string) => void;
  onReview: (orderId: string, status: ReviewOrderStatus) => void;
  onClearFocus: () => void;
};

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

function getPriorityTone(priority: ProcurementOrder["priority"]) {
  if (priority === "critical") {
    return "rose" as const;
  }

  if (priority === "warning") {
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

export function OrderFocusPanel({
  order,
  auditLog,
  relatedAlerts,
  relatedLogs,
  focusedAuditId,
  canApprove,
  canReject,
  reviewState,
  onOpenReference,
  onOpenAlert,
  onReview,
  onClearFocus,
}: OrderFocusPanelProps) {
  const isReviewRunning = Boolean(reviewState);

  if (!order && auditLog) {
    return (
      <Card className="border border-sky-100">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Focused Audit Event</CardTitle>
              <CardDescription>Operational trace detail opened from the review workspace.</CardDescription>
            </div>
            <Badge tone={getAuditStatusTone(auditLog.status)}>{auditLog.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agent</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{auditLog.agent}</p>
            </div>
            <div className="surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Time</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(auditLog.time)}</p>
            </div>
            <div className="surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Action</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{auditLog.action}</p>
            </div>
            <div className="surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">User</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{auditLog.user}</p>
            </div>
          </div>

          <div className="surface-subtle space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Detail</p>
            <p className="text-sm leading-6 text-slate-700">{auditLog.detail}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {auditLog.tool ? <Badge tone="slate">{auditLog.tool}</Badge> : null}
              {auditLog.entityType ? <Badge tone="sky">{auditLog.entityType}</Badge> : null}
              {auditLog.entityId ? <Badge tone="amber">{auditLog.entityId}</Badge> : null}
            </div>
          </div>

          <Button type="button" variant="outline" onClick={onClearFocus}>
            Clear Focus
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className="border border-dashed border-sky-200 bg-white/90">
        <CardContent className="space-y-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="section-title text-xl font-semibold text-slate-950">Focus an operational record</p>
            <p className="text-sm leading-6 text-slate-600">
              Select a procurement request, approval item, or audit event to inspect linked references, related alerts, and recent workflow history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestWorkflowStatus = reviewState?.orderId === order.id ? reviewState.status : null;
  const isPendingReview = order.status === "pending-approval" || order.status === "modified";
  const timeline = [
    {
      id: `${order.id}-created`,
      title: "Purchase request generated",
      detail: `${order.id} was created by ${order.requestedBy} for ${order.quantity} units of ${order.medicineName}.`,
      time: order.createdAt,
      tone: "sky" as const,
    },
    ...(order.trace?.approvalId
      ? [
          {
            id: `${order.id}-approval`,
            title: "Approval package assembled",
            detail: `${order.trace.assignedRole ?? "Procurement leadership"} is reviewing ${order.trace.approvalId}.`,
            time: order.createdAt,
            tone: "amber" as const,
          },
        ]
      : []),
    ...(order.trace?.lastAction
      ? [
          {
            id: `${order.id}-latest`,
            title: `Latest update: ${order.trace.lastAction}`,
            detail: `Workflow status is currently ${formatStatusLabel(order.status)}.`,
            time: order.trace.lastActionAt ?? order.createdAt,
            tone: getOrderStatusTone(order.status),
          },
        ]
      : []),
    {
      id: `${order.id}-eta`,
      title: order.status === "received" ? "Delivered to facility" : "Supplier ETA",
      detail: `${order.supplierName} is scheduled for ${formatDateLabel(order.eta)}.`,
      time: order.status === "received" ? order.trace?.lastActionAt ?? order.eta : order.eta,
      tone: order.status === "received" ? ("emerald" as const) : ("sky" as const),
    },
  ];

  return (
    <Card className="border border-sky-100">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Focused Operational Record</CardTitle>
            <CardDescription>Trace approvals, audit entries, and linked risk around the selected request.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>
            Clear
          </Button>
        </div>

        <div className="surface-subtle space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Request</p>
              <p className="text-lg font-semibold text-slate-950">{order.id}</p>
              <p className="text-sm text-slate-600">{order.medicineName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={getOrderStatusTone(order.status)}>{formatStatusLabel(order.status)}</Badge>
              <Badge tone={getPriorityTone(order.priority)}>{order.priority}</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{order.supplierName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Spend</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatCurrency(order.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Created</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">ETA</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(order.eta)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenReference({ view: "procurement", kind: "order", id: order.id })}
            >
              Open Procurement
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
            {order.trace?.approvalId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenReference({ view: "approvals", kind: "approval", id: order.trace?.approvalId ?? order.id })}
              >
                Open Approval
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
            {order.trace?.auditId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenReference({ view: "audit", kind: "audit", id: order.trace?.auditId ?? order.id })}
              >
                Open Audit
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isPendingReview ? (
          <div className="surface-azure space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-900">Decision Controls</p>
                <p className="mt-1 text-sm text-sky-800/80">Review this request directly from the focused operations panel.</p>
              </div>
              {latestWorkflowStatus ? <Badge tone="sky">{formatStatusLabel(latestWorkflowStatus)}</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <Button type="button" size="sm" disabled={isReviewRunning} onClick={() => onReview(order.id, "approved")}>
                  {reviewState?.orderId === order.id && reviewState.status === "approved" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Approve
                </Button>
              ) : null}
              {canApprove ? (
                <Button type="button" size="sm" variant="secondary" disabled={isReviewRunning} onClick={() => onReview(order.id, "modified")}>
                  {reviewState?.orderId === order.id && reviewState.status === "modified" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Modify
                </Button>
              ) : null}
              {canReject ? (
                <Button type="button" size="sm" variant="danger" disabled={isReviewRunning} onClick={() => onReview(order.id, "rejected")}>
                  {reviewState?.orderId === order.id && reviewState.status === "rejected" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reject
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Operational checkpoints</p>
          </div>
          <div className="space-y-3">
            {timeline.map((item, index) => (
              <div key={item.id} className="relative pl-6">
                {index < timeline.length - 1 ? <span className="absolute left-[7px] top-6 h-[calc(100%+12px)] w-px bg-slate-200" /> : null}
                <span
                  className={cn(
                    "absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm",
                    item.tone === "emerald"
                      ? "bg-emerald-500"
                      : item.tone === "amber"
                        ? "bg-amber-500"
                        : item.tone === "rose"
                          ? "bg-rose-500"
                          : "bg-sky-500",
                  )}
                />
                <div className="surface-subtle space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{formatRelativeTime(item.time)}</p>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-slate-950">Related alerts</p>
          </div>
          {relatedAlerts.length ? (
            <div className="space-y-3">
              {relatedAlerts.slice(0, 3).map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  className="surface-subtle w-full space-y-2 p-4 text-left transition-colors duration-200 hover:bg-sky-50"
                  onClick={() => onOpenAlert(alert.id, alert.severity)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{alert.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{alert.description}</p>
                    </div>
                    <Badge tone={alert.severity === "critical" ? "rose" : alert.severity === "warning" ? "amber" : "sky"}>{alert.severity}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{alert.source}</span>
                    <span>{formatRelativeTime(alert.time)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              No unresolved alerts are currently linked to {order.medicineName}.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Recent audit history</p>
          </div>
          {relatedLogs.length ? (
            <div className="space-y-3">
              {relatedLogs.slice(0, 4).map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className={cn(
                    "surface-subtle w-full space-y-2 p-4 text-left transition-colors duration-200 hover:bg-sky-50",
                    focusedAuditId === log.id && "border border-sky-200 bg-sky-50/80",
                  )}
                  onClick={() => onOpenReference({ view: "audit", kind: "audit", id: log.id })}
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
                    {log.tool ? <span>{log.tool}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              Audit events will appear here as the order moves through approval and supplier execution.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
