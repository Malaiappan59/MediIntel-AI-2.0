"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  CheckCheck,
  ClipboardCheck,
  Database,
  History,
  Link2,
  Loader2,
  PlusCircle,
  Search,
  ShoppingCart,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { OrderFocusPanel } from "@/components/operations/order-focus-panel";
import { ProcurementLaunchpad } from "@/components/operations/procurement-launchpad";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAppData } from "@/hooks/use-app-data";
import { useAuth } from "@/hooks/use-auth";
import { buildAlertsUrl, buildOperationsUrl, formatCurrency, formatDateLabel, formatDateTime } from "@/lib/experience";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ApiDefinition, AuditLogItem, InventoryItem, OperationsView, ProcurementOrder } from "@/types/medintel";

type ReviewOrderStatus = Extract<ProcurementOrder["status"], "approved" | "rejected" | "modified">;
type ProcurementSortOption = "recent" | "eta" | "cost" | "priority";
type ApprovalSortOption = "priority" | "recent" | "eta" | "cost";
type AuditSortOption = "recent" | "oldest" | "status";
type StatusTone = "sky" | "amber" | "rose" | "emerald" | "slate";

const PROCUREMENT_PAGE_SIZE = 7;
const APPROVAL_PAGE_SIZE = 7;
const AUDIT_PAGE_SIZE = 8;

const viewMeta: Record<
  OperationsView,
  {
    hash: string;
    eyebrow: string;
    title: string;
    description: string;
    actionLabel?: string;
  }
> = {
  procurement: {
    hash: "#procurement",
    eyebrow: "Procurement",
    title: "AI-generated procurement workspace",
    description: "Review the live procurement pipeline, supplier timing, and cost-sensitive replenishment generated from current operational risk.",
    actionLabel: "Generate Purchase Request",
  },
  approvals: {
    hash: "#approvals",
    eyebrow: "Approvals",
    title: "Approval queue for procurement decisions",
    description: "Approve, reject, or modify AI-generated purchase requests with full traceability and current operational context.",
  },
  audit: {
    hash: "#audit",
    eyebrow: "Audit Logs",
    title: "Operational audit trail",
    description: "Inspect time-stamped AI actions, user interventions, and workflow outcomes across the MediIntel workspace.",
  },
  apis: {
    hash: "#apis",
    eyebrow: "API Registry",
    title: "Integration services and endpoint governance",
    description: "Maintain the enterprise-ready API registry while preserving the existing integration management functionality.",
  },
};

const viewTabs: Array<{ key: OperationsView; label: string; description: string; icon: LucideIcon }> = [
  {
    key: "procurement",
    label: "Procurement",
    description: "Generated requests, supplier ETA, and replenishment execution.",
    icon: ShoppingCart,
  },
  {
    key: "approvals",
    label: "Approvals",
    description: "Decision queue for approve, reject, and modify actions.",
    icon: ClipboardCheck,
  },
  {
    key: "audit",
    label: "Audit Logs",
    description: "Trace every AI action, reviewer intervention, and outcome.",
    icon: History,
  },
  {
    key: "apis",
    label: "API Registry",
    description: "Mock integrations and ERP-ready service governance.",
    icon: Link2,
  },
];

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function formatStatusLabel(value: string) {
  return value.replace(/-/g, " ");
}

function getPriorityRank(priority: ProcurementOrder["priority"]) {
  if (priority === "critical") {
    return 3;
  }

  if (priority === "warning") {
    return 2;
  }

  return 1;
}

