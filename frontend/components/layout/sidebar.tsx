"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivitySquare,
  BellRing,
  Bot,
  ClipboardCheck,
  Database,
  History,
  Hospital,
  LayoutDashboard,
  Link2,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", pathname: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", pathname: "/agents", label: "AI Workspace", icon: Bot },
  { href: "/tools#approvals", pathname: "/tools", hash: "#approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/tools#procurement", pathname: "/tools", hash: "#procurement", label: "Procurement", icon: ShoppingCart },
  { href: "/alerts", pathname: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/tools#audit", pathname: "/tools", hash: "#audit", label: "Audit Logs", icon: History },
  { href: "/settings", pathname: "/settings", label: "Settings", icon: Settings },
] as const;

const utilityItems = [
  {
    href: "/memory",
    pathname: "/memory",
    label: "Knowledge Repository",
    description: "Uploads, citations, and retrieval readiness",
    icon: Database,
  },
  {
    href: "/tools#apis",
    pathname: "/tools",
    hash: "#apis",
    label: "API Registry",
    description: "Mock services and ERP-ready integrations",
    icon: Link2,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { role, username } = useAuth();
  const { dataset, activeExecution } = useAppData();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => {
      setHash(window.location.hash);
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const pendingApprovals = dataset.orders.filter((order) => order.status === "pending-approval" || order.status === "modified").length;
  const openCriticalAlerts = dataset.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const processingFiles = dataset.files.filter((file) => file.status !== "indexed").length;
  const apiAttention = dataset.apis.filter((api) => api.status !== "healthy").length;
  const activeToolsHash = hash || "#procurement";
  const displayName = dataset.settings.user.displayName || username || "Operations Lead";

  return (
    <aside className="page-shell flex h-full flex-col gap-6 border-slate-200/70 bg-white/95 p-5 lg:p-6">
      <div className="surface-card workspace-glow p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200/70">
            <ActivitySquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="section-title text-2xl font-semibold text-slate-950">{APP_NAME}</p>
            <p className="mt-1 text-sm font-medium text-sky-700">{APP_TAGLINE}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Enterprise AI Platform for Healthcare Inventory Management
        </p>
      </div>

      <div className="surface-subtle p-4">
        <p className="panel-label">Current Mission</p>
        <p className="mt-3 text-sm leading-6 text-slate-700">{dataset.hospital.mission}</p>
      </div>

      <div className="space-y-3">
        <p className="panel-label">Operations Center</p>
        <nav className="space-y-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isToolsItem = item.pathname === "/tools";
            const isActive =
              pathname === item.pathname &&
              (!isToolsItem || (item.hash != null ? activeToolsHash === item.hash : activeToolsHash === "#procurement"));
            const badgeCount =
              item.label === "Approvals"
                ? pendingApprovals
                : item.label === "Alerts"
                  ? openCriticalAlerts
                  : undefined;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-4 py-3 transition-colors duration-200",
                  isActive ? "bg-sky-600 text-white shadow-lg shadow-sky-200/80" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors duration-200",
                      isActive
                        ? "border-white/15 bg-white/10 text-white"
                        : "border-slate-200/70 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">{item.label}</span>
                </span>
                {badgeCount && badgeCount > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      isActive ? "bg-white/15 text-white" : "bg-slate-200/70 text-slate-700",
                    )}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <p className="panel-label">Workspace Utilities</p>
        <div className="space-y-3">
          {utilityItems.map((item) => {
            const Icon = item.icon;
            const isToolsItem = item.pathname === "/tools";
            const isActive =
              pathname === item.pathname &&
              (!isToolsItem || (item.hash != null ? activeToolsHash === item.hash : activeToolsHash === "#procurement"));
            const badgeCount = item.label === "Knowledge Repository" ? processingFiles : apiAttention;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group block rounded-[1.5rem] border px-4 py-4 transition-colors duration-200",
                  isActive
                    ? "border-sky-200 bg-sky-50/80 shadow-sm"
                    : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl border",
                        isActive ? "border-sky-200 bg-white text-sky-700" : "border-slate-200/70 bg-slate-50 text-slate-600",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                  {badgeCount > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        item.label === "Knowledge Repository"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="surface-azure p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 ring-azure">
              <Hospital className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{dataset.hospital.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{dataset.hospital.location}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/80 px-3 py-3 text-sm text-slate-700">
            {activeExecution ? "AI execution is active and monitoring live risk conditions." : "AI workspace is ready for guided operations."}
          </div>
        </div>

        <div className="surface-subtle p-4">
          <p className="panel-label">Active User</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="mt-1 text-sm text-slate-500">{role ?? "Operations"}</p>
        </div>
      </div>
    </aside>
  );
}
