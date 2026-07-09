import { authorizedFetch } from "@/services/auth-service";
import type {
  ApiDefinition,
  AuditLogItem,
  ChatAction,
  ChatMessage,
  OperationalTraceReference,
  ChatSource,
  MasterAgentExecution,
  MediIntelDataset,
  MemoryFile,
  ProcurementOrder,
  Supplier,
} from "@/types/medintel";

type UploadFilePayload = {
  filename: string;
  category: string;
  sizeLabel: string;
  content: string;
  file?: File;
};

type CreateApiPayload = {
  name: string;
  endpoint: string;
  method: ApiDefinition["method"];
  authentication: string;
  description: string;
};

type GenerateProcurementPayload = {
  medicineId?: string;
  quantity?: number;
  note?: string;
};

type ReviewOrderStatus = Extract<ProcurementOrder["status"], "approved" | "rejected" | "modified">;

type ProcurementTracePayload = {
  approval_id?: string | null;
  approval_history_id?: string | null;
  audit_id?: string | null;
  assigned_role?: string | null;
  last_action?: string | null;
  last_action_at?: string | null;
};

type ProcurementOrderPayload = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  supplier_id: string;
  supplier_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  requested_by: string;
  created_at: string;
  eta: string;
  priority: string;
  trace?: ProcurementTracePayload | null;
};

type AuditLogPayload = {
  id: string;
  time: string;
  agent: string;
  action: string;
  status: string;
  user: string;
  detail: string;
  tool?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

type ChatReplyPayload = {
  id: string;
  role: string;
  user: string;
  intent: string;
  created_at: string;
  runtime_mode: "live" | "degraded";
  agents_used: string[];
  summary: {
    headline: string;
    narrative: string;
    metrics: Array<{ label: string; value: string; tone: string }>;
  };
  tables: Array<{
    title: string;
    columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
    rows: Array<Record<string, string | number>>;
  }>;
  recommendations: string[];
  actions: Array<{ id: string; label: string; prompt: string; tone?: "primary" | "secondary"; kind?: ChatAction["kind"] }>;
  confidence: number;
  reasoning: string;
  contributions: Array<{
    id: string;
    agent: string;
    summary: string;
    detail: string;
    status: "completed" | "running" | "attention";
  }>;
  sources: Array<{
    id: string;
    filename: string;
    category: string;
    excerpt: string;
    score?: number;
    strategy?: string;
  }>;
  warnings: string[];
  audit_id: string;
  execution: {
    id: string;
    goal: string;
    launched_at: string;
    confidence_score: number;
    reasoning: string;
    next_action: string;
    stages: MasterAgentExecution["stages"];
    timeline: MasterAgentExecution["timeline"];
  };
};

type SupplierPayload = {
  id: string;
  name: string;
  city: string;
  specialty: string;
  contact: string;
  lead_time_days: number;
  on_time_rate: number;
  fulfillment_rate: number;
};

function createDefaultSettings(username = "Operations Lead", role = "Admin") {
  return {
    general: {
      workspaceName: "MediIntel Live Operations Center",
      timezone: "Asia/Kolkata",
      refreshInterval: "15 seconds",
    },
    theme: {
      mode: "light" as const,
      accent: "azure" as const,
      density: "comfortable" as const,
    },
    hospital: {
      facilityName: "Awaiting live hospital profile",
      city: "Database connection required",
      escalationEmail: "",
    },
    notifications: {
      email: true,
      sms: false,
      criticalOnly: true,
    },
    ai: {
      autopilotEnabled: true,
      confidenceThreshold: 82,
      ragEnabled: true,
    },
    user: {
      displayName: username,
      role,
      team: "Operations Excellence",
    },
  };
}

function createEmptyDataset(username = "Operations Lead", role = "Admin"): MediIntelDataset {
  return {
    hospital: {
      name: "Awaiting live hospital profile",
      tagline: "Predict. Prevent. Procure.",
      location: "Database connection required",
      mission: "Awaiting live hospital mission from the backend database.",
      beds: 0,
      departments: [],
    },
    inventory: [],
    suppliers: [],
    forecasts: [],
    orders: [],
    alerts: [],
    files: [],
    apis: [],
    chatHistory: [],
    auditLogs: [],
    settings: createDefaultSettings(username, role),
  };
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authorizedFetch(path, init);
  if (!response.ok) {
    let detail = `Request failed for ${path}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

async function readBlob(path: string, init?: RequestInit): Promise<Response> {
  const response = await authorizedFetch(path, init);
  if (!response.ok) {
    let detail = `Request failed for ${path}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }
  return response;
}

function normalizeFile(file: {
  id: string;
  filename: string;
  category: string;
  upload_date: string;
  uploaded_by?: string | null;
  status: string;
  size_label: string;
  summary: string;
  download_content: string;
}): MemoryFile {
  return {
    id: file.id,
    filename: file.filename,
    category: file.category,
    uploadDate: file.upload_date,
    uploadedBy: file.uploaded_by ?? undefined,
    status: file.status as MemoryFile["status"],
    sizeLabel: file.size_label,
    summary: file.summary,
    downloadContent: file.download_content,
  };
}

function normalizeApi(api: {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  status: string;
  authentication: string;
  description: string;
  latency_ms: number;
  last_checked_at: string;
}): ApiDefinition {
  return {
    id: api.id,
    name: api.name,
    endpoint: api.endpoint,
    method: api.method as ApiDefinition["method"],
    status: api.status as ApiDefinition["status"],
    authentication: api.authentication,
    description: api.description,
    latencyMs: api.latency_ms,
    lastCheckedAt: api.last_checked_at,
  };
}

function normalizeExecution(execution: ChatReplyPayload["execution"]): MasterAgentExecution {
  return {
    id: execution.id,
    goal: execution.goal,
    launchedAt: execution.launched_at,
    confidenceScore: execution.confidence_score,
    reasoning: execution.reasoning,
    nextAction: execution.next_action,
    stages: execution.stages,
    timeline: execution.timeline,
  };
}

function normalizeSupplier(supplier: SupplierPayload): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    city: supplier.city,
    specialty: supplier.specialty,
    contact: supplier.contact,
    leadTimeDays: supplier.lead_time_days,
    onTimeRate: supplier.on_time_rate,
    fulfillmentRate: supplier.fulfillment_rate,
  };
}

