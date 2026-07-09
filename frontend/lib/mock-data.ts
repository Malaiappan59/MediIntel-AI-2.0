import referenceData from "@/assets/reference-data.json";
import { createAuditLogEntry, getDefaultChatActions, getDisplayName } from "@/lib/experience";
import type {
  ActivityItem,
  AgentStage,
  AlertItem,
  AlertSeverity,
  AuditLogItem,
  ApiDefinition,
  DashboardMetric,
  ForecastPoint,
  InventoryItem,
  MasterAgentExecution,
  MediIntelDataset,
  MemoryFile,
  ProcurementOrder,
  SettingsState,
  Supplier,
} from "@/types/medintel";

type ReferenceMedicine = {
  name: string;
  category: string;
  unit: string;
};

type ReferenceSupplier = {
  name: string;
  city: string;
  specialty: string;
  contact: string;
};

const { hospital } = referenceData;
const medicines = referenceData.medicines as ReferenceMedicine[];
const supplierSeeds = referenceData.suppliers as ReferenceSupplier[];

function formatDate(date: Date) {
  return date.toISOString();
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function subtractHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return formatDate(date);
}

export function createSuppliers(): Supplier[] {
  return supplierSeeds.map((supplier, index) => ({
    id: `SUP-${String(index + 1).padStart(3, "0")}`,
    name: supplier.name,
    city: supplier.city,
    specialty: supplier.specialty,
    contact: supplier.contact,
    leadTimeDays: 2 + (index % 5) + Math.floor(index / 2),
    onTimeRate: 88 + (index % 6) * 2,
    fulfillmentRate: 90 + (index % 5) * 2,
  }));
}

export function createInventory(suppliers: Supplier[]): InventoryItem[] {
  return medicines.map((medicine, index) => {
    const supplier = suppliers[index % suppliers.length];
    const stockOnHand = 120 + ((index * 37) % 780);
    const reorderLevel = 80 + ((index * 19) % 210);
    const dailyConsumption = 8 + (index % 12) * 3;
    const daysRemaining = Math.max(2, Math.floor(stockOnHand / dailyConsumption));
    const expiryOffset = 45 + ((index * 17) % 320);
    const shortageRisk = Math.min(98, 18 + (index % 11) * 7 + (daysRemaining < 10 ? 22 : 0));

    let status: InventoryItem["status"] = "healthy";
    if (daysRemaining < 8 || shortageRisk > 84) {
      status = "critical";
    } else if (daysRemaining < 16 || shortageRisk > 62) {
      status = "watch";
    }

    return {
      id: `MED-${String(index + 1).padStart(3, "0")}`,
      name: medicine.name,
      category: medicine.category,
      unit: medicine.unit,
      supplierId: supplier.id,
      stockOnHand,
      reorderLevel,
      dailyConsumption,
      daysRemaining,
      expiryDate: addDays(expiryOffset),
      unitCost: 12 + (index % 15) * 8,
      status,
      shortageRisk,
    };
  });
}

export function createForecasts(): ForecastPoint[] {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - index));

    return {
      id: `FC-${index + 1}`,
      month: formatter.format(date),
      consumption: 6200 + index * 210 + (index % 3) * 130,
      forecast: 6400 + index * 225 + ((index + 1) % 4) * 150,
      shortageIndex: 38 + (index % 5) * 6 + (index > 8 ? 8 : 0),
    };
  });
}

export function createOrders(inventory: InventoryItem[], suppliers: Supplier[], requestedBy: string): ProcurementOrder[] {
  const statuses: ProcurementOrder["status"][] = [
    "pending-approval",
    "approved",
    "in-transit",
    "received",
    "escalated",
  ];
  const severities: AlertSeverity[] = ["critical", "warning", "info"];

  return Array.from({ length: 50 }, (_, index) => {
    const medicine = inventory[index % inventory.length];
    const supplier = suppliers[index % suppliers.length];
    const quantity = 180 + (index % 8) * 70;
    const unitCost = medicine.unitCost + (index % 4) * 3;
    const status = statuses[index % statuses.length];
    const createdHoursAgo = 6 + index * 7;

    return {
      id: `PO-${String(index + 1).padStart(4, "0")}`,
      medicineId: medicine.id,
      medicineName: medicine.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      status,
      requestedBy: getDisplayName(requestedBy),
      createdAt: subtractHours(createdHoursAgo),
      eta: addDays(1 + (index % 9)),
      priority: severities[index % severities.length],
    };
  });
}

