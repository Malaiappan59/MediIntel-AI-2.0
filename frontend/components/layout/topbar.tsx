"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Sparkles } from "lucide-react";
import { OperationsInbox } from "@/components/layout/operations-inbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { APP_NAME } from "@/lib/constants";
import { getInitials } from "@/lib/experience";

function getRouteMeta(pathname: string, hash: string) {
  if (pathname === "/dashboard") {
    return {
      title: "Executive Overview",
      description: "Operational posture, demand forecast, approvals, and procurement risk in one view.",
    };
  }

  if (pathname === "/agents") {
    return {
      title: "AI Workspace",
      description: "Continuous operational reasoning with live agent activity and decision support.",
    };
  }

  if (pathname === "/memory") {
    return {
      title: "Knowledge Repository",
      description: "Govern knowledge sources powering retrieval, audit visibility, and grounded AI responses.",
    };
  }

  if (pathname === "/alerts") {
    return {
      title: "Alert Center",
      description: "Track severity timelines, escalation posture, and unresolved operational issues.",
    };
  }

  if (pathname === "/settings") {
    return {
      title: "Settings",
      description: "Control hospital profile, user preferences, notifications, and AI operating mode.",
    };
  }

  if (pathname === "/tools" && hash === "#approvals") {
    return {
      title: "Approvals",
      description: "Review the AI-generated approval queue and update procurement decisions with full traceability.",
    };
  }

  if (pathname === "/tools" && hash === "#audit") {
    return {
      title: "Audit Logs",
      description: "Inspect every AI action, review outcome, and operational intervention across the workspace.",
    };
  }

  if (pathname === "/tools" && hash === "#apis") {
    return {
      title: "API Registry",
      description: "Endpoint and service management for current integrations and future enterprise handoff.",
    };
  }

  return {
    title: "Procurement",
    description: "Manage AI-generated procurement requests, supplier timing, and cost-sensitive replenishment workflows.",
  };
}

export function Topbar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { dataset, activeExecution } = useAppData();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash || "#procurement");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const criticalAlerts = dataset.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const displayName = dataset.settings.user.displayName;
  const meta = getRouteMeta(pathname, hash);
  const workspaceName = dataset.settings.general.workspaceName;

  return (
    <header className="surface-card px-5 py-4 lg:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span>{APP_NAME}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{meta.title}</span>
          </div>
          <div className="space-y-1">
            <h1 className="section-title text-2xl font-semibold text-slate-950">{meta.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{meta.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-[220px] truncate rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            {workspaceName}
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-600">
            Refresh {dataset.settings.general.refreshInterval}
          </div>
          <OperationsInbox />
          <Badge tone={criticalAlerts > 0 ? "rose" : "emerald"}>
            {criticalAlerts > 0 ? `${criticalAlerts} critical alerts` : "No critical alerts"}
          </Badge>
          <Badge tone={activeExecution ? "sky" : "emerald"}>
            {activeExecution ? "AI mission active" : "AI ready"}
          </Badge>
          <Button asChild variant="secondary">
            <Link href="/agents">
              <Sparkles className="mr-2 h-4 w-4" />
              Open AI Workspace
            </Link>
          </Button>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-sm font-semibold text-white">
              {getInitials(displayName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-slate-500">{dataset.settings.user.role}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