function normalizeConfidence(value?: number) {
  if (value == null) {
    return undefined;
  }
  return value > 1 ? value / 100 : value;
}

function normalizeSource(source: ChatReplyPayload["sources"][number]): ChatSource {
  return {
    id: source.id,
    filename: source.filename,
    category: source.category,
    excerpt: source.excerpt,
    score: source.score,
    strategy: source.strategy,
  };
}

function normalizeTracePayload(trace?: ProcurementTracePayload | null): ProcurementOrder["trace"] {
  if (!trace) {
    return undefined;
  }

  return {
    approvalId: trace.approval_id ?? undefined,
    approvalHistoryId: trace.approval_history_id ?? undefined,
    auditId: trace.audit_id ?? undefined,
    assignedRole: trace.assigned_role ?? undefined,
    lastAction: trace.last_action ?? undefined,
    lastActionAt: trace.last_action_at ?? undefined,
  };
}

function normalizeProcurementOrder(order: ProcurementOrderPayload): ProcurementOrder {
  return {
    id: order.id,
    medicineId: order.medicine_id,
    medicineName: order.medicine_name,
    supplierId: order.supplier_id,
    supplierName: order.supplier_name,
    quantity: order.quantity,
    unitCost: order.unit_cost,
    totalCost: order.total_cost,
    status: order.status as ProcurementOrder["status"],
    requestedBy: order.requested_by,
    createdAt: order.created_at,
    eta: order.eta,
    priority: order.priority as ProcurementOrder["priority"],
    trace: normalizeTracePayload(order.trace),
  };
}

function normalizeAuditLog(log: AuditLogPayload): AuditLogItem {
  return {
    id: log.id,
    time: log.time,
    agent: log.agent,
    action: log.action,
    status: log.status as AuditLogItem["status"],
    user: log.user,
    detail: log.detail,
    tool: log.tool ?? undefined,
    entityType: log.entity_type ?? undefined,
    entityId: log.entity_id ?? undefined,
  };
}

function normalizeAction(action: ChatReplyPayload["actions"][number]): ChatAction {
  const signature = `${action.label} ${action.prompt}`.trim().toLowerCase();

  if ((action.kind ?? "prompt") === "prompt") {
    if (signature.includes("generate procurement")) {
      return {
        id: action.id,
        label: action.label,
        prompt: action.prompt,
        tone: action.tone ?? "secondary",
        kind: "generate-procurement",
      };
    }

    if (signature.includes("track approval")) {
      return {
        id: action.id,
        label: action.label,
        prompt: action.prompt,
        tone: action.tone ?? "secondary",
        kind: "navigate-view",
        view: "approvals",
      };
    }

    if (signature.includes("review orders")) {
      return {
        id: action.id,
        label: action.label,
        prompt: action.prompt,
        tone: action.tone ?? "secondary",
        kind: "navigate-view",
        view: "procurement",
      };
    }

    if (signature.includes("open audit")) {
      return {
        id: action.id,
        label: action.label,
        prompt: action.prompt,
        tone: action.tone ?? "secondary",
        kind: "navigate-view",
        view: "audit",
      };
    }
  }

  return {
    id: action.id,
    label: action.label,
    prompt: action.prompt,
    tone: action.tone ?? "secondary",
    kind: (action.kind ?? "prompt") as ChatAction["kind"],
  };
}

