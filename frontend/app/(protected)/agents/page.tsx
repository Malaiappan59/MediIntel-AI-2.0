"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, CheckCircle2, Database, Link2, Loader2, Maximize2, Minimize2, Send, Sparkles, X } from "lucide-react";
import { AgentMessageCard } from "@/components/agents/agent-message-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { downloadBlobFile, downloadTextFile } from "@/lib/download";
import { buildMemoryUrl, buildOperationsUrl, formatCurrency, formatDateTime, getDefaultChatActions } from "@/lib/experience";
import { cn } from "@/lib/utils";
import { downloadMemoryFile } from "@/services/medintel-service";
import type { ChatAction, ChatMessage, MasterAgentExecution, OperationalTraceReference, ProcurementOrder } from "@/types/medintel";

type AgentActivityState = {
  id: string;
  title: string;
  subtitle: string;
  status: "idle" | "running" | "completed";
  detail: string;
};

const agentTemplates: Omit<AgentActivityState, "status">[] = [
  {
    id: "master",
    title: "Master Agent",
    subtitle: "Mission coordination",
    detail: "Awaiting mission context and user intent.",
  },
  {
    id: "inventory",
    title: "Inventory Agent",
    subtitle: "Inventory and workflow analysis",
    detail: "Ready to scan live inventory and procurement posture.",
  },
  {
    id: "forecast",
    title: "Forecast Agent",
    subtitle: "Forecast and signal analysis",
    detail: "Ready to evaluate demand acceleration and risk exposure.",
  },
  {
    id: "recommendation",
    title: "Recommendation Agent",
    subtitle: "Recommendation and validation",
    detail: "Ready to compare scenarios and select the best path.",
  },
  {
    id: "procurement",
    title: "Procurement Agent",
    subtitle: "Execution and handoff",
    detail: "Ready to generate procurement and route approvals.",
  },
];

function createIdleActivity(): AgentActivityState[] {
  return agentTemplates.map((agent) => ({
    ...agent,
    status: "idle",
  }));
}

function buildTableCsv(message: ChatMessage) {
  if (!message.table) {
    return "";
  }

  const header = message.table.columns.map((column) => column.label).join(",");
  const rows = message.table.rows.map((row) =>
    message.table?.columns.map((column) => `"${String(row[column.key] ?? "").replace(/"/g, '""')}"`).join(","),
  );

  return [header, ...rows].join("\n");
}

function resolveMessageTrace(message: ChatMessage | null, preferredView?: OperationalTraceReference["view"]) {
  if (!message?.operationalTrace?.length) {
    return null;
  }

  if (preferredView) {
    return message.operationalTrace.find((reference) => reference.view === preferredView) ?? message.operationalTrace[0];
  }

  return message.operationalTrace[0];
}

function findMessageLinkedOrder(message: ChatMessage | null, orders: ProcurementOrder[]) {
  if (!message) {
    return null;
  }

  const orderTrace = message.operationalTrace?.find((reference) => reference.kind === "order");
  if (orderTrace) {
    return orders.find((order) => order.id === orderTrace.id) ?? null;
  }

  const approvalTrace = message.operationalTrace?.find((reference) => reference.kind === "approval");
  if (approvalTrace) {
    return orders.find((order) => order.trace?.approvalId === approvalTrace.id) ?? null;
  }

  const auditTrace = message.operationalTrace?.find((reference) => reference.kind === "audit");
  if (auditTrace) {
    return orders.find((order) => order.trace?.auditId === auditTrace.id) ?? null;
  }

  return null;
}

function buildActivityFromExecution(execution: MasterAgentExecution | null) {
  if (!execution?.stages.length) {
    return createIdleActivity();
  }

  return execution.stages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    subtitle: stage.subtitle,
    status: stage.status === "attention" ? ("running" as const) : (stage.status as AgentActivityState["status"]),
    detail: stage.summary,
  }));
}