function getAuditStatusRank(status: AuditLogItem["status"]) {
  if (status === "attention") {
    return 6;
  }

  if (status === "rejected") {
    return 5;
  }

  if (status === "modified") {
    return 4;
  }

  if (status === "running") {
    return 3;
  }

  if (status === "pending") {
    return 2;
  }

  return 1;
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

function getEtaDays(value: string) {
  return Math.max(1, Math.round((new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function calculateRecommendedQuantity(item: InventoryItem) {
  return Math.max(item.reorderLevel * 2 - item.stockOnHand, item.dailyConsumption * 10);
}

function sortOrders(orders: ProcurementOrder[], sort: ProcurementSortOption | ApprovalSortOption) {
  const next = [...orders];

  next.sort((left, right) => {
    if (sort === "eta") {
      return new Date(left.eta).getTime() - new Date(right.eta).getTime();
    }

    if (sort === "cost") {
      return right.totalCost - left.totalCost;
    }

    if (sort === "priority") {
      return getPriorityRank(right.priority) - getPriorityRank(left.priority) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return next;
}

function sortAuditLogs(logs: AuditLogItem[], sort: AuditSortOption) {
  const next = [...logs];

  next.sort((left, right) => {
    if (sort === "oldest") {
      return new Date(left.time).getTime() - new Date(right.time).getTime();
    }

    if (sort === "status") {
      return getAuditStatusRank(right.status) - getAuditStatusRank(left.status) || new Date(right.time).getTime() - new Date(left.time).getTime();
    }

    return new Date(right.time).getTime() - new Date(left.time).getTime();
  });

  return next;
}

function paginate<T>(items: T[], currentPage: number, pageSize: number) {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

function getFocusDescription(order: ProcurementOrder | null, auditLog: AuditLogItem | null) {
  if (order) {
    return `Tracing ${order.id} across procurement, approval, and audit records.`;
  }

  if (auditLog) {
    return `Tracing audit event ${auditLog.id} from ${auditLog.agent}.`;
  }

  return "Tracing the selected operations record from the MediIntel AI workspace.";
}

export default function ToolsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataset, addApi, deleteApi, generateProcurementRequest, updateOrderStatus, updateOrderStatuses } = useAppData();
  const { permissions } = useAuth();
  const [activeView, setActiveView] = useState<OperationsView>("procurement");
  const [launchpadOpen, setLaunchpadOpen] = useState(false);
  const [isGeneratingProcurement, setIsGeneratingProcurement] = useState(false);
  const [procurementDraft, setProcurementDraft] = useState({ medicineId: "", quantity: 0 });
  const [apiQuery, setApiQuery] = useState("");
  const [procurementQuery, setProcurementQuery] = useState("");
  const [procurementStatus, setProcurementStatus] = useState<"all" | ProcurementOrder["status"]>("all");
  const [procurementPriority, setProcurementPriority] = useState<"all" | ProcurementOrder["priority"]>("all");
  const [procurementSort, setProcurementSort] = useState<ProcurementSortOption>("recent");
  const [procurementPage, setProcurementPage] = useState(1);
  const [approvalQuery, setApprovalQuery] = useState("");
  const [approvalPriority, setApprovalPriority] = useState<"all" | ProcurementOrder["priority"]>("all");
  const [approvalOwner, setApprovalOwner] = useState("all");
  const [approvalSort, setApprovalSort] = useState<ApprovalSortOption>("priority");
  const [approvalPage, setApprovalPage] = useState(1);
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditStatus, setAuditStatus] = useState<"all" | AuditLogItem["status"]>("all");
  const [auditAgent, setAuditAgent] = useState("all");
  const [auditSort, setAuditSort] = useState<AuditSortOption>("recent");
  const [auditPage, setAuditPage] = useState(1);
  const [reviewState, setReviewState] = useState<{
    orderId?: string | null;
    status: ReviewOrderStatus;
    bulk?: boolean;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    endpoint: "",
    method: "GET" as ApiDefinition["method"],
    authentication: "Bearer JWT",
    description: "",
  });

  useEffect(() => {
    const syncView = () => {
      const hash = window.location.hash;
      if (hash) {
        const nextView = (Object.keys(viewMeta) as OperationsView[]).find((key) => viewMeta[key].hash === hash) ?? "procurement";
        setActiveView(nextView);
        return;
      }

      const urlSearch = new URLSearchParams(window.location.search);
      if (urlSearch.get("approval")) {
        setActiveView("approvals");
        return;
      }
      if (urlSearch.get("audit")) {
        setActiveView("audit");
        return;
      }
      setActiveView("procurement");
    };

    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  useEffect(() => {
    if (!procurementCandidates.length) {
      setProcurementDraft((current) => (current.medicineId || current.quantity ? { medicineId: "", quantity: 0 } : current));
      return;
    }

    setProcurementDraft((current) => {
      if (procurementCandidates.some((item) => item.id === current.medicineId)) {
        return current;
      }

      const nextItem = procurementCandidates[0];
      return {
        medicineId: nextItem.id,
        quantity: calculateRecommendedQuantity(nextItem),
      };
    });
  }, [procurementCandidates]);

  useEffect(() => {
    setProcurementPage(1);
  }, [procurementQuery, procurementStatus, procurementPriority, procurementSort]);

  useEffect(() => {
    setApprovalPage(1);
  }, [approvalQuery, approvalPriority, approvalOwner, approvalSort]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditQuery, auditStatus, auditAgent, auditSort]);

  const focusedOrderId = searchParams.get("order");
  const focusedApprovalId = searchParams.get("approval");
  const focusedAuditId = searchParams.get("audit");

  const focusedAuditLog = useMemo(
    () => dataset.auditLogs.find((log) => log.id === focusedAuditId) ?? null,
    [dataset.auditLogs, focusedAuditId],
  );

  const focusedOrder = useMemo(
    () =>
      dataset.orders.find((order) => order.id === focusedOrderId) ??
      dataset.orders.find((order) => order.trace?.approvalId === focusedApprovalId) ??
      dataset.orders.find((order) => order.trace?.auditId === focusedAuditId) ??
      (focusedAuditLog?.entityId ? dataset.orders.find((order) => order.id === focusedAuditLog.entityId) : undefined) ??
      null,
    [dataset.orders, focusedApprovalId, focusedAuditId, focusedAuditLog, focusedOrderId],
  );

  const procurementCandidates = useMemo(
    () =>
      [...dataset.inventory].sort(
        (left, right) => right.shortageRisk - left.shortageRisk || left.daysRemaining - right.daysRemaining || left.name.localeCompare(right.name),
      ),
    [dataset.inventory],
  );

  const selectedInventoryItem = useMemo(
    () => procurementCandidates.find((item) => item.id === procurementDraft.medicineId) ?? procurementCandidates[0] ?? null,
    [procurementCandidates, procurementDraft.medicineId],
  );

  const selectedSupplier = useMemo(
    () => (selectedInventoryItem ? dataset.suppliers.find((supplier) => supplier.id === selectedInventoryItem.supplierId) ?? null : null),
    [dataset.suppliers, selectedInventoryItem],
  );

  const recommendedProcurementQuantity = selectedInventoryItem ? calculateRecommendedQuantity(selectedInventoryItem) : 0;
  const estimatedProcurementCost = selectedInventoryItem ? procurementDraft.quantity * selectedInventoryItem.unitCost : 0;

  const pendingApprovals = useMemo(
    () => dataset.orders.filter((order) => order.status === "pending-approval" || order.status === "modified"),
    [dataset.orders],
  );

  const approvalOwners = useMemo(
    () => Array.from(new Set(pendingApprovals.map((order) => order.trace?.assignedRole ?? "Procurement Manager"))).sort(),
    [pendingApprovals],
  );

  const auditAgents = useMemo(() => Array.from(new Set(dataset.auditLogs.map((log) => log.agent))).sort(), [dataset.auditLogs]);

  const canGeneratePurchaseOrders = hasPermission(permissions, "purchase_order.generate");
  const canApprove = hasPermission(permissions, "approval.approve");
  const canReject = hasPermission(permissions, "approval.reject");
  const canManageApis = hasPermission(permissions, "api.manage");

  const filteredApis = useMemo(
    () =>
      dataset.apis.filter((api) => {
        const query = normalizeQuery(apiQuery);
        if (!query) {
          return true;
        }

        return [api.name, api.endpoint, api.description].join(" ").toLowerCase().includes(query);
      }),
    [apiQuery, dataset.apis],
  );

  const filteredProcurementOrders = useMemo(() => {
    const query = normalizeQuery(procurementQuery);

    return sortOrders(
      dataset.orders.filter((order) => {
        if (procurementStatus !== "all" && order.status !== procurementStatus) {
          return false;
        }

        if (procurementPriority !== "all" && order.priority !== procurementPriority) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          order.id,
          order.medicineName,
          order.supplierName,
          order.requestedBy,
          order.trace?.approvalId,
          order.trace?.auditId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
      procurementSort,
    );
  }, [dataset.orders, procurementPriority, procurementQuery, procurementSort, procurementStatus]);

  const filteredApprovalOrders = useMemo(() => {
    const query = normalizeQuery(approvalQuery);

    return sortOrders(
      pendingApprovals.filter((order) => {
        if (approvalPriority !== "all" && order.priority !== approvalPriority) {
          return false;
        }

        const currentOwner = order.trace?.assignedRole ?? "Procurement Manager";
        if (approvalOwner !== "all" && currentOwner !== approvalOwner) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [order.id, order.medicineName, order.supplierName, order.requestedBy, order.trace?.approvalId, order.trace?.auditId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
      approvalSort,
    );
  }, [approvalOwner, approvalPriority, approvalQuery, approvalSort, pendingApprovals]);

  const filteredAuditLogs = useMemo(() => {
    const query = normalizeQuery(auditQuery);

    return sortAuditLogs(
      dataset.auditLogs.filter((log) => {
        if (auditStatus !== "all" && log.status !== auditStatus) {
          return false;
        }

        if (auditAgent !== "all" && log.agent !== auditAgent) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [log.id, log.agent, log.action, log.detail, log.user, log.tool, log.entityType, log.entityId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
      auditSort,
    );
  }, [auditAgent, auditQuery, auditSort, auditStatus, dataset.auditLogs]);

  const procurementTotalPages = Math.max(1, Math.ceil(filteredProcurementOrders.length / PROCUREMENT_PAGE_SIZE));
  const approvalTotalPages = Math.max(1, Math.ceil(filteredApprovalOrders.length / APPROVAL_PAGE_SIZE));
  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE));

  useEffect(() => {
    setProcurementPage((current) => Math.min(current, procurementTotalPages));
  }, [procurementTotalPages]);

  useEffect(() => {
    setApprovalPage((current) => Math.min(current, approvalTotalPages));
  }, [approvalTotalPages]);

  useEffect(() => {
    setAuditPage((current) => Math.min(current, auditTotalPages));
  }, [auditTotalPages]);

  useEffect(() => {
    const validIds = new Set(pendingApprovals.map((order) => order.id));
    setSelectedApprovalIds((current) => current.filter((id) => validIds.has(id)));
  }, [pendingApprovals]);

  useEffect(() => {
    if (activeView !== "procurement" || !focusedOrder) {
      return;
    }

    const focusedIndex = filteredProcurementOrders.findIndex((order) => order.id === focusedOrder.id);
    if (focusedIndex >= 0) {
      setProcurementPage(Math.floor(focusedIndex / PROCUREMENT_PAGE_SIZE) + 1);
    }
  }, [activeView, filteredProcurementOrders, focusedOrder]);

  useEffect(() => {
    if (activeView !== "approvals" || !focusedOrder) {
      return;
    }

    const focusedIndex = filteredApprovalOrders.findIndex((order) => order.id === focusedOrder.id);
    if (focusedIndex >= 0) {
      setApprovalPage(Math.floor(focusedIndex / APPROVAL_PAGE_SIZE) + 1);
    }
  }, [activeView, filteredApprovalOrders, focusedOrder]);

  useEffect(() => {
    if (activeView !== "audit" || !focusedAuditId) {
      return;
    }

    const focusedIndex = filteredAuditLogs.findIndex((log) => log.id === focusedAuditId);
    if (focusedIndex >= 0) {
      setAuditPage(Math.floor(focusedIndex / AUDIT_PAGE_SIZE) + 1);
    }
  }, [activeView, filteredAuditLogs, focusedAuditId]);

  const paginatedProcurementOrders = paginate(filteredProcurementOrders, procurementPage, PROCUREMENT_PAGE_SIZE);
  const paginatedApprovalOrders = paginate(filteredApprovalOrders, approvalPage, APPROVAL_PAGE_SIZE);
  const paginatedAuditLogs = paginate(filteredAuditLogs, auditPage, AUDIT_PAGE_SIZE);

  const relatedAlerts = useMemo(
    () =>
      focusedOrder
        ? [...dataset.alerts]
            .filter((alert) => alert.medicineName === focusedOrder.medicineName && alert.status === "open")
            .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
        : [],
    [dataset.alerts, focusedOrder],
  );

  const relatedAuditLogs = useMemo(() => {
    if (focusedOrder) {
      const logs = dataset.auditLogs.filter(
        (log) =>
          log.id === focusedOrder.trace?.auditId ||
          log.entityId === focusedOrder.id ||
          log.entityId === focusedOrder.trace?.approvalId ||
          log.entityId === focusedOrder.trace?.approvalHistoryId,
      );

      return sortAuditLogs(
        logs.filter((log, index, items) => items.findIndex((candidate) => candidate.id === log.id) === index),
        "recent",
      );
    }

    return focusedAuditLog ? [focusedAuditLog] : [];
  }, [dataset.auditLogs, focusedAuditLog, focusedOrder]);

  const visibleApprovalIds = paginatedApprovalOrders.map((order) => order.id);
  const allVisibleApprovalsSelected = visibleApprovalIds.length > 0 && visibleApprovalIds.every((id) => selectedApprovalIds.includes(id));
  const selectedApprovalOrders = pendingApprovals.filter((order) => selectedApprovalIds.includes(order.id));
  const selectedApprovalSpend = selectedApprovalOrders.reduce((sum, order) => sum + order.totalCost, 0);
  const selectedCriticalApprovalCount = selectedApprovalOrders.filter((order) => order.priority === "critical").length;
  const selectedApprovalOwnerCount = new Set(selectedApprovalOrders.map((order) => order.trace?.assignedRole ?? "Procurement Manager")).size;

  const setView = (view: OperationsView) => {
    window.location.hash = viewMeta[view].hash;
    setActiveView(view);
  };

  const focusReference = (view: OperationsView, trace: { kind: "order" | "approval" | "audit"; id: string }) => {
    router.replace(buildOperationsUrl(view, trace));
    setActiveView(view);
  };

  const focusOrder = (view: OperationsView, order: ProcurementOrder) => {
    if (view === "approvals" && order.trace?.approvalId) {
      focusReference("approvals", { kind: "approval", id: order.trace.approvalId });
      return;
    }

    if (view === "audit" && order.trace?.auditId) {
      focusReference("audit", { kind: "audit", id: order.trace.auditId });
      return;
    }

    focusReference(view, { kind: "order", id: order.id });
  };

  const clearFocus = () => {
    router.replace(`/tools${viewMeta[activeView].hash}`);
  };

  const selectProcurementMedicine = (medicineId: string) => {
    const nextItem = procurementCandidates.find((item) => item.id === medicineId);
    if (!nextItem) {
      return;
    }

    setProcurementDraft({
      medicineId: nextItem.id,
      quantity: calculateRecommendedQuantity(nextItem),
    });
  };

  const updateProcurementQuantity = (value: number) => {
    if (!Number.isFinite(value)) {
      setProcurementDraft((current) => ({ ...current, quantity: 0 }));
      return;
    }

    setProcurementDraft((current) => ({
      ...current,
      quantity: Math.max(0, Math.floor(value)),
    }));
  };

  const toggleApprovalSelection = (orderId: string) => {
    setSelectedApprovalIds((current) => (current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]));
  };

  const toggleVisibleApprovals = () => {
    setSelectedApprovalIds((current) => {
      if (allVisibleApprovalsSelected) {
        return current.filter((id) => !visibleApprovalIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleApprovalIds]));
    });
  };

  const handleReview = async (orderId: string, status: ReviewOrderStatus) => {
    setReviewState({ orderId, status });

    try {
      await updateOrderStatus(orderId, status);
    } finally {
      setReviewState(null);
    }
  };

  const handleBulkReview = async (status: ReviewOrderStatus) => {
    if (!selectedApprovalIds.length) {
      return;
    }

    const ids = [...selectedApprovalIds];
    setReviewState({ status, bulk: true });

    try {
      await updateOrderStatuses(ids, status);
      setSelectedApprovalIds([]);
    } finally {
      setReviewState(null);
    }
  };

  const handleGenerateProcurement = async () => {
    if (!selectedInventoryItem || procurementDraft.quantity < 1) {
      return;
    }

    setIsGeneratingProcurement(true);

    try {
      const createdOrder = await generateProcurementRequest({
        medicineId: selectedInventoryItem.id,
        quantity: procurementDraft.quantity,
      });

      setProcurementQuery("");
      setProcurementStatus("all");
      setProcurementPriority("all");
      setProcurementSort("recent");
      setLaunchpadOpen(false);
      focusReference("procurement", { kind: "order", id: createdOrder.id });
    } finally {
      setIsGeneratingProcurement(false);
    }
  };

  const submitApi = () => {
    if (!form.name || !form.endpoint || !form.description) {
      return;
    }

    void addApi(form);
    setForm({
      name: "",
      endpoint: "",
      method: "GET",
      authentication: "Bearer JWT",
      description: "",
    });
  };

  const pendingReviewCount = pendingApprovals.length;
  const averageEtaDays = Math.round(dataset.orders.reduce((sum, order) => sum + getEtaDays(order.eta), 0) / Math.max(dataset.orders.length, 1));
  const inTransitCount = dataset.orders.filter((order) => order.status === "in-transit").length;
  const totalProcurementSpend = dataset.orders.reduce((sum, order) => sum + order.totalCost, 0);
  const approvalSpend = pendingApprovals.reduce((sum, order) => sum + order.totalCost, 0);
  const auditAttentionCount = dataset.auditLogs.filter((log) => log.status === "attention" || log.status === "rejected" || log.status === "modified").length;
  const procurementLinkedAuditCount = dataset.auditLogs.filter((log) => log.entityType === "order" || log.entityId?.startsWith("PO-")).length;
  const auditLast24hCount = dataset.auditLogs.filter((log) => Date.now() - new Date(log.time).getTime() <= 24 * 60 * 60 * 1000).length;
  const apiHealthyCount = dataset.apis.filter((api) => api.status === "healthy").length;
  const apiDegradedCount = dataset.apis.filter((api) => api.status === "degraded").length;
  const apiOfflineCount = dataset.apis.filter((api) => api.status === "offline").length;
  const apiAttentionCount = apiDegradedCount + apiOfflineCount;
  const averageApiLatency = Math.round(dataset.apis.reduce((sum, api) => sum + api.latencyMs, 0) / Math.max(dataset.apis.length, 1));
  const repositoryIndexedCount = dataset.files.filter((file) => file.status === "indexed").length;
  const repositoryProcessingCount = dataset.files.filter((file) => file.status === "processing").length;
  const repositoryNeedsReviewCount = dataset.files.filter((file) => file.status === "needs-review").length;
  const repositoryTone: StatusTone =
    repositoryNeedsReviewCount > 0 ? "amber" : repositoryProcessingCount > 0 ? "sky" : "emerald";
  const procurementActionLabel = launchpadOpen ? "Hide Launchpad" : "Generate Purchase Request";
  const viewWorkload: Record<OperationsView, { count: string; summary: string; tone: StatusTone }> = {
    procurement: {
      count: String(dataset.orders.length),
      summary: `${pendingReviewCount} awaiting approval or revision`,
      tone: pendingReviewCount > 0 ? "sky" : "emerald",
    },
    approvals: {
      count: String(pendingReviewCount),
      summary: `${approvalOwners.length} operational owners currently in the queue`,
      tone: pendingReviewCount > 0 ? "amber" : "emerald",
    },
    audit: {
      count: String(auditAttentionCount),
      summary: `${auditLast24hCount} audit events logged in the last 24 hours`,
      tone: auditAttentionCount > 0 ? "amber" : "emerald",
    },
    apis: {
      count: String(apiAttentionCount > 0 ? apiAttentionCount : apiHealthyCount),
      summary:
        apiAttentionCount > 0
          ? `${apiOfflineCount} offline and ${apiDegradedCount} degraded services`
          : `${apiHealthyCount} healthy integrations available`,
      tone: apiAttentionCount > 0 ? (apiOfflineCount > 0 ? "rose" : "amber") : "emerald",
    },
  };

  const renderProcurementView = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Pending Review</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{pendingReviewCount}</p>
            <p className="mt-3 text-sm text-slate-600">Requests awaiting approval or revision.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Generated by AI</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{dataset.orders.length}</p>
            <p className="mt-3 text-sm text-slate-600">Live procurement requests staged by MediIntel AI.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Average ETA</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{averageEtaDays}d</p>
            <p className="mt-3 text-sm text-slate-600">Mean replenishment lead time across the active queue.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Open Spend</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{formatCurrency(totalProcurementSpend)}</p>
            <p className="mt-3 text-sm text-slate-600">{inTransitCount} requests are currently in supplier transit.</p>
          </CardContent>
        </Card>
      </div>

      {canGeneratePurchaseOrders && launchpadOpen ? (
        <ProcurementLaunchpad
          inventoryOptions={procurementCandidates}
          quickPicks={procurementCandidates.slice(0, 5)}
          selectedItem={selectedInventoryItem}
          selectedSupplier={selectedSupplier}
          quantity={procurementDraft.quantity}
          recommendedQuantity={recommendedProcurementQuantity}
          estimatedCost={estimatedProcurementCost}
          isSubmitting={isGeneratingProcurement}
          onMedicineChange={selectProcurementMedicine}
          onQuantityChange={updateProcurementQuantity}
          onUseRecommended={() => updateProcurementQuantity(recommendedProcurementQuantity)}
          onQuickSelect={selectProcurementMedicine}
          onSubmit={() => void handleGenerateProcurement()}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Procurement Pipeline</CardTitle>
          <CardDescription>Supplier ETA, approval posture, and trace-linked execution for live purchase requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.78fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search request, medicine, supplier, or trace id" value={procurementQuery} onChange={(event) => setProcurementQuery(event.target.value)} />
            </div>
            <Select value={procurementStatus} onValueChange={(value) => setProcurementStatus(value as typeof procurementStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending-approval">Pending approval</SelectItem>
                <SelectItem value="modified">Modified</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in-transit">In transit</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={procurementPriority} onValueChange={(value) => setProcurementPriority(value as typeof procurementPriority)}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={procurementSort} onValueChange={(value) => setProcurementSort(value as ProcurementSortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="priority">Highest priority</SelectItem>
                <SelectItem value="eta">Earliest ETA</SelectItem>
                <SelectItem value="cost">Highest cost</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProcurementQuery("");
                setProcurementStatus("all");
                setProcurementPriority("all");
                setProcurementSort("recent");
              }}
            >
              Clear Filters
            </Button>
          </div>

          <div className="table-shell overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Request</th>
                  <th className="px-4 py-4">Medicine</th>
                  <th className="px-4 py-4">Supplier</th>
                  <th className="px-4 py-4">ETA</th>
                  <th className="px-4 py-4 text-right">Cost</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Approval</th>
                  <th className="px-4 py-4">Audit</th>
                  <th className="px-4 py-4">Requested By</th>
                  <th className="px-4 py-4">Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedProcurementOrders.length ? (
                  paginatedProcurementOrders.map((order) => {
                    const isFocused =
                      order.id === focusedOrder?.id ||
                      (focusedApprovalId ? order.trace?.approvalId === focusedApprovalId : false) ||
                      (focusedAuditId ? order.trace?.auditId === focusedAuditId : false);

                    return (
                      <tr
                        key={order.id}
                        className={cn("cursor-pointer transition-colors duration-200 hover:bg-slate-50", isFocused && "bg-sky-50/80")}
                        onClick={() => focusOrder("procurement", order)}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950">{order.id}</p>
                            <p className="mt-1 text-sm text-slate-500">{formatDateLabel(order.createdAt)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{order.medicineName}</p>
                            <p className="mt-1 text-sm text-slate-500">{order.quantity} units</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.supplierName}</td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{formatDateLabel(order.eta)}</p>
                            <p className="mt-1 text-sm text-slate-500">{getEtaDays(order.eta)} days</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-slate-700">{formatCurrency(order.totalCost)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={getOrderStatusTone(order.status)}>{formatStatusLabel(order.status)}</Badge>
                            <Badge tone={getPriorityTone(order.priority)}>{order.priority}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.trace?.approvalId ?? "--"}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.trace?.auditId ?? "--"}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.requestedBy}</td>
                        <td className="px-4 py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              focusOrder("procurement", order);
                            }}
                          >
                            Inspect
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                      No procurement requests match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={procurementPage}
            totalPages={procurementTotalPages}
            totalItems={filteredProcurementOrders.length}
            currentCount={paginatedProcurementOrders.length}
            pageSize={PROCUREMENT_PAGE_SIZE}
            itemLabel="requests"
            onPageChange={setProcurementPage}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderApprovalsView = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Approval Queue</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{pendingReviewCount}</p>
            <p className="mt-3 text-sm text-slate-600">Requests waiting for leadership signoff.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Critical Priority</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">
              {pendingApprovals.filter((order) => order.priority === "critical").length}
            </p>
            <p className="mt-3 text-sm text-slate-600">Orders with immediate patient-care risk exposure.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Modified Requests</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">
              {pendingApprovals.filter((order) => order.status === "modified").length}
            </p>
            <p className="mt-3 text-sm text-slate-600">Requests already sent back for adjustment.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Review Spend</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{formatCurrency(approvalSpend)}</p>
            <p className="mt-3 text-sm text-slate-600">
              {selectedApprovalIds.length ? `${selectedApprovalIds.length} selected` : "Select approvals to bulk review."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>Batch review requests, focus a single record, and move decisions forward with linked audit context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.76fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search request, medicine, supplier, or reviewer" value={approvalQuery} onChange={(event) => setApprovalQuery(event.target.value)} />
            </div>
            <Select value={approvalPriority} onValueChange={(value) => setApprovalPriority(value as typeof approvalPriority)}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select value={approvalOwner} onValueChange={setApprovalOwner}>
              <SelectTrigger>
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {approvalOwners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={approvalSort} onValueChange={(value) => setApprovalSort(value as ApprovalSortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Highest priority</SelectItem>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="eta">Earliest ETA</SelectItem>
                <SelectItem value="cost">Highest cost</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setApprovalQuery("");
                setApprovalPriority("all");
                setApprovalOwner("all");
                setApprovalSort("priority");
              }}
            >
              Clear Filters
            </Button>
          </div>

          {(canApprove || canReject) ? (
            <div className="surface-subtle flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                    checked={allVisibleApprovalsSelected}
                    disabled={!visibleApprovalIds.length}
                    onChange={() => toggleVisibleApprovals()}
                  />
                  Select visible approvals
                </label>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="sky">{filteredApprovalOrders.length} filtered</Badge>
                  <Badge tone={selectedCriticalApprovalCount > 0 ? "rose" : "slate"}>{selectedApprovalOrders.length} selected</Badge>
                  <Badge tone={selectedCriticalApprovalCount > 0 ? "rose" : "slate"}>{selectedCriticalApprovalCount} critical</Badge>
                  <Badge tone={selectedApprovalOwnerCount > 0 ? "amber" : "slate"}>{selectedApprovalOwnerCount} owners</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <CheckCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{selectedApprovalOrders.length} approvals selected</p>
                  <p className="text-sm text-slate-600">
                    {selectedApprovalOrders.length ? `${formatCurrency(selectedApprovalSpend)} queued for bulk review.` : "Select rows to approve, modify, or reject in one action."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove ? (
                  <Button type="button" size="sm" disabled={!selectedApprovalOrders.length || !!reviewState} onClick={() => void handleBulkReview("approved")}>
                    {reviewState?.bulk && reviewState.status === "approved" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Approve Selected
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button type="button" size="sm" variant="secondary" disabled={!selectedApprovalOrders.length || !!reviewState} onClick={() => void handleBulkReview("modified")}>
                    {reviewState?.bulk && reviewState.status === "modified" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Modify Selected
                  </Button>
                ) : null}
                {canReject ? (
                  <Button type="button" size="sm" variant="danger" disabled={!selectedApprovalOrders.length || !!reviewState} onClick={() => void handleBulkReview("rejected")}>
                    {reviewState?.bulk && reviewState.status === "rejected" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reject Selected
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="table-shell overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                      checked={allVisibleApprovalsSelected}
                      disabled={!visibleApprovalIds.length}
                      onChange={() => toggleVisibleApprovals()}
                    />
                  </th>
                  <th className="px-4 py-4">Request</th>
                  <th className="px-4 py-4">Approval</th>
                  <th className="px-4 py-4">Medicine</th>
                  <th className="px-4 py-4">Supplier</th>
                  <th className="px-4 py-4">ETA</th>
                  <th className="px-4 py-4 text-right">Cost</th>
                  <th className="px-4 py-4">Priority</th>
                  <th className="px-4 py-4">Audit</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedApprovalOrders.length ? (
                  paginatedApprovalOrders.map((order) => {
                    const isFocused =
                      order.id === focusedOrder?.id ||
                      (focusedApprovalId ? order.trace?.approvalId === focusedApprovalId : false) ||
                      (focusedAuditId ? order.trace?.auditId === focusedAuditId : false);

                    return (
                      <tr
                        key={order.id}
                        className={cn("cursor-pointer transition-colors duration-200 hover:bg-slate-50", isFocused && "bg-sky-50/80")}
                        onClick={() => focusOrder("approvals", order)}
                      >
                        <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                            checked={selectedApprovalIds.includes(order.id)}
                            onChange={() => toggleApprovalSelection(order.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950">{order.id}</p>
                            <p className="mt-1 text-sm text-slate-500">{order.requestedBy}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div>
                            <p className="font-semibold text-slate-950">{order.trace?.approvalId ?? "--"}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{order.trace?.assignedRole ?? "Procurement Manager"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.medicineName}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.supplierName}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDateLabel(order.eta)}</td>
                        <td className="px-4 py-4 text-right text-sm text-slate-700">{formatCurrency(order.totalCost)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={getPriorityTone(order.priority)}>{order.priority}</Badge>
                            <Badge tone={getOrderStatusTone(order.status)}>{formatStatusLabel(order.status)}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{order.trace?.auditId ?? "--"}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            {canApprove ? (
                              <Button type="button" size="sm" disabled={!!reviewState} onClick={() => void handleReview(order.id, "approved")}>
                                {reviewState?.orderId === order.id && reviewState.status === "approved" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Approve
                              </Button>
                            ) : null}
                            {canApprove ? (
                              <Button type="button" size="sm" variant="secondary" disabled={!!reviewState} onClick={() => void handleReview(order.id, "modified")}>
                                {reviewState?.orderId === order.id && reviewState.status === "modified" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Modify
                              </Button>
                            ) : null}
                            {canReject ? (
                              <Button type="button" size="sm" variant="danger" disabled={!!reviewState} onClick={() => void handleReview(order.id, "rejected")}>
                                {reviewState?.orderId === order.id && reviewState.status === "rejected" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Reject
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                      No approval records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={approvalPage}
            totalPages={approvalTotalPages}
            totalItems={filteredApprovalOrders.length}
            currentCount={paginatedApprovalOrders.length}
            pageSize={APPROVAL_PAGE_SIZE}
            itemLabel="approvals"
            onPageChange={setApprovalPage}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderAuditView = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Logged Events</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{dataset.auditLogs.length}</p>
            <p className="mt-3 text-sm text-slate-600">Recorded AI and user actions across MediIntel.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Needs Attention</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{auditAttentionCount}</p>
            <p className="mt-3 text-sm text-slate-600">Running, modified, or rejected events for review.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Procurement Linked</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{procurementLinkedAuditCount}</p>
            <p className="mt-3 text-sm text-slate-600">Events tied directly to purchase requests or approvals.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Last 24 Hours</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{auditLast24hCount}</p>
            <p className="mt-3 text-sm text-slate-600">Recent operational actions captured today.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Filter execution history by status, agent, and record details, then jump straight into the linked operational trace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.76fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search event, agent, user, tool, or record id" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} />
            </div>
            <Select value={auditStatus} onValueChange={(value) => setAuditStatus(value as typeof auditStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="attention">Attention</SelectItem>
                <SelectItem value="modified">Modified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={auditAgent} onValueChange={setAuditAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {auditAgents.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={auditSort} onValueChange={(value) => setAuditSort(value as AuditSortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="status">Highest attention</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAuditQuery("");
                setAuditStatus("all");
                setAuditAgent("all");
                setAuditSort("recent");
              }}
            >
              Clear Filters
            </Button>
          </div>

          <div className="table-shell overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Time</th>
                  <th className="px-4 py-4">Agent</th>
                  <th className="px-4 py-4">Action</th>
                  <th className="px-4 py-4">Record</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Tool</th>
                  <th className="px-4 py-4">User</th>
                  <th className="px-4 py-4">Detail</th>
                  <th className="px-4 py-4">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedAuditLogs.length ? (
                  paginatedAuditLogs.map((log) => {
                    const isFocused =
                      (focusedAuditId ? log.id === focusedAuditId : false) ||
                      (focusedOrder ? log.entityId === focusedOrder.id || log.id === focusedOrder.trace?.auditId : false);

                    return (
                      <tr
                        key={log.id}
                        className={cn("cursor-pointer transition-colors duration-200 hover:bg-slate-50", isFocused && "bg-sky-50/80")}
                        onClick={() => focusReference("audit", { kind: "audit", id: log.id })}
                      >
                        <td className="px-4 py-4 text-sm text-slate-700">{formatDateTime(log.time)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-slate-950">{log.agent}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{log.action}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div>
                            <p>{log.entityId ?? "--"}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{log.entityType ?? "System"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={getAuditStatusTone(log.status)}>{log.status}</Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{log.tool ?? "--"}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{log.user}</td>
                        <td className="px-4 py-4 text-sm leading-6 text-slate-600">{log.detail}</td>
                        <td className="px-4 py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              focusReference("audit", { kind: "audit", id: log.id });
                            }}
                          >
                            Inspect
                            <ArrowUpRight className="ml-2 h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      No audit entries match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={auditPage}
            totalPages={auditTotalPages}
            totalItems={filteredAuditLogs.length}
            currentCount={paginatedAuditLogs.length}
            pageSize={AUDIT_PAGE_SIZE}
            itemLabel="events"
            onPageChange={setAuditPage}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderApiView = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Registered Services</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{dataset.apis.length}</p>
            <p className="mt-3 text-sm text-slate-600">Mock integrations and enterprise-ready endpoints tracked here.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Healthy Integrations</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{apiHealthyCount}</p>
            <p className="mt-3 text-sm text-slate-600">Services currently reporting healthy operational status.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Needs Attention</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{apiAttentionCount}</p>
            <p className="mt-3 text-sm text-slate-600">{apiOfflineCount} offline and {apiDegradedCount} degraded integrations.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Average Latency</p>
            <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{averageApiLatency} ms</p>
            <p className="mt-3 text-sm text-slate-600">Mean response time across registered API services.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>API Registry</CardTitle>
            <CardDescription>Existing integration management preserved for inventory, forecast, alerts, and authentication services.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search API name, endpoint, or description" value={apiQuery} onChange={(event) => setApiQuery(event.target.value)} />
            </div>
            <div className="table-shell overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4">API Name</th>
                    <th className="px-4 py-4">Endpoint</th>
                    <th className="px-4 py-4">Method</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Authentication</th>
                    <th className="px-4 py-4">Description</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredApis.length ? (
                    filteredApis.map((api) => (
                      <tr key={api.id}>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-950">{api.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{api.latencyMs} ms</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{api.endpoint}</td>
                        <td className="px-4 py-4">
                          <Badge tone="sky">{api.method}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={api.status === "healthy" ? "emerald" : api.status === "degraded" ? "amber" : "rose"}>{api.status}</Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{api.authentication}</td>
                        <td className="px-4 py-4 text-sm leading-6 text-slate-600">{api.description}</td>
                        <td className="px-4 py-4">
                          {canManageApis ? (
                            <Button variant="ghost" size="sm" type="button" onClick={() => void deleteApi(api.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                        No API entries match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add New API</CardTitle>
            <CardDescription>Integration authoring for current services and future enterprise handoff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-name">API Name</Label>
              <Input id="api-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-endpoint">Endpoint</Label>
              <Input
                id="api-endpoint"
                placeholder="/department/service"
                value={form.endpoint}
                onChange={(event) => setForm((current) => ({ ...current, endpoint: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-method">Method</Label>
              <Select value={form.method} onValueChange={(value) => setForm((current) => ({ ...current, method: value as ApiDefinition["method"] }))}>
                <SelectTrigger id="api-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-auth">Authentication</Label>
              <Input id="api-auth" value={form.authentication} onChange={(event) => setForm((current) => ({ ...current, authentication: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-description">Description</Label>
              <Textarea id="api-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            {canManageApis ? (
              <Button className="w-full" type="button" onClick={submitApi}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New API
              </Button>
            ) : null}
            <div className="surface-azure p-4 text-sm leading-6 text-slate-700">
              <div className="flex items-center gap-3">
                <Link2 className="h-4 w-4 text-sky-700" />
                ERP-ready integration services remain configurable here without changing existing backend routes.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={viewMeta[activeView].eyebrow}
        title={viewMeta[activeView].title}
        description={viewMeta[activeView].description}
        actionLabel={activeView === "procurement" && canGeneratePurchaseOrders ? procurementActionLabel : undefined}
        onAction={activeView === "procurement" && canGeneratePurchaseOrders ? () => setLaunchpadOpen((current) => !current) : undefined}
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="surface-card grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const workload = viewWorkload[tab.key];
            const isActive = activeView === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setView(tab.key)}
                className={cn(
                  "rounded-[1.5rem] border p-4 text-left transition-all duration-200",
                  isActive
                    ? "border-sky-200 bg-sky-50/80 shadow-sm shadow-sky-100"
                    : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl border",
                      isActive ? "border-sky-200 bg-white text-sky-700" : "border-slate-200/70 bg-slate-50 text-slate-600",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge tone={workload.tone}>{workload.count}</Badge>
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">{tab.label}</p>
                <p className={cn("mt-2 text-sm leading-6", isActive ? "text-sky-700" : "text-slate-600")}>{tab.description}</p>
                <p className={cn("mt-3 text-xs uppercase tracking-[0.16em]", isActive ? "text-sky-600" : "text-slate-400")}>{workload.summary}</p>
              </button>
            );
          })}
        </div>

        <Card className="border border-sky-100">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <Database className="h-4 w-4" />
                Repository Context
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">Knowledge Repository</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Grounding files, indexed policy content, and operational citations that support procurement and approval decisions.
                  </p>
                </div>
                <Badge tone={repositoryTone}>{repositoryIndexedCount} indexed</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Indexed</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{repositoryIndexedCount}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Processing</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{repositoryProcessingCount}</p>
              </div>
              <div className="surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Needs Review</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{repositoryNeedsReviewCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/memory")}>
                Open Knowledge Repository
              </Button>
              <Button type="button" variant="outline" onClick={() => setView("apis")} disabled={activeView === "apis"}>
                {activeView === "apis" ? "API Registry Active" : "Review API Registry"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeView !== "apis" && (focusedOrder || focusedAuditId) ? (
        <Card className="border border-sky-200 bg-sky-50/80">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="panel-label text-sky-700">Focused From MediIntel AI</p>
              <p className="text-sm leading-6 text-slate-700">{getFocusDescription(focusedOrder, focusedAuditLog)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {focusedOrder ? <Badge tone="sky">{focusedOrder.id}</Badge> : null}
              {focusedOrder?.trace?.approvalId || focusedApprovalId ? <Badge tone="amber">{focusedOrder?.trace?.approvalId ?? focusedApprovalId}</Badge> : null}
              {focusedOrder?.trace?.auditId || focusedAuditId ? <Badge tone="slate">{focusedOrder?.trace?.auditId ?? focusedAuditId}</Badge> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeView === "apis" ? (
        renderApiView()
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            {activeView === "procurement" ? renderProcurementView() : null}
            {activeView === "approvals" ? renderApprovalsView() : null}
            {activeView === "audit" ? renderAuditView() : null}
          </div>
          <OrderFocusPanel
            order={focusedOrder}
            auditLog={focusedAuditLog}
            relatedAlerts={relatedAlerts}
            relatedLogs={relatedAuditLogs}
            focusedAuditId={focusedAuditId}
            canApprove={canApprove}
            canReject={canReject}
            reviewState={reviewState}
            onOpenReference={(reference) => focusReference(reference.view, { kind: reference.kind, id: reference.id })}
            onOpenAlert={(alertId, severity) => router.push(buildAlertsUrl({ alertId, severity }))}
            onReview={(orderId, status) => void handleReview(orderId, status)}
            onClearFocus={clearFocus}
          />
        </div>
      )}
    </section>
  );
}
