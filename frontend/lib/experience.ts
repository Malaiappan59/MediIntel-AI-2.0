import type {
  AuditLogItem,
  AuditLogStatus,
  ChatAction,
  ChatMessage,
  ChatMetric,
  MediIntelDataset,
  MasterAgentExecution,
  OperationalTraceReference,
  OperationsView,
  ProcurementOrder,
  SettingsState,
} from "@/types/medintel";

type ProcurementDraftInput = {
  medicineId?: string;
  quantity?: number;
  note?: string;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function buildAction(label: string, prompt = label, tone: ChatAction["tone"] = "secondary", kind: ChatAction["kind"] = "prompt"): ChatAction {
  return {
    id: `${label.toLowerCase().replace(/\s+/g, "-")}-${tone}`,
    label,
    prompt,
    tone,
    kind,
  };
}

export function getDisplayName(username?: string | null, fallback = "Operations Lead") {
  const trimmed = username?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function getInitials(value?: string | null) {
  const displayName = getDisplayName(value);
  const parts = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "MI";
}

export function formatDateLabel(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatTimeLabel(value: string) {
  return timeFormatter.format(new Date(value));
}

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRelativeTime(value: string) {
  const differenceMs = Date.now() - new Date(value).getTime();
  const differenceMinutes = Math.max(1, Math.round(differenceMs / (1000 * 60)));

  if (differenceMinutes < 60) {
    return `${differenceMinutes}m ago`;
  }

  const differenceHours = Math.round(differenceMinutes / 60);
  if (differenceHours < 24) {
    return `${differenceHours}h ago`;
  }

  const differenceDays = Math.round(differenceHours / 24);
  return `${differenceDays}d ago`;
}

export function getDefaultChatActions() {
  return [
    buildAction("Check Inventory", "Check Inventory", "primary"),
    buildAction("Predict Shortages"),
    buildAction("Recommend"),
    buildAction("Generate Procurement"),
    buildAction("Validate"),
  ];
}

function buildRouteUrl(path: string, options?: { hash?: string; params?: Record<string, string | undefined> }) {
  const searchParams = new URLSearchParams();

  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  const hash = options?.hash ?? "";
  return `${path}${query ? `?${query}` : ""}${hash}`;
}

export function buildOperationsUrl(view: OperationsView, trace?: Pick<OperationalTraceReference, "kind" | "id">) {
  return buildRouteUrl("/tools", {
    hash: `#${view}`,
    params: trace
      ? {
          [trace.kind === "audit" ? "audit" : trace.kind === "approval" ? "approval" : "order"]: trace.id,
        }
      : undefined,
  });
}

export function buildAlertsUrl(options?: {
  alertId?: string;
  severity?: string;
  status?: string;
  source?: string;
  query?: string;
}) {
  return buildRouteUrl("/alerts", {
    params: {
      alert: options?.alertId,
      severity: options?.severity,
      status: options?.status,
      source: options?.source,
      q: options?.query,
    },
  });
}

export function buildMemoryUrl(
  fileId?: string,
  options?: {
    category?: string;
    status?: string;
    query?: string;
  },
) {
  return buildRouteUrl("/memory", {
    params: {
      file: fileId,
      category: options?.category,
      status: options?.status,
      q: options?.query,
    },
  });
}

export function buildWeeklyDemandForecast(dataset: MediIntelDataset) {
  const totalDailyDemand = dataset.inventory.reduce((sum, item) => sum + item.dailyConsumption, 0);
  const riskFactor = dataset.inventory.filter((item) => item.status !== "healthy").length;
  const patterns = [0.96, 1.01, 1.06, 1.02, 1.11, 0.89, 0.84];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    const forecastDemand = Math.round(totalDailyDemand * patterns[index] + riskFactor * 4 + index * 9);
    const safeLevel = Math.round(forecastDemand * 0.92);

    return {
      id: `DAY-${index + 1}`,
      label: weekdayFormatter.format(date),
      demand: forecastDemand,
      safeLevel,
    };
  });
}

export function getInventoryHealthSummary(dataset: MediIntelDataset) {
  const criticalCount = dataset.inventory.filter((item) => item.status === "critical").length;
  const watchCount = dataset.inventory.filter((item) => item.status === "watch").length;
  const score = Math.max(68, 99 - criticalCount * 2 - watchCount);

  if (score >= 90) {
    return {
      score,
      status: "Healthy",
      tone: "emerald" as const,
      detail: "Stock buffers are holding across critical departments.",
    };
  }

  if (score >= 80) {
    return {
      score,
      status: "Monitor",
      tone: "amber" as const,
      detail: "A subset of medicines requires closer replenishment control.",
    };
  }

  return {
    score,
    status: "Critical",
    tone: "rose" as const,
    detail: "Immediate action is required to protect continuity of care.",
  };
}

export function createAuditLogEntry({
  agent,
  action,
  status,
  user,
  detail,
  time,
}: {
  agent: string;
  action: string;
  status: AuditLogStatus;
  user: string;
  detail: string;
  time?: string;
}): AuditLogItem {
  return {
    id: `AUD-${Date.now()}-${Math.round(Math.random() * 999)}`,
    time: time ?? new Date().toISOString(),
    agent,
    action,
    status,
    user,
    detail,
  };
}

export function applySettingsToDataset(
  dataset: MediIntelDataset,
  settings: SettingsState,
  username?: string | null,
  role?: string | null,
) {
  const displayName = getDisplayName(settings.user.displayName, username ?? dataset.settings.user.displayName);
  const effectiveRole = settings.user.role?.trim() || role || dataset.settings.user.role;
  const facilityName = settings.hospital.facilityName.trim() || dataset.hospital.name;
  const facilityCity = settings.hospital.city.trim() || dataset.hospital.location;

  const mergedSettings: SettingsState = {
    general: {
      ...dataset.settings.general,
      ...settings.general,
    },
    theme: {
      ...dataset.settings.theme,
      ...settings.theme,
    },
    hospital: {
      ...dataset.settings.hospital,
      ...settings.hospital,
      facilityName,
      city: facilityCity,
    },
    notifications: {
      ...dataset.settings.notifications,
      ...settings.notifications,
    },
    ai: {
      ...dataset.settings.ai,
      ...settings.ai,
    },
    user: {
      ...dataset.settings.user,
      ...settings.user,
      displayName,
      role: effectiveRole,
    },
  };

  return {
    ...dataset,
    hospital: {
      ...dataset.hospital,
      name: facilityName,
      location: facilityCity,
    },
    orders: dataset.orders.map((order) => ({
      ...order,
      requestedBy: displayName,
    })),
    files: dataset.files.map((file) => ({
      ...file,
      uploadedBy: displayName,
    })),
    auditLogs: dataset.auditLogs.map((log) => ({
      ...log,
      user: displayName,
    })),
    settings: mergedSettings,
  };
}

export function syncDatasetWithUser(dataset: MediIntelDataset, username?: string | null, role = "Admin") {
  return applySettingsToDataset(
    dataset,
    {
      ...dataset.settings,
      user: {
        ...dataset.settings.user,
        displayName: getDisplayName(username, dataset.settings.user.displayName),
        role,
      },
      hospital: {
        ...dataset.settings.hospital,
        facilityName: dataset.settings.hospital.facilityName || dataset.hospital.name,
        city: dataset.settings.hospital.city || dataset.hospital.location,
      },
    },
    username,
    role,
  );
}

export function createProcurementDraft(
  dataset: MediIntelDataset,
  username?: string | null,
  payload?: ProcurementDraftInput,
): ProcurementOrder {
  const displayName = getDisplayName(username);
  const targetMedicine =
    dataset.inventory.find((item) => item.id === payload?.medicineId) ??
    [...dataset.inventory]
      .sort((left, right) => right.shortageRisk - left.shortageRisk || left.daysRemaining - right.daysRemaining)[0];

  const supplier = dataset.suppliers.find((candidate) => candidate.id === targetMedicine.supplierId) ?? dataset.suppliers[0];
  const quantity =
    payload?.quantity ??
    Math.max(targetMedicine.reorderLevel * 2 - targetMedicine.stockOnHand, targetMedicine.dailyConsumption * 10);

  return {
    id: `PO-${String(Date.now()).slice(-6)}`,
    medicineId: targetMedicine.id,
    medicineName: targetMedicine.name,
    supplierId: supplier.id,
    supplierName: supplier.name,
    quantity,
    unitCost: targetMedicine.unitCost,
    totalCost: quantity * targetMedicine.unitCost,
    status: "pending-approval",
    requestedBy: displayName,
    createdAt: new Date().toISOString(),
    eta: new Date(Date.now() + supplier.leadTimeDays * 24 * 60 * 60 * 1000).toISOString(),
    priority: targetMedicine.status === "critical" ? "critical" : "warning",
  };
}

export function buildProcurementTraceMessage(order: ProcurementOrder, username?: string | null): ChatMessage {
  const displayName = getDisplayName(username, order.requestedBy);
  const trace: OperationalTraceReference[] = [
    {
      kind: "order",
      id: order.id,
      label: "Purchase Request",
      description: `${order.medicineName} routed through ${order.supplierName}.`,
      view: "procurement",
    },
  ];

  if (order.trace?.approvalId) {
    trace.push({
      kind: "approval",
      id: order.trace.approvalId,
      label: "Approval Queue",
      description: `Assigned to ${order.trace.assignedRole ?? "Procurement Manager"} for decision review.`,
      view: "approvals",
    });
  }

  if (order.trace?.auditId) {
    trace.push({
      kind: "audit",
      id: order.trace.auditId,
      label: "Audit Trail",
      description: "The purchase generation event is available in the operational audit log.",
      view: "audit",
    });
  }

  return {
    id: `CHAT-LOCAL-${order.id}-${Date.now()}`,
    role: "assistant",
    headline: `Purchase request ${order.id} created`,
    content: `A live procurement request for ${order.medicineName} has been created and routed for enterprise review.`,
    createdAt: new Date().toISOString(),
    confidence: 0.97,
    reasoning: "The request was created from the current shortage posture, supplier routing, and approval workflow readiness.",
    contributions: [
      {
        id: `operations-${order.id}`,
        agent: "Operations Agent",
        summary: "Inventory priority converted into a live procurement record.",
        detail: `${order.medicineName} now has an active replenishment request in the operational queue.`,
        status: "completed",
      },
      {
        id: `intelligence-${order.id}`,
        agent: "Intelligence Agent",
        summary: "Urgency and supplier routing validated.",
        detail: `${order.supplierName} was selected for the fastest safe replenishment path against the current risk posture.`,
        status: "completed",
      },
      {
        id: `decision-${order.id}`,
        agent: "Decision Agent",
        summary: "Approval package assembled.",
        detail: `${order.trace?.approvalId ?? "Approval workflow"} is ready for ${order.trace?.assignedRole ?? "procurement leadership"} review.`,
        status: "completed",
      },
      {
        id: `action-${order.id}`,
        agent: "Action Agent",
        summary: "Traceable handoff completed.",
        detail: `Procurement, approval, and audit references are now linked for ${displayName}.`,
        status: "completed",
      },
    ],
    table: {
      title: "Generated procurement request",
      columns: [
        { key: "request", label: "Request" },
        { key: "medicine", label: "Medicine" },
        { key: "supplier", label: "Supplier" },
        { key: "eta", label: "ETA" },
        { key: "cost", label: "Cost", align: "right" },
        { key: "status", label: "Status" },
      ],
      rows: [
        {
          request: order.id,
          medicine: order.medicineName,
          supplier: order.supplierName,
          eta: formatDateTime(order.eta),
          cost: formatCurrency(order.totalCost),
          status: order.status.replace("-", " "),
        },
      ],
    },
    metrics: buildMetrics([
      { label: "Request", value: order.id, tone: "sky" },
      { label: "Approval", value: order.trace?.approvalId ?? "Pending", tone: "amber" },
      { label: "Open Spend", value: formatCurrency(order.totalCost), tone: "emerald" },
    ]),
    followUpActions: [
      ...(order.trace?.approvalId
        ? [
            {
              id: `track-approval-${order.id}`,
              label: "Track Approval",
              prompt: `Track Approval ${order.id}`,
              tone: "primary",
              kind: "navigate-view" as const,
              view: "approvals" as const,
              traceId: order.trace.approvalId,
              traceKind: "approval" as const,
            },
          ]
        : []),
      {
        id: `open-procurement-${order.id}`,
        label: "Open Procurement",
        prompt: `Open Procurement ${order.id}`,
        kind: "navigate-view",
        view: "procurement",
        traceId: order.id,
        traceKind: "order",
      },
      ...(order.trace?.auditId
        ? [
            {
              id: `open-audit-${order.id}`,
              label: "Open Audit Trail",
              prompt: `Open Audit Trail ${order.id}`,
              kind: "navigate-view" as const,
              view: "audit" as const,
              traceId: order.trace.auditId,
              traceKind: "audit" as const,
            },
          ]
        : []),
      {
        id: `download-purchase-order-${order.id}`,
        label: "Download Purchase Order",
        prompt: "Download Purchase Order",
        kind: "download-purchase-order",
      },
    ],
    operationalTrace: trace,
  };
}

function buildMetrics(metrics: Array<{ label: string; value: string; tone: ChatMetric["tone"] }>) {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    tone: metric.tone,
  }));
}