export default function AgentsPage() {
  const router = useRouter();
  const { username } = useAuth();
  const { dataset, activeExecution, loadError, sendChatMessage } = useAppData();
  const [draft, setDraft] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [quickActions, setQuickActions] = useState<ChatAction[]>(getDefaultChatActions());
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const displayName = dataset.settings.user.displayName || username || "Operations Lead";
  const messageFeed = [...dataset.chatHistory].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const latestAssistantMessage = [...messageFeed].reverse().find((message) => message.role === "assistant") ?? null;
  const latestActionMessage =
    [...messageFeed].reverse().find((message) => message.role === "assistant" && message.followUpActions?.length) ?? latestAssistantMessage;
  const latestAssistantTable = [...messageFeed].reverse().find((message) => message.role === "assistant" && message.table) ?? null;
  const latestLinkedOrder =
    findMessageLinkedOrder(latestAssistantMessage, dataset.orders) ??
    [...dataset.orders].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ??
    null;
  const latestPrimarySource = latestAssistantMessage?.sources?.[0] ?? null;
  const latestPrimaryTrace = resolveMessageTrace(latestAssistantMessage);
  const activityStates = buildActivityFromExecution(activeExecution);
  const workingActivityStates = isResponding && activeExecution ? activityStates : [];

  useEffect(() => {
    const latestAssistantMessage = [...dataset.chatHistory]
      .reverse()
      .find((message) => message.role === "assistant" && message.followUpActions?.length);

    if (latestAssistantMessage?.followUpActions?.length) {
      setQuickActions(latestAssistantMessage.followUpActions);
    }
  }, [dataset.chatHistory]);

  const handleTraceNavigate = (reference: OperationalTraceReference) => {
    router.push(buildOperationsUrl(reference.view, reference));
  };

  const handleQuickAction = async (action: ChatAction, sourceMessage?: ChatMessage | null) => {
    const actionMessage = sourceMessage ?? latestActionMessage ?? latestAssistantMessage;

    if (action.kind === "navigate-view" && action.view) {
      const fallbackTrace = action.traceId && action.traceKind ? { kind: action.traceKind, id: action.traceId } : resolveMessageTrace(actionMessage, action.view);

      router.push(buildOperationsUrl(action.view, fallbackTrace ? { kind: fallbackTrace.kind, id: fallbackTrace.id } : undefined));
      return;
    }

    if (action.kind === "download-report") {
      const reportMessage = sourceMessage?.table ? sourceMessage : latestAssistantTable;

      if (reportMessage) {
        downloadTextFile(buildTableCsv(reportMessage), "medintel_ai_workspace_report.csv", "text/csv;charset=utf-8");
      }
      return;
    }

    if (action.kind === "download-purchase-order") {
      const linkedOrder = findMessageLinkedOrder(actionMessage, dataset.orders) ?? latestLinkedOrder;

      if (linkedOrder) {
        downloadTextFile(
          [
            `Purchase Order: ${linkedOrder.id}`,
            `Medicine: ${linkedOrder.medicineName}`,
            `Supplier: ${linkedOrder.supplierName}`,
            `ETA: ${formatDateTime(linkedOrder.eta)}`,
            `Cost: ${formatCurrency(linkedOrder.totalCost)}`,
            `Requested By: ${linkedOrder.requestedBy}`,
          ].join("\n"),
          `${linkedOrder.id}.txt`,
        );
      }
      return;
    }

    await handlePrompt(action.prompt);
  };

  const handlePrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    if (!prompt || isResponding) {
      return;
    }

    setDraft("");
    setIsResponding(true);
    setAssistantError(null);

    try {
      const reply = await sendChatMessage(prompt);
      setQuickActions(reply.followUpActions ?? getDefaultChatActions());
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "MediIntel AI is unavailable right now.");
    } finally {
      setIsResponding(false);
    }
  };

  const handleSourceDownload = async (sourceId: string) => {
    const { filename, blob } = await downloadMemoryFile(sourceId);
    downloadBlobFile(filename, blob);
  };

  const handleSourceOpen = (sourceId: string) => {
    router.push(buildMemoryUrl(sourceId));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-200/70 bg-white px-5 py-5 shadow-panel sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="panel-label">MediIntel AI</p>
            <h2 className="section-title text-3xl font-semibold text-slate-950">Current Mission</h2>
            <p className="text-base font-medium text-sky-700">Predict. Prevent. Procure.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsExpanded((current) => !current)}>
              {isExpanded ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
              {isExpanded ? "Collapse Chat" : "Expand Chat"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
              <X className="mr-2 h-4 w-4" />
              Close Chat
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-5", isExpanded ? "xl:grid-cols-[1fr]" : "xl:grid-cols-[minmax(0,1fr)_320px]")}>
        <Card className="workspace-glow min-h-[72vh]">
          <CardContent className="flex h-full flex-col gap-5 p-5 sm:p-6">
            <div className="surface-azure p-5">
              <div className="flex items-center gap-2 text-sky-700">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-semibold">{"Hello "}{displayName}{" \u{1F44B}"}</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                I&apos;m MediIntel AI. I continuously monitor inventory, predict shortages, recommend actions, generate procurement, and validate operational decisions.
                How can I help today?
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant={action.tone === "primary" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => void handleQuickAction(action, latestActionMessage)}
                >
                  {action.label}
                </Button>
              ))}
            </div>

            {latestAssistantMessage ? (
              <Card className="border border-sky-100 bg-white/90 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                        <BrainCircuit className="h-4 w-4" />
                        Response Workspace
                      </div>
                      <p className="text-lg font-semibold text-slate-950">{latestAssistantMessage.headline ?? "Latest MediIntel AI response"}</p>
                      <p className="text-sm leading-6 text-slate-600">{latestAssistantMessage.content}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {latestAssistantMessage.confidence != null ? <Badge tone="sky">{Math.round(latestAssistantMessage.confidence * 100)}% confidence</Badge> : null}
                      <Badge tone="slate">{latestAssistantMessage.sources?.length ?? 0} sources</Badge>
                      <Badge tone="amber">{latestAssistantMessage.operationalTrace?.length ?? 0} trace links</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-subtle p-4">
                      <p className="text-sm text-slate-500">Grounded Evidence</p>
                      <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{latestAssistantMessage.sources?.length ?? 0}</p>
                      <p className="mt-2 text-sm text-slate-600">Repository documents supporting this response.</p>
                    </div>
                    <div className="surface-subtle p-4">
                      <p className="text-sm text-slate-500">Workflow Trace</p>
                      <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{latestAssistantMessage.operationalTrace?.length ?? 0}</p>
                      <p className="mt-2 text-sm text-slate-600">Linked procurement, approval, or audit records.</p>
                    </div>
                    <div className="surface-subtle p-4">
                      <p className="text-sm text-slate-500">Primary Order</p>
                      <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{latestLinkedOrder?.id ?? "--"}</p>
                      <p className="mt-2 text-sm text-slate-600">{latestLinkedOrder ? latestLinkedOrder.medicineName : "No linked order in the current response."}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {latestPrimarySource ? (
                      <Button type="button" variant="outline" size="sm" onClick={handleSourceOpen.bind(null, latestPrimarySource.id)}>
                        <Database className="mr-2 h-4 w-4" />
                        Open Primary Source
                      </Button>
                    ) : null}
                    {latestPrimaryTrace ? (
                      <Button type="button" variant="outline" size="sm" onClick={handleTraceNavigate.bind(null, latestPrimaryTrace)}>
                        <Link2 className="mr-2 h-4 w-4" />
                        Open Workflow Trace
                      </Button>
                    ) : null}
                    {latestAssistantTable ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void handleQuickAction(
                            {
                              id: "download-latest-table",
                              label: "Download Latest Table",
                              prompt: "Download Latest Table",
                              kind: "download-report",
                            },
                            latestAssistantMessage,
                          )
                        }
                      >
                        Download Latest Table
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isResponding ? (
              <Card className="border border-sky-100 bg-white/90 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Live Response
                      </div>
                      <p className="text-lg font-semibold text-slate-950">Agents are processing your request</p>
                      <p className="text-sm leading-6 text-slate-600">
                        MediIntel AI is coordinating inventory, forecast, and procurement context before publishing the next response.
                      </p>
                    </div>
                    <div className="rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">Working</div>
                  </div>

                  {workingActivityStates.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {workingActivityStates.map((agent) => (
                        <div key={`working-${agent.id}`} className="surface-subtle p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">{agent.title}</p>
                              <p className="mt-1 text-sm text-slate-500">{agent.subtitle}</p>
                            </div>
                            <Badge tone={agent.status === "completed" ? "emerald" : agent.status === "running" ? "sky" : "slate"}>
                              {agent.status === "running" ? "Processing" : agent.status === "completed" ? "Completed" : "Idle"}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{agent.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Live agent stages will appear after the model returns the structured execution result.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {messageFeed.length === 0 ? (
                <div className="surface-subtle p-5 text-sm leading-7 text-slate-600">
                  Start with inventory, shortage, supplier, procurement, or alert questions to activate the MediIntel AI workspace.
                </div>
              ) : null}
              {messageFeed.map((message) => (
                <AgentMessageCard
                  key={message.id}
                  message={message}
                  onDownloadSource={handleSourceDownload}
                  onOpenSource={handleSourceOpen}
                  onTraceNavigate={handleTraceNavigate}
                  onAction={handleQuickAction}
                />
              ))}
            </div>

            {assistantError || loadError ? (
              <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {assistantError ?? loadError}
              </div>
            ) : null}

            <div className="rounded-[1.75rem] border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <Textarea
                  placeholder="Type your query..."
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      variant={action.tone === "primary" ? "default" : "secondary"}
                      size="sm"
                      onClick={() => void handleQuickAction(action, latestActionMessage)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Live operational guidance with structured agent reasoning and traceable actions.
                  </p>
                  <Button type="button" size="lg" onClick={() => void handlePrompt(draft)} disabled={isResponding}>
                    <Send className="mr-2 h-4 w-4" />
                    {isResponding ? "Working..." : "Send"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isExpanded ? (
          <Card className="workspace-glow">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <p className="panel-label">Agent Activity</p>
                <h3 className="section-title text-2xl font-semibold text-slate-950">Live Agent Execution</h3>
              </div>

              <div className="space-y-3">
                {activityStates.map((agent) => (
                  <div
                    key={agent.id}
                    className={cn(
                      "rounded-[1.5rem] border border-slate-200/70 bg-white p-4 transition-all duration-200",
                      agent.status === "running" ? "agent-live border-sky-200 bg-sky-50/70" : "",
                      agent.status === "completed" ? "agent-complete border-emerald-200 bg-emerald-50/50" : "",
                      agent.status === "idle" ? "agent-idle" : "",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{agent.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{agent.subtitle}</p>
                      </div>
                      {agent.status === "completed" ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : (
                        <Badge tone={agent.status === "running" ? "sky" : "slate"}>
                          {agent.status === "running" ? "Processing" : "Idle"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{agent.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