export function createAlerts(inventory: InventoryItem[], orders: ProcurementOrder[]): AlertItem[] {
  return Array.from({ length: 30 }, (_, index) => {
    const medicine = inventory[(index * 3) % inventory.length];
    const order = orders[index % orders.length];
    const severity: AlertItem["severity"] = index < 10 ? "critical" : index < 20 ? "warning" : "info";
    const source = ["Inventory", "Forecast", "Procurement", "Compliance", "Agent"][index % 5] as AlertItem["source"];

    return {
      id: `ALT-${String(index + 1).padStart(3, "0")}`,
      title:
        source === "Procurement"
          ? `Approval delay for ${order.medicineName}`
          : source === "Compliance"
            ? `${medicine.name} nearing expiry threshold`
            : `${medicine.name} requires attention`,
      description:
        source === "Forecast"
          ? `${medicine.name} demand is projected to exceed available stock within ${medicine.daysRemaining} days.`
          : source === "Agent"
            ? `Master Agent flagged ${medicine.name} for immediate review due to multi-signal shortage risk.`
            : `${medicine.name} is below the recommended operational buffer for ${hospital.name}.`,
      severity,
      source,
      time: subtractHours(index * 3 + 1),
      status: index % 7 === 0 ? "resolved" : "open",
      medicineName: medicine.name,
    };
  });
}

export function createFiles(userName: string): MemoryFile[] {
  return referenceData.policyFiles.map((file, index) => ({
    id: `FILE-${String(index + 1).padStart(3, "0")}`,
    filename: file.filename,
    category: file.category,
    uploadDate: subtractHours(24 * (index + 2)),
    uploadedBy: getDisplayName(userName),
    status: index === 2 ? "processing" : index === 4 ? "needs-review" : "indexed",
    sizeLabel: `${2.1 + index * 0.8} MB`,
    summary: `Knowledge source prepared for ${file.category.toLowerCase()} retrieval and audit workflows.`,
    downloadContent: `${file.filename}\n\nMock reference content for MediIntel knowledge retrieval.`,
  }));
}

export function createApis(): ApiDefinition[] {
  return referenceData.apiDefinitions.map((definition, index) => ({
    id: `API-${String(index + 1).padStart(3, "0")}`,
    name: definition.name,
    endpoint: definition.endpoint,
    method: definition.method as ApiDefinition["method"],
    authentication: definition.authentication,
    description: definition.description,
    status: index === 4 ? "degraded" : "healthy",
    latencyMs: 84 + index * 22,
    lastCheckedAt: subtractHours(index + 1),
  }));
}

export function createChatHistory(userName: string) {
  return [
    {
      id: "CHAT-001",
      role: "assistant" as const,
      headline: `Hello ${getDisplayName(userName)} \u{1F44B}`,
      content:
        "I'm MediIntel AI. I continuously monitor inventory, predict shortages, recommend actions, generate procurement, and validate operational decisions. How can I help today?",
      createdAt: subtractHours(1),
      confidence: 0.96,
      reasoning: hospital.mission,
      followUpActions: getDefaultChatActions(),
    },
  ];
}

export function createSettings(userName: string, role: string): SettingsState {
  return {
    general: {
      workspaceName: "MediIntel AI Operations Center",
      timezone: "Asia/Kolkata",
      refreshInterval: "15 seconds",
    },
    theme: {
      mode: "light",
      accent: "azure",
      density: "comfortable",
    },
    hospital: {
      facilityName: hospital.name,
      city: "Chennai",
      escalationEmail: "commandcenter@citycarehospital.org",
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
      displayName: getDisplayName(userName),
      role,
      team: "Operations Excellence",
    },
  };
}

export function createAuditLogs(
  userName: string,
  inventory: InventoryItem[],
  orders: ProcurementOrder[],
  alerts: AlertItem[],
  files: MemoryFile[],
): AuditLogItem[] {
  const displayName = getDisplayName(userName);

  return [
    createAuditLogEntry({
      agent: "Master Agent",
      action: "Mission Alignment",
      status: "completed",
      user: displayName,
      detail: "Current mission aligned to medicine-shortage prevention for hospital operations.",
      time: subtractHours(1),
    }),
    createAuditLogEntry({
      agent: "Operations Agent",
      action: "Inventory Analysis",
      status: "completed",
      user: displayName,
      detail: `${inventory.length} medicines scanned with ${inventory.filter((item) => item.status === "critical").length} critical items flagged.`,
      time: subtractHours(2),
    }),
    createAuditLogEntry({
      agent: "Intelligence Agent",
      action: "Shortage Forecast",
      status: "completed",
      user: displayName,
      detail: `${inventory[0]?.name ?? "Critical stock"} elevated into the active watchlist for the next 7 days.`,
      time: subtractHours(3),
    }),
    createAuditLogEntry({
      agent: "Decision Agent",
      action: "Supplier Recommendation",
      status: "completed",
      user: displayName,
      detail: `${orders[0]?.supplierName ?? "Primary supplier"} selected for the most urgent replenishment scenario.`,
      time: subtractHours(4),
    }),
    createAuditLogEntry({
      agent: "Action Agent",
      action: "Procurement Workflow",
      status: "pending",
      user: displayName,
      detail: `${orders.filter((order) => order.status === "pending-approval").length} purchase requests are ready for approval routing.`,
      time: subtractHours(5),
    }),
    createAuditLogEntry({
      agent: "Knowledge Repository",
      action: "Document Indexing",
      status: "running",
      user: displayName,
      detail: `${files.filter((file) => file.status === "processing").length} knowledge files are still being indexed for retrieval.`,
      time: subtractHours(6),
    }),
    createAuditLogEntry({
      agent: "Alert Monitor",
      action: "Critical Alert Escalation",
      status: "attention",
      user: displayName,
      detail: `${alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length} critical alerts remain unresolved.`,
      time: subtractHours(7),
    }),
  ];
}