export function buildAgentReply(
  message: string,
  dataset: MediIntelDataset,
  execution: MasterAgentExecution | null,
  username?: string | null,
  remoteReasoning?: string,
  generatedOrder?: ProcurementOrder | null,
): ChatMessage {
  const normalized = message.toLowerCase();
  const displayName = getDisplayName(username);
  const atRiskMedicines = [...dataset.inventory]
    .sort((left, right) => right.shortageRisk - left.shortageRisk || left.daysRemaining - right.daysRemaining)
    .slice(0, 5);
  const criticalAlerts = dataset.alerts
    .filter((alert) => alert.status === "open")
    .sort((left, right) => left.severity.localeCompare(right.severity))
    .slice(0, 5);
  const pendingOrders = dataset.orders
    .filter((order) => order.status === "pending-approval" || order.status === "modified")
    .slice(0, 5);

  const createdAt = new Date().toISOString();

  if (normalized.includes("supplier")) {
    const topSuppliers = atRiskMedicines
      .map((medicine) => dataset.suppliers.find((supplier) => supplier.id === medicine.supplierId))
      .filter((supplier, index, suppliers) => supplier && suppliers.findIndex((item) => item?.id === supplier.id) === index)
      .slice(0, 4);

    return {
      id: `CHAT-${Date.now()}`,
      role: "assistant",
      headline: `Supplier comparison ready for ${displayName}`,
      content: "Supplier coverage and lead-time risk have been compared for the current shortage watchlist.",
      createdAt,
      confidence: 0.93,
      reasoning: remoteReasoning ?? "Supplier comparison combines lead time, fulfillment rate, and department criticality for at-risk medicines.",
      contributions: [
        {
          id: "operations-supplier",
          agent: "Operations Agent",
          summary: "Current supplier dependencies mapped.",
          detail: `${topSuppliers.length} priority suppliers are supporting the highest-risk medicines this week.`,
          status: "completed",
        },
        {
          id: "intelligence-supplier",
          agent: "Intelligence Agent",
          summary: "Lead-time exposure calculated.",
          detail: `${topSuppliers[0]?.name ?? "Primary supplier"} has the strongest delivery reliability for the current risk cluster.`,
          status: "completed",
        },
        {
          id: "decision-supplier",
          agent: "Decision Agent",
          summary: "Preferred vendor routing selected.",
          detail: "Use the highest on-time supplier for ICU-critical items and maintain secondary coverage for oncology demand spikes.",
          status: "completed",
        },
        {
          id: "action-supplier",
          agent: "Action Agent",
          summary: "Procurement handoff prepared.",
          detail: "Supplier comparison has been prepared for procurement review and approval routing.",
          status: "completed",
        },
      ],
      table: {
        title: "Supplier comparison",
        columns: [
          { key: "name", label: "Supplier" },
          { key: "city", label: "City" },
          { key: "leadTime", label: "Lead Time", align: "right" },
          { key: "onTime", label: "On-Time", align: "right" },
          { key: "fulfillment", label: "Fulfillment", align: "right" },
        ],
        rows: topSuppliers.map((supplier) => ({
          name: supplier?.name ?? "N/A",
          city: supplier?.city ?? "N/A",
          leadTime: `${supplier?.leadTimeDays ?? 0}d`,
          onTime: `${supplier?.onTimeRate ?? 0}%`,
          fulfillment: `${supplier?.fulfillmentRate ?? 0}%`,
        })),
      },
      metrics: buildMetrics([
        { label: "Suppliers Reviewed", value: String(topSuppliers.length), tone: "sky" },
        { label: "Best On-Time Rate", value: `${Math.max(...topSuppliers.map((supplier) => supplier?.onTimeRate ?? 0))}%`, tone: "emerald" },
      ]),
      followUpActions: [
        buildAction("Generate Recommendation"),
        buildAction("Generate Procurement"),
        buildAction("Review Alerts"),
      ],
    };
  }

  if (normalized.includes("procure") || normalized.includes("order") || normalized.includes("approval")) {
    const currentOrder = generatedOrder ?? pendingOrders[0];

    return {
      id: `CHAT-${Date.now()}`,
      role: "assistant",
      headline: `Procurement pathway prepared for ${displayName}`,
      content: `A procurement path has been prepared for ${currentOrder?.medicineName ?? "the highest-risk medicine"} with supplier routing and approval readiness.`,
      createdAt,
      confidence: 0.94,
      reasoning: remoteReasoning ?? execution?.reasoning ?? "Procurement recommendations are ranked by shortage risk, supplier lead time, and expected patient-care impact.",
      contributions: [
        {
          id: "operations-procurement",
          agent: "Operations Agent",
          summary: "Pending procurement queue reviewed.",
          detail: `${pendingOrders.length} requests are waiting for approval or modification across critical care, pharmacy, and specialty units.`,
          status: "completed",
        },
        {
          id: "intelligence-procurement",
          agent: "Intelligence Agent",
          summary: "Supply urgency prioritised.",
          detail: `${currentOrder?.medicineName ?? atRiskMedicines[0]?.name} is the most urgent procurement candidate based on runway and demand acceleration.`,
          status: "completed",
        },
        {
          id: "decision-procurement",
          agent: "Decision Agent",
          summary: "Supplier routing selected.",
          detail: `${currentOrder?.supplierName ?? "Primary supplier"} offers the best balance of lead time and fulfillment for this order.`,
          status: "completed",
        },
        {
          id: "action-procurement",
          agent: "Action Agent",
          summary: "Purchase request staged.",
          detail: `${currentOrder?.id ?? "Draft order"} is now ready for approval workflow and supplier notification.`,
          status: "completed",
        },
      ],
      table: {
        title: "Pending procurement",
        columns: [
          { key: "request", label: "Request" },
          { key: "medicine", label: "Medicine" },
          { key: "supplier", label: "Supplier" },
          { key: "eta", label: "ETA" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: pendingOrders.map((order) => ({
          request: order.id,
          medicine: order.medicineName,
          supplier: order.supplierName,
          eta: formatDateLabel(order.eta),
          cost: formatCurrency(order.totalCost),
          status: order.status.replace("-", " "),
        })),
      },
      metrics: buildMetrics([
        { label: "Pending Approvals", value: String(pendingOrders.length), tone: "amber" },
        { label: "Top Request", value: currentOrder?.id ?? "PO-NA", tone: "sky" },
      ]),
      followUpActions: [
        buildAction("Track Approval"),
        buildAction("Notify Supplier"),
        buildAction("Download Purchase Order", "Download Purchase Order", "secondary", "download-purchase-order"),
      ],
    };
  }

  if (normalized.includes("alert")) {
    return {
      id: `CHAT-${Date.now()}`,
      role: "assistant",
      headline: `Alert review completed for ${displayName}`,
      content: "Critical and warning signals have been consolidated into a single action queue.",
      createdAt,
      confidence: 0.91,
      reasoning: remoteReasoning ?? "Alert prioritization is driven by severity, source, and unresolved operational impact.",
      contributions: [
        {
          id: "operations-alerts",
          agent: "Operations Agent",
          summary: "Open alerts consolidated.",
          detail: `${criticalAlerts.length} high-priority items currently require review across inventory, forecasting, and procurement.`,
          status: "completed",
        },
        {
          id: "intelligence-alerts",
          agent: "Intelligence Agent",
          summary: "Cross-signal risk patterns identified.",
          detail: `${criticalAlerts[0]?.medicineName ?? "Platelet stock"} is the leading alert cluster by urgency.`,
          status: "completed",
        },
        {
          id: "decision-alerts",
          agent: "Decision Agent",
          summary: "Escalation path selected.",
          detail: "Priority has been assigned to unresolved critical shortages and delayed approval chains.",
          status: "completed",
        },
        {
          id: "action-alerts",
          agent: "Action Agent",
          summary: "Resolution queue updated.",
          detail: "Critical alert routing has been prepared for pharmacy leadership and procurement control.",
          status: "completed",
        },
      ],
      table: {
        title: "Critical alerts",
        columns: [
          { key: "title", label: "Alert" },
          { key: "severity", label: "Severity" },
          { key: "source", label: "Source" },
          { key: "time", label: "Time" },
          { key: "status", label: "Status" },
        ],
        rows: criticalAlerts.map((alert) => ({
          title: alert.title,
          severity: alert.severity,
          source: alert.source,
          time: formatTimeLabel(alert.time),
          status: alert.status,
        })),
      },
      followUpActions: [
        buildAction("Review Alerts", "Review Alerts", "primary"),
        buildAction("Generate Recommendation"),
        buildAction("Procure"),
      ],
    };
  }

  if (
    normalized.includes("forecast") ||
    normalized.includes("predict") ||
    normalized.includes("shortage") ||
    normalized.includes("recommend") ||
    normalized.includes("validate") ||
    normalized.includes("explain")
  ) {
    return {
      id: `CHAT-${Date.now()}`,
      role: "assistant",
      headline: `Shortage forecast prepared for ${displayName}`,
      content: "Demand, supplier sensitivity, and buffer depletion were evaluated across the live medicine set.",
      createdAt,
      confidence: 0.95,
      reasoning:
        remoteReasoning ??
        execution?.reasoning ??
        "Forecast results combine consumption pace, days remaining, supplier lead time, and alert pressure to estimate near-term shortage exposure.",
      contributions: [
        {
          id: "operations-forecast",
          agent: "Operations Agent",
          summary: "Inventory baseline analysed.",
          detail: `${dataset.inventory.length} medicines were scanned and ${atRiskMedicines.length} items were promoted into the active watchlist.`,
          status: "completed",
        },
        {
          id: "intelligence-forecast",
          agent: "Intelligence Agent",
          summary: "Demand forecast completed.",
          detail: `${atRiskMedicines[0]?.name ?? "Critical stock"} is projected to breach safe stock first, followed by ${atRiskMedicines[1]?.name ?? "secondary stock"}.`,
          status: "completed",
        },
        {
          id: "decision-forecast",
          agent: "Decision Agent",
          summary: "Best-response scenario selected.",
          detail: "Expedited procurement with supplier diversification offers the strongest service-continuity outcome this week.",
          status: "completed",
        },
        {
          id: "action-forecast",
          agent: "Action Agent",
          summary: "Execution handoff assembled.",
          detail: "Forecast recommendations are ready for procurement generation, approval routing, and department notification.",
          status: "completed",
        },
      ],
      table: {
        title: "At-risk medicines",
        columns: [
          { key: "medicine", label: "Medicine" },
          { key: "current", label: "Current", align: "right" },
          { key: "minimum", label: "Minimum", align: "right" },
          { key: "daysLeft", label: "Days Left", align: "right" },
          { key: "risk", label: "Risk", align: "right" },
        ],
        rows: atRiskMedicines.map((medicine) => ({
          medicine: medicine.name,
          current: medicine.stockOnHand,
          minimum: medicine.reorderLevel,
          daysLeft: medicine.daysRemaining,
          risk: `${medicine.shortageRisk}%`,
        })),
      },
      metrics: buildMetrics([
        { label: "Predicted Shortages", value: String(atRiskMedicines.length), tone: "amber" },
        { label: "Highest Risk", value: `${atRiskMedicines[0]?.shortageRisk ?? 0}%`, tone: "rose" },
        { label: "Confidence", value: "95%", tone: "sky" },
      ]),
      followUpActions: [
        buildAction("Generate Recommendation", "Generate Recommendation", "primary"),
        buildAction("Compare Suppliers"),
        buildAction("Explain Forecast"),
        buildAction("Generate Procurement"),
      ],
    };
  }

  return {
    id: `CHAT-${Date.now()}`,
    role: "assistant",
    headline: `Inventory control posture prepared for ${displayName}`,
    content: `MediIntel AI analysed ${dataset.inventory.length} medicines and highlighted the current low-stock and expiry watchlist.`,
    createdAt,
    confidence: 0.92,
    reasoning: remoteReasoning ?? "Inventory analysis weighs stock on hand, reorder thresholds, days remaining, and medicine criticality.",
    contributions: [
      {
        id: "operations-inventory",
        agent: "Operations Agent",
        summary: "Inventory analysed.",
        detail: `${dataset.inventory.length} medicines scanned across pharmacy, ICU, emergency, and specialty departments.`,
        status: "completed",
      },
      {
        id: "intelligence-inventory",
        agent: "Intelligence Agent",
        summary: "Low-stock cluster detected.",
        detail: `${atRiskMedicines[0]?.name ?? "Critical stock"} and ${atRiskMedicines[1]?.name ?? "secondary stock"} are closest to threshold breach.`,
        status: "completed",
      },
      {
        id: "decision-inventory",
        agent: "Decision Agent",
        summary: "Intervention order prioritised.",
        detail: "Pharmacy replenishment should focus first on medicines with less than 10 days of runway and critical care dependency.",
        status: "completed",
      },
      {
        id: "action-inventory",
        agent: "Action Agent",
        summary: "Follow-up actions prepared.",
        detail: "Download-ready inventory review and escalation pathways are now available for the current watchlist.",
        status: "completed",
      },
    ],
    table: {
      title: "Inventory watchlist",
      columns: [
        { key: "medicine", label: "Medicine" },
        { key: "current", label: "Current", align: "right" },
        { key: "minimum", label: "Minimum", align: "right" },
        { key: "daysLeft", label: "Days Left", align: "right" },
        { key: "risk", label: "Risk", align: "right" },
        { key: "action", label: "Action" },
      ],
      rows: atRiskMedicines.map((medicine) => ({
        medicine: medicine.name,
        current: medicine.stockOnHand,
        minimum: medicine.reorderLevel,
        daysLeft: medicine.daysRemaining,
        risk: `${medicine.shortageRisk}%`,
        action: medicine.daysRemaining < 7 ? "Escalate" : "Review",
      })),
    },
    metrics: buildMetrics([
      { label: "Medicines Scanned", value: String(dataset.inventory.length), tone: "sky" },
      { label: "Critical Items", value: String(dataset.inventory.filter((item) => item.status === "critical").length), tone: "rose" },
      { label: "Near Expiry", value: String(dataset.inventory.filter((item) => item.daysRemaining < 14).length), tone: "amber" },
    ]),
    followUpActions: [
      buildAction("Show Low Stock", "Check Inventory", "primary"),
      buildAction("Near Expiry"),
      buildAction("Download Report", "Download Report", "secondary", "download-report"),
      buildAction("Predict Shortages"),
    ],
  };
}