function buildReplyTrace(reply: ChatReplyPayload): OperationalTraceReference[] {
  if (!reply.audit_id) {
    return [];
  }

  return [
    {
      kind: "audit",
      id: reply.audit_id,
      label: "Workspace Audit Trail",
      description: "This MediIntel AI response was recorded in the operational audit log.",
      view: "audit",
    },
  ];
}

function normalizeAssistantReply(reply: ChatReplyPayload): ChatMessage {
  return {
    id: reply.id,
    role: "assistant",
    content: reply.summary.narrative,
    createdAt: reply.created_at,
    confidence: normalizeConfidence(reply.confidence),
    reasoning: reply.reasoning,
    headline: reply.summary.headline,
    runtimeMode: reply.runtime_mode,
    contributions: reply.contributions,
    metrics: reply.summary.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      tone: metric.tone as "sky" | "amber" | "emerald" | "rose",
    })),
    table: reply.tables[0]
      ? {
          title: reply.tables[0].title,
          columns: reply.tables[0].columns,
          rows: reply.tables[0].rows,
        }
      : undefined,
    followUpActions: reply.actions.map((action) => normalizeAction(action)),
    sources: (reply.sources ?? []).map((source) => normalizeSource(source)),
    operationalTrace: buildReplyTrace(reply),
    warnings: reply.warnings ?? [],
  };
}

function normalizeHistoryMessage(item: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  confidence?: number | null;
  reasoning?: string | null;
  structured_payload?: ChatReplyPayload | null;
}): ChatMessage {
  if (item.role === "assistant" && item.structured_payload) {
    return normalizeAssistantReply(item.structured_payload);
  }

  return {
    id: item.id,
    role: item.role as ChatMessage["role"],
    content: item.content,
    createdAt: item.created_at,
    confidence: normalizeConfidence(item.confidence ?? undefined),
    reasoning: item.reasoning ?? undefined,
  };
}

export async function loadDataset(userName: string, role: string): Promise<MediIntelDataset> {
  const empty = createEmptyDataset(userName, role);
  const [digitalTwin, suppliers, inventory, forecasts, orders, alerts, files, apis, chatHistory] = await Promise.all([
    readJson<{
      hospital: {
        name: string;
        tagline: string;
        location: string;
        mission: string;
        beds: number;
        departments: string[];
      };
    }>("/digital-twin"),
    readJson<SupplierPayload[]>("/suppliers"),
    readJson<Array<Record<string, unknown>>>("/inventory"),
    readJson<Array<Record<string, unknown>>>("/forecast"),
    readJson<Array<Record<string, unknown>>>("/orders"),
    readJson<Array<Record<string, unknown>>>("/alerts"),
    readJson<Array<Record<string, unknown>>>("/knowledge"),
    readJson<Array<Record<string, unknown>>>("/apis"),
    readJson<{ history: Array<{ id: string; role: string; content: string; created_at: string; confidence?: number; reasoning?: string; structured_payload?: ChatReplyPayload | null }> }>("/chat/history"),
  ]);

  let audit: AuditLogPayload[] = [];
  try {
    audit = await readJson<AuditLogPayload[]>("/audit");
  } catch {
    audit = [];
  }

  return {
    ...empty,
    hospital: {
      name: digitalTwin.hospital.name,
      tagline: digitalTwin.hospital.tagline,
      location: digitalTwin.hospital.location,
      mission: digitalTwin.hospital.mission,
      beds: digitalTwin.hospital.beds,
      departments: digitalTwin.hospital.departments,
    },
    suppliers: suppliers.map((supplier) => normalizeSupplier(supplier)),
    inventory: inventory.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      category: String(item.category),
      unit: String(item.unit),
      supplierId: String(item.supplier_id),
      stockOnHand: Number(item.stock_on_hand),
      reorderLevel: Number(item.reorder_level),
      dailyConsumption: Number(item.daily_consumption),
      daysRemaining: Number(item.days_remaining),
      expiryDate: String(item.expiry_date),
      unitCost: Number(item.unit_cost),
      status: String(item.status) as MediIntelDataset["inventory"][number]["status"],
      shortageRisk: Number(item.shortage_risk),
    })),
    forecasts: forecasts.map((point) => ({
      id: String(point.id),
      month: String(point.month),
      consumption: Number(point.consumption),
      forecast: Number(point.forecast),
      shortageIndex: Number(point.shortage_index),
    })),
    orders: orders.map((order) => normalizeProcurementOrder(order as ProcurementOrderPayload)),
    alerts: alerts.map((alert) => ({
      id: String(alert.id),
      title: String(alert.title),
      description: String(alert.description),
      severity: String(alert.severity) as MediIntelDataset["alerts"][number]["severity"],
      source: String(alert.source) as MediIntelDataset["alerts"][number]["source"],
      time: String(alert.time),
      status: String(alert.status) as MediIntelDataset["alerts"][number]["status"],
      medicineName: alert.medicine_name ? String(alert.medicine_name) : undefined,
    })),
    files: files.map((file) => normalizeFile(file as Parameters<typeof normalizeFile>[0])),
    apis: apis.map((api) => normalizeApi(api as Parameters<typeof normalizeApi>[0])),
    auditLogs: audit.map((entry) => normalizeAuditLog(entry)),
    chatHistory: chatHistory.history.map((message) => normalizeHistoryMessage(message)),
  };
}

