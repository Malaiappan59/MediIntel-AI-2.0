"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Send, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { AgentMessageCard } from "@/components/agents/agent-message-card";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlobFile } from "@/lib/download";
import { buildMemoryUrl, buildOperationsUrl } from "@/lib/experience";
import { cn } from "@/lib/utils";
import { downloadMemoryFile } from "@/services/medintel-service";
import type { OperationalTraceReference } from "@/types/medintel";

type AgentDrawerContextValue = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  launchAndOpen: (goal?: string) => void;
};

const AgentDrawerContext = createContext<AgentDrawerContextValue | null>(null);

const suggestedPrompts = [
  "Show Inventory",
  "Predict Shortages",
  "Generate Procurement",
  "Review Alerts",
  "Explain Recommendation",
  "Review Orders",
];

function statusTone(status: string) {
  if (status === "completed") {
    return "emerald" as const;
  }
  if (status === "running") {
    return "sky" as const;
  }
  if (status === "attention") {
    return "amber" as const;
  }
  return "slate" as const;
}

function AgentDrawer() {
  const router = useRouter();
  const { username } = useAuth();
  const { dataset, activeExecution, sendChatMessage } = useAppData();
  const context = useContext(AgentDrawerContext);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!context) {
    return null;
  }

  const submitPrompt = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    try {
      setErrorMessage(null);
      await sendChatMessage(trimmed);
      setDraft("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "MediIntel AI is unavailable right now.");
    }
  };

  const handleSourceDownload = async (sourceId: string) => {
    const { filename, blob } = await downloadMemoryFile(sourceId);
    downloadBlobFile(filename, blob);
  };

  const handleTraceNavigation = (reference: OperationalTraceReference) => {
    context.closeDrawer();
    router.push(buildOperationsUrl(reference.view, reference));
  };

  const handleSourceOpen = (sourceId: string) => {
    context.closeDrawer();
    router.push(buildMemoryUrl(sourceId));
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/25 transition-opacity",
          context.isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={context.closeDrawer}
      />
      <motion.aside
        initial={false}
        animate={{ x: context.isOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed right-0 top-0 z-50 h-screen w-full max-w-[720px] border-l border-sky-100 bg-white/95 p-5 shadow-2xl shadow-sky-900/10 backdrop-blur-xl xl:max-w-[40vw]"
      >
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between rounded-[1.75rem] border border-sky-100 bg-sky-50/70 p-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <Sparkles className="h-4 w-4" />
                MedIntel AI
              </div>
              <h2 className="section-title text-2xl font-semibold text-slate-900">{"Hello "}{username ?? "Operations Lead"}{" \u{1F44B}"}</h2>
              <p className="text-sm text-slate-600">Current Mission: Prevent medicine shortages before they impact patient care.</p>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={context.closeDrawer}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {activeExecution ? (
            <Card className="glass-card border-sky-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-5 w-5 text-sky-600" />
                  Master Agent Status
                </CardTitle>
                <CardDescription>{activeExecution.goal}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {activeExecution.stages.map((stage) => (
                    <div key={stage.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{stage.title}</p>
                        <Badge tone={statusTone(stage.status)}>{stage.status}</Badge>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{stage.subtitle}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{stage.summary}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Reasoning</p>
                    <Badge tone="sky">{activeExecution.confidenceScore}% confidence</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{activeExecution.reasoning}</p>
                  <p className="mt-3 text-sm font-medium text-sky-700">Next Action: {activeExecution.nextAction}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-sky-100 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
                onClick={() => void submitPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {dataset.chatHistory.map((message) => (
              <AgentMessageCard
                key={message.id}
                message={message}
                onDownloadSource={handleSourceDownload}
                onOpenSource={handleSourceOpen}
                onTraceNavigate={handleTraceNavigation}
              />
            ))}
          </div>

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm">
            <Textarea
              placeholder="Ask MedIntel AI about inventory, shortages, alerts, procurement, or recommendations..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Copilot-style assistant drawer for operations, forecasting, reasoning, and action guidance.</p>
              <Button type="button" onClick={() => void submitPrompt(draft)}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export function AgentDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = () => setIsOpen(true);
  const closeDrawer = () => setIsOpen(false);
  const launchAndOpen = (_goal?: string) => {
    setIsOpen(true);
  };

  return (
    <AgentDrawerContext.Provider value={{ isOpen, openDrawer, closeDrawer, launchAndOpen }}>
      {children}
      <AgentDrawer />
    </AgentDrawerContext.Provider>
  );
}

export function useAgentDrawer() {
  const context = useContext(AgentDrawerContext);

  if (!context) {
    throw new Error("useAgentDrawer must be used within AgentDrawerProvider");
  }

  return context;
}