export function createDataset(userName = "Operations Lead", role = "Admin"): MediIntelDataset {
  const suppliers = createSuppliers();
  const inventory = createInventory(suppliers);
  const forecasts = createForecasts();
  const orders = createOrders(inventory, suppliers, userName);
  const alerts = createAlerts(inventory, orders);
  const files = createFiles(userName);
  const apis = createApis();
  const auditLogs = createAuditLogs(userName, inventory, orders, alerts, files);

  return {
    hospital,
    suppliers,
    inventory,
    forecasts,
    orders,
    alerts,
    files,
    apis,
    chatHistory: createChatHistory(userName),
    auditLogs,
    settings: createSettings(userName, role),
  };
}

export function buildDashboardMetrics(dataset: MediIntelDataset): DashboardMetric[] {
  const criticalMedicines = dataset.inventory.filter((item) => item.status === "critical").length;
  const predictedShortages = dataset.inventory.filter((item) => item.shortageRisk > 78).length;
  const pendingApprovals = dataset.orders.filter((order) => order.status === "pending-approval").length;
  const healthScore = Math.max(72, 98 - criticalMedicines / 2 - predictedShortages / 4);

  return [
    { label: "Hospital Health", value: `${healthScore}%`, delta: "+3.4% vs last week", tone: "sky" },
    { label: "Critical Medicines", value: String(criticalMedicines), delta: "-5 since yesterday", tone: "rose" },
    { label: "Predicted Shortages", value: String(predictedShortages), delta: "6 require action today", tone: "amber" },
    { label: "Pending Approvals", value: String(pendingApprovals), delta: "2 escalated to admin", tone: "emerald" },
  ];
}

export function buildProcurementActivity(orders: ProcurementOrder[]): ActivityItem[] {
  return orders.slice(0, 6).map((order) => ({
    id: order.id,
    title: `${order.medicineName} with ${order.supplierName}`,
    detail: `${order.quantity} units | ${order.status.replace("-", " ")} | Rs ${order.totalCost.toLocaleString("en-IN")}`,
    timestamp: order.createdAt,
    category: "Procurement",
  }));
}

export function createMasterAgentExecution(dataset: MediIntelDataset): MasterAgentExecution {
  const mostCritical = dataset.inventory
    .filter((item) => item.status !== "healthy")
    .sort((left, right) => right.shortageRisk - left.shortageRisk)
    .slice(0, 3);

  const stages: AgentStage[] = [
    {
      id: "operations",
      title: "Operations Agent",
      subtitle: "Inventory, supplier status, procurement",
      status: "completed",
      summary: `Reviewed ${dataset.inventory.length} medicines, ${dataset.suppliers.length} suppliers, and ${dataset.orders.length} active procurement requests.`,
    },
    {
      id: "intelligence",
      title: "Intelligence Agent",
      subtitle: "Forecast, expiry, demand, risk",
      status: "completed",
      summary: `${mostCritical[0]?.name ?? "Critical stock"} and ${mostCritical[1]?.name ?? "secondary stock"} show the strongest shortage signals over the next 10 days.`,
    },
    {
      id: "decision",
      title: "Decision Agent",
      subtitle: "Scenario, cost, and impact analysis",
      status: "running",
      summary: "Comparing expedited procurement versus inter-branch rebalancing to protect ICU and oncology continuity.",
    },
    {
      id: "action",
      title: "Action Agent",
      subtitle: "Execution, notifications, tracking",
      status: "attention",
      summary: "Pending approval routing for high-priority requisitions and escalation notices.",
    },
  ];

  return {
    id: "MA-001",
    goal: "Prevent medicine shortages before they impact patient care.",
    launchedAt: formatDate(new Date()),
    confidenceScore: 91,
    reasoning: `Cross-signal analysis indicates elevated risk in ${mostCritical.map((item) => item.name).join(", ")} due to demand acceleration, low buffer stock, and lead-time sensitivity.`,
    nextAction: "Approve expedited procurement for the top three risk items and notify pharmacy leadership.",
    stages,
    timeline: [
      {
        id: "TL-001",
        title: "Goal received",
        detail: "Master Agent accepted the active mission and aligned supporting agents.",
        status: "completed",
        timestamp: subtractHours(0),
      },
      {
        id: "TL-002",
        title: "Operations scan completed",
        detail: "Inventory and supplier health synchronized into a shared operational picture.",
        status: "completed",
        timestamp: subtractHours(0),
      },
      {
        id: "TL-003",
        title: "Risk patterns identified",
        detail: "Demand spikes and procurement lag were correlated against current medicine buffers.",
        status: "running",
        timestamp: subtractHours(0),
      },
      {
        id: "TL-004",
        title: "Execution plan pending approval",
        detail: "Escalation path assembled for procurement and notification workflows.",
        status: "attention",
        timestamp: subtractHours(0),
      },
    ],
  };
}