export async function launchMasterAgent(goal: string): Promise<MasterAgentExecution> {
  const execution = await readJson<ChatReplyPayload["execution"] | {
    id: string;
    goal: string;
    launched_at: string;
    confidence_score: number;
    reasoning: string;
    next_action: string;
    stages: MasterAgentExecution["stages"];
    timeline: MasterAgentExecution["timeline"];
  }>("/master-agent/launch", {
    method: "POST",
    body: JSON.stringify({ goal }),
  });

  return normalizeExecution(execution as ChatReplyPayload["execution"]);
}

export async function sendChatMessage(message: string): Promise<{ reply: ChatMessage; history: ChatMessage[]; execution: MasterAgentExecution }> {
  const response = await readJson<{
    reply: ChatReplyPayload;
    history: Array<{ id: string; role: string; content: string; created_at: string; confidence?: number; reasoning?: string; structured_payload?: ChatReplyPayload | null }>;
  }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  return {
    reply: normalizeAssistantReply(response.reply),
    history: response.history.map((item) => normalizeHistoryMessage(item)),
    execution: normalizeExecution(response.reply.execution),
  };
}

export async function createMemoryFile(payload: UploadFilePayload): Promise<MemoryFile> {
  const body = payload.file
    ? (() => {
        const formData = new FormData();
        formData.set("file", payload.file);
        formData.set("category", payload.category);
        return formData;
      })()
    : JSON.stringify({
        filename: payload.filename,
        category: payload.category,
        size_label: payload.sizeLabel,
        content: payload.content,
      });

  const response = await readJson<{ message: string; file: Parameters<typeof normalizeFile>[0] }>("/upload", {
    method: "POST",
    body,
  });

  return normalizeFile(response.file);
}

export async function deleteMemoryFile(fileId: string): Promise<string> {
  await readJson<{ message: string }>(`/files/${fileId}`, {
    method: "DELETE",
  });

  return fileId;
}

export async function downloadMemoryFile(fileId: string): Promise<{ filename: string; blob: Blob }> {
  const response = await readBlob(`/knowledge/${fileId}/download`, {
    method: "GET",
  });
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    filename: match?.[1] ?? `${fileId}.txt`,
    blob: await response.blob(),
  };
}

export async function resolveAlert(alertId: string): Promise<string> {
  await readJson<{ id: string }>(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "resolved" }),
  });
  return alertId;
}

export async function createApiDefinition(payload: CreateApiPayload): Promise<ApiDefinition> {
  const response = await readJson<Parameters<typeof normalizeApi>[0]>("/apis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeApi(response);
}

export async function deleteApiDefinition(apiId: string): Promise<string> {
  await readJson<{ message: string }>(`/apis/${apiId}`, {
    method: "DELETE",
  });
  return apiId;
}

export async function generateProcurementRequest(payload?: GenerateProcurementPayload): Promise<ProcurementOrder> {
  const response = await readJson<ProcurementOrderPayload>("/procurement", {
    method: "POST",
    body: JSON.stringify({
      medicine_id: payload?.medicineId,
      quantity: payload?.quantity,
      note: payload?.note,
    }),
  });

  return normalizeProcurementOrder(response);
}

export async function updateOrderReviewStatus(orderId: string, status: ReviewOrderStatus): Promise<ProcurementOrder> {
  const endpoint = status === "approved" ? "/approve" : status === "rejected" ? "/reject" : "/modify";
  const response = await readJson<ProcurementOrderPayload>(endpoint, {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });

  return normalizeProcurementOrder(response);
}

export { createEmptyDataset };
