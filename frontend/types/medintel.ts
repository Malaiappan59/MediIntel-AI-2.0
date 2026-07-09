export type InventoryStatus = "healthy" | "watch" | "critical";
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertState = "open" | "resolved";
export type OrderStatus =
  | "pending-approval"
  | "approved"
  | "in-transit"
  | "received"
  | "escalated"
  | "rejected"
  | "modified";
export type FileStatus = "indexed" | "processing" | "needs-review";
export type ApiStatus = "healthy" | "degraded" | "offline";
export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ChatRole = "assistant" | "user";
export type AgentStageStatus = "idle" | "running" | "completed" | "attention";
export type AuditLogStatus = "completed" | "pending" | "running" | "attention" | "rejected" | "modified";
export type OperationsView = "procurement" | "approvals" | "audit" | "apis";
export type ChatActionKind = "prompt" | "download-report" | "download-purchase-order" | "generate-procurement" | "navigate-view";
export type ChatActionTone = "primary" | "secondary";

export type HospitalProfile = {
  name: string;
  tagline: string;
  location: string;
  mission: string;
  beds: number;
  departments: string[];
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  supplierId: string;
  stockOnHand: number;
  reorderLevel: number;
  dailyConsumption: number;
  daysRemaining: number;
  expiryDate: string;
  unitCost: number;
  status: InventoryStatus;
  shortageRisk: number;
};

export type Supplier = {
  id: string;
  name: string;
  city: string;
  specialty: string;
  contact: string;
  leadTimeDays: number;
  onTimeRate: number;
  fulfillmentRate: number;
};

export type ForecastPoint = {
  id: string;
  month: string;
  consumption: number;
  forecast: number;
  shortageIndex: number;
};

export type ProcurementTrace = {
  approvalId?: string;
  approvalHistoryId?: string;
  auditId?: string;
  assignedRole?: string;
  lastAction?: string;
  lastActionAt?: string;
};

export type ProcurementOrder = {
  id: string;
  medicineId: string;
  medicineName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: OrderStatus;
  requestedBy: string;
  createdAt: string;
  eta: string;
  priority: AlertSeverity;
  trace?: ProcurementTrace;
};

export type AlertItem = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  source: "Inventory" | "Forecast" | "Procurement" | "Compliance" | "Agent";
  time: string;
  status: AlertState;
  medicineName?: string;
};

export type MemoryFile = {
  id: string;
  filename: string;
  category: string;
  uploadDate: string;
  uploadedBy?: string;
  status: FileStatus;
  sizeLabel: string;
  summary: string;
  downloadContent: string;
};

export type ApiDefinition = {
  id: string;
  name: string;
  endpoint: string;
  method: ApiMethod;
  status: ApiStatus;
  authentication: string;
  description: string;
  latencyMs: number;
  lastCheckedAt: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  tone: "sky" | "amber" | "emerald" | "rose";
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  category: string;
};

export type ChatMetric = {
  label: string;
  value: string;
  tone: "sky" | "amber" | "emerald" | "rose";
};

export type ChatSource = {
  id: string;
  filename: string;
  category: string;
  excerpt: string;
  score?: number;
  strategy?: string;
};

export type OperationalTraceReference = {
  kind: "order" | "approval" | "audit";
  id: string;
  label: string;
  description: string;
  view: OperationsView;
};

export type AgentContribution = {
  id: string;
  agent: string;
  summary: string;
  detail: string;
  status: Extract<AgentStageStatus, "completed" | "running" | "attention">;
};

export type ChatTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type ChatTable = {
  title: string;
  columns: ChatTableColumn[];
  rows: Array<Record<string, string | number>>;
};

export type ChatAction = {
  id: string;
  label: string;
  prompt: string;
  kind?: ChatActionKind;
  tone?: ChatActionTone;
  view?: OperationsView;
  traceId?: string;
  traceKind?: OperationalTraceReference["kind"];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  confidence?: number;
  reasoning?: string;
  headline?: string;
  runtimeMode?: "live" | "degraded";
  contributions?: AgentContribution[];
  table?: ChatTable;
  followUpActions?: ChatAction[];
  metrics?: ChatMetric[];
  sources?: ChatSource[];
  operationalTrace?: OperationalTraceReference[];
  warnings?: string[];
};

export type AgentStage = {
  id: string;
  title: string;
  subtitle: string;
  status: AgentStageStatus;
  summary: string;
};

export type AgentTimelineEvent = {
  id: string;
  title: string;
  detail: string;
  status: AgentStageStatus;
  timestamp: string;
};

export type MasterAgentExecution = {
  id: string;
  goal: string;
  launchedAt: string;
  confidenceScore: number;
  reasoning: string;
  nextAction: string;
  stages: AgentStage[];
  timeline: AgentTimelineEvent[];
};

export type AuditLogItem = {
  id: string;
  time: string;
  agent: string;
  action: string;
  status: AuditLogStatus;
  user: string;
  detail: string;
  tool?: string;
  entityType?: string;
  entityId?: string;
};

export type SettingsState = {
  general: {
    workspaceName: string;
    timezone: string;
    refreshInterval: string;
  };
  theme: {
    mode: "light" | "system";
    accent: "azure";
    density: "comfortable" | "compact";
  };
  hospital: {
    facilityName: string;
    city: string;
    escalationEmail: string;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    criticalOnly: boolean;
  };
  ai: {
    autopilotEnabled: boolean;
    confidenceThreshold: number;
    ragEnabled: boolean;
  };
  user: {
    displayName: string;
    role: string;
    team: string;
  };
};

export type MediIntelDataset = {
  hospital: HospitalProfile;
  inventory: InventoryItem[];
  suppliers: Supplier[];
  forecasts: ForecastPoint[];
  orders: ProcurementOrder[];
  alerts: AlertItem[];
  files: MemoryFile[];
  apis: ApiDefinition[];
  chatHistory: ChatMessage[];
  auditLogs: AuditLogItem[];
  settings: SettingsState;
};
