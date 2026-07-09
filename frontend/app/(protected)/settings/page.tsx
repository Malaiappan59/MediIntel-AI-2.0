"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Bot, Building2, Gauge, History, LogOut, RotateCcw, Save, ShieldCheck, Sparkles, UserRound, Workflow } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { formatDateTime, formatRelativeTime } from "@/lib/experience";
import type { SettingsState } from "@/types/medintel";

const timezoneOptions = ["Asia/Kolkata", "Asia/Calcutta", "UTC", "Europe/London", "America/New_York"];
const refreshOptions = ["15 seconds", "30 sec", "1 min", "5 min"];

const notificationPreferenceOptions = [
  {
    key: "email",
    label: "Email notifications",
    description: "Route alert digests and approval escalations to the configured operations mailbox.",
  },
  {
    key: "sms",
    label: "SMS notifications",
    description: "Send urgent operational signals to mobile responders when faster outreach is required.",
  },
  {
    key: "criticalOnly",
    label: "Critical alerts only",
    description: "Reduce notification noise by routing only critical severity incidents outside the app shell.",
  },
] satisfies Array<{
  key: keyof SettingsState["notifications"];
  label: string;
  description: string;
}>;

const aiPreferenceOptions = [
  {
    key: "autopilotEnabled",
    label: "Autonomous assistance",
    description: "Allow MediIntel AI to continue monitoring, recommending, and drafting operational actions alongside the user.",
  },
  {
    key: "ragEnabled",
    label: "Knowledge retrieval",
    description: "Ground AI responses against uploaded SOPs, contracts, inventory references, and other repository sources.",
  },
] satisfies Array<{
  key: keyof Pick<SettingsState["ai"], "autopilotEnabled" | "ragEnabled">;
  label: string;
  description: string;
}>;

export default function SettingsPage() {
  const { logout, username } = useAuth();
  const { dataset, updateSettings, settingsSavedAt } = useAppData();
  const [settings, setSettings] = useState<SettingsState>(dataset.settings);

  useEffect(() => {
    setSettings(dataset.settings);
  }, [dataset.settings]);

  const hasUnsavedChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(dataset.settings), [settings, dataset.settings]);
  const displayName = settings.user.displayName.trim() || username || "Operations Lead";
  const notificationRoutes = [settings.notifications.email ? "Email" : null, settings.notifications.sms ? "SMS" : null].filter(
    (route): route is string => Boolean(route),
  );
  const notificationSummary = notificationRoutes.length ? notificationRoutes.join(" + ") : "In-app only";
  const statusTone: "amber" | "emerald" | "sky" = hasUnsavedChanges ? "amber" : settingsSavedAt ? "emerald" : "sky";
  const statusLabel = hasUnsavedChanges ? "Unsaved Changes" : settingsSavedAt ? "Saved Locally" : "Workspace Ready";
  const currentDensityLabel = settings.theme.density === "compact" ? "Compact shell density" : "Comfortable shell density";
  const pendingApprovals = dataset.orders.filter((order) => order.status === "pending-approval" || order.status === "modified").length;
  const openAlerts = dataset.alerts.filter((alert) => alert.status === "open").length;
  const criticalAlerts = dataset.alerts.filter((alert) => alert.status === "open" && alert.severity === "critical").length;
  const indexedFiles = dataset.files.filter((file) => file.status === "indexed").length;
  const repositoryCoverage = dataset.files.length ? Math.round((indexedFiles / dataset.files.length) * 100) : 0;
  const apiAttentionCount = dataset.apis.filter((api) => api.status !== "healthy").length;
  const operatorAuditCount = dataset.auditLogs.filter((log) => log.user === displayName).length;
  const aiPostureLabel = settings.ai.autopilotEnabled
    ? settings.ai.ragEnabled
      ? "Autonomous with grounded retrieval"
      : "Autonomous without retrieval grounding"
    : settings.ai.ragEnabled
      ? "Human review with grounded retrieval"
      : "Human-in-the-loop only";
  const aiPostureDetail = settings.ai.autopilotEnabled
    ? `MediIntel AI can keep assisting continuously, with recommendations beneath ${settings.ai.confidenceThreshold}% still requiring human judgment.`
    : `Operational recommendations stay visible, but users remain fully responsible for execution decisions below and above ${settings.ai.confidenceThreshold}% confidence.`;
  const settingsCommandHeadline = hasUnsavedChanges
    ? "Configuration updates are waiting to be applied to the active workspace"
    : settings.ai.autopilotEnabled
      ? "Governance posture is aligned for continuous AI-assisted operations"
      : "Human-in-the-loop governance is currently enforced across MediIntel";
  const settingsCommandDetail = hasUnsavedChanges
    ? "Review the updated controls, save them locally, and propagate the new workspace posture across dashboard, AI, procurement, repository, and audit views."
    : `${displayName} is operating ${settings.general.workspaceName} with ${notificationSummary} routing, ${settings.general.refreshInterval} refresh cadence, and ${aiPostureLabel.toLowerCase()}.`;

  const handleSave = () => {
    updateSettings(settings);
  };

  const handleReset = () => {
    setSettings(dataset.settings);
  };

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Operational governance and workspace controls"
        description="Manage hospital information, user identity, alert routing, and MediIntel AI operating preferences while preserving the current application behavior."
      />

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="workspace-glow overflow-hidden">
          <CardContent className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-sky-100/70 blur-3xl" />
            <div className="relative space-y-5">
              <div className="panel-label">Governance Center</div>
              <div className="space-y-3">
                <h2 className="section-title text-3xl font-semibold text-slate-950 sm:text-4xl">Hello {displayName}</h2>
                <p className="text-lg font-medium text-sky-700">Configuration Mission</p>
                <p className="max-w-3xl text-base leading-7 text-slate-600">
                  Configure the operational rules that shape how MediIntel monitors the hospital, routes critical signals, surfaces AI reasoning, and
                  personalizes the workspace for each operator.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Workspace</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{settings.general.workspaceName}</p>
                  <p className="mt-2 text-sm text-slate-600">{currentDensityLabel}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Facility</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{settings.hospital.facilityName}</p>
                  <p className="mt-2 text-sm text-slate-600">{settings.hospital.city}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Refresh Cadence</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{settings.general.refreshInterval}</p>
                  <p className="mt-2 text-sm text-slate-600">{settings.general.timezone}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-100 bg-sky-50/70">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <ShieldCheck className="h-4 w-4" />
                  Settings Command Brief
                </div>
                <Badge tone={statusTone}>{statusLabel}</Badge>
              </div>
              <p className="text-2xl font-semibold text-slate-950">{settingsCommandHeadline}</p>
              <p className="text-sm leading-6 text-slate-600">{settingsCommandDetail}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Save State</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{statusLabel}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Alert Routing</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{notificationSummary}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">AI Posture</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{settings.ai.confidenceThreshold}%</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" disabled={!hasUnsavedChanges} onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                {!hasUnsavedChanges && settingsSavedAt ? "Saved" : "Save Settings"}
              </Button>
              <Button type="button" size="lg" variant="secondary" disabled={!hasUnsavedChanges} onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Changes
              </Button>
              <div className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-white/90 px-4 py-2 text-sm text-slate-600">
                <History className="h-4 w-4 text-sky-700" />
                {settingsSavedAt ? `Last saved ${formatRelativeTime(settingsSavedAt)}` : "Awaiting first local save"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Workspace Scope</p>
                <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{settings.general.workspaceName}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-azure">
                <Workflow className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{settings.general.timezone} with {settings.general.refreshInterval} refresh cadence.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Facility Coverage</p>
                <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{dataset.inventory.length} medicines</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{dataset.suppliers.length} suppliers operate under {settings.hospital.facilityName}.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Alert Routing</p>
                <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{criticalAlerts} critical</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <BellRing className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{openAlerts} open alerts currently follow the {notificationSummary} routing policy.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Knowledge Readiness</p>
                <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{repositoryCoverage}%</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{indexedFiles} of {dataset.files.length} repository files are retrieval-ready for AI grounding.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>General Workspace</CardTitle>
              <CardDescription>Workspace naming, timezone, refresh cadence, and shell density applied across the platform shell.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-azure space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <Gauge className="h-4 w-4" />
                  Workspace Summary
                </div>
                <p className="text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-slate-950">{settings.general.workspaceName}</span> is running in{" "}
                  <span className="font-semibold text-slate-950">{settings.general.timezone}</span> with{" "}
                  <span className="font-semibold text-slate-950">{settings.general.refreshInterval}</span> refresh cadence and{" "}
                  <span className="font-semibold text-slate-950">{currentDensityLabel.toLowerCase()}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="sky">{settings.general.timezone}</Badge>
                  <Badge tone="slate">{settings.general.refreshInterval}</Badge>
                  <Badge tone="slate">{settings.theme.mode === "light" ? "Light mode" : "System mode"}</Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    value={settings.general.workspaceName}
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, general: { ...current.general, workspaceName: event.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace-timezone">Timezone</Label>
                  <Select
                    value={settings.general.timezone}
                    onValueChange={(value) =>
                      setSettings((current) => ({ ...current, general: { ...current.general, timezone: value } }))
                    }
                  >
                    <SelectTrigger id="workspace-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="refresh-interval">Refresh Interval</Label>
                  <Select
                    value={settings.general.refreshInterval}
                    onValueChange={(value) =>
                      setSettings((current) => ({ ...current, general: { ...current.general, refreshInterval: value } }))
                    }
                  >
                    <SelectTrigger id="refresh-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {refreshOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="theme-density">Density</Label>
                  <Select
                    value={settings.theme.density}
                    onValueChange={(value) =>
                      setSettings((current) => ({ ...current, theme: { ...current.theme, density: value as SettingsState["theme"]["density"] } }))
                    }
                  >
                    <SelectTrigger id="theme-density">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme-mode">Theme Mode</Label>
                <Select
                  value={settings.theme.mode}
                  onValueChange={(value) =>
                    setSettings((current) => ({ ...current, theme: { ...current.theme, mode: value as SettingsState["theme"]["mode"] } }))
                  }
                >
                  <SelectTrigger id="theme-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hospital Information</CardTitle>
              <CardDescription>Facility identity and escalation routing that support operational continuity across alerts and approvals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-subtle space-y-3 p-4">
                <p className="text-sm font-semibold text-slate-950">Operational Escalation Context</p>
                <p className="text-sm leading-6 text-slate-600">
                  {criticalAlerts} critical alerts and {pendingApprovals} pending approvals are currently governed by the hospital routing details saved for{" "}
                  <span className="font-semibold text-slate-950">{settings.hospital.facilityName}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">{criticalAlerts} critical alerts</Badge>
                  <Badge tone="sky">{pendingApprovals} pending approvals</Badge>
                  <Badge tone="slate">{settings.hospital.city}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="facility-name">Facility Name</Label>
                <Input
                  id="facility-name"
                  value={settings.hospital.facilityName}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, hospital: { ...current.hospital, facilityName: event.target.value } }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hospital-city">City</Label>
                <Input
                  id="hospital-city"
                  value={settings.hospital.city}
                  onChange={(event) => setSettings((current) => ({ ...current, hospital: { ...current.hospital, city: event.target.value } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalation-email">Escalation Email</Label>
                <Input
                  id="escalation-email"
                  value={settings.hospital.escalationEmail}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, hospital: { ...current.hospital, escalationEmail: event.target.value } }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Preferences</CardTitle>
              <CardDescription>Set the operating posture for MediIntel AI without altering backend orchestration, routing, or model contracts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="surface-azure space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <Bot className="h-4 w-4" />
                  AI Governance Summary
                </div>
                <p className="text-sm font-semibold text-slate-950">{aiPostureLabel}</p>
                <p className="text-sm leading-6 text-slate-600">{aiPostureDetail}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={settings.ai.autopilotEnabled ? "emerald" : "amber"}>
                    {settings.ai.autopilotEnabled ? "Autonomous assistance on" : "Autonomous assistance off"}
                  </Badge>
                  <Badge tone={settings.ai.ragEnabled ? "sky" : "amber"}>
                    {settings.ai.ragEnabled ? "Knowledge retrieval on" : "Knowledge retrieval off"}
                  </Badge>
                  <Badge tone="slate">{settings.ai.confidenceThreshold}% confidence threshold</Badge>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-3">
                  {aiPreferenceOptions.map((option) => (
                    <label key={option.key} className="surface-subtle flex items-start justify-between gap-4 px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{option.label}</p>
                        <p className="text-sm leading-6 text-slate-600">{option.description}</p>
                      </div>
                      <input
                        checked={settings.ai[option.key]}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                        type="checkbox"
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            ai: { ...current.ai, [option.key]: event.target.checked },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="confidence-threshold">Confidence Threshold</Label>
                    <Input
                      id="confidence-threshold"
                      type="number"
                      value={settings.ai.confidenceThreshold}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          ai: { ...current.ai, confidenceThreshold: Number(event.target.value) || 0 },
                        }))
                      }
                    />
                  </div>
                  <div className="surface-subtle p-4 text-sm leading-6 text-slate-700">
                    MediIntel AI will continue surfacing recommendations while clearly signaling low-confidence paths beneath{" "}
                    <span className="font-semibold text-slate-950">{settings.ai.confidenceThreshold}%</span> for human review.
                  </div>
                  <div className="surface-subtle p-4 text-sm leading-6 text-slate-700">
                    {apiAttentionCount} API integration{apiAttentionCount === 1 ? "" : "s"} currently require attention. Governance settings should reflect
                    how much operational autonomy is appropriate while external dependencies are degraded.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>Authenticated identity displayed across dashboard, procurement, alerts, repository, AI, and audit views.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-azure space-y-3 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                  <UserRound className="h-4 w-4" />
                  Identity Propagation
                </div>
                <p className="text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-slate-950">{displayName}</span> is the visible operator identity used throughout the workspace,
                  including AI greetings, repository ownership, procurement requests, and audit logging.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="sky">{settings.user.role}</Badge>
                  <Badge tone="slate">{settings.user.team}</Badge>
                  <Badge tone="emerald">{operatorAuditCount} audit entries</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-name">Authenticated Account</Label>
                <Input id="account-name" value={username ?? displayName} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={settings.user.displayName}
                  onChange={(event) => setSettings((current) => ({ ...current, user: { ...current.user, displayName: event.target.value } }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="user-role">Role</Label>
                  <Input
                    id="user-role"
                    value={settings.user.role}
                    onChange={(event) => setSettings((current) => ({ ...current, user: { ...current.user, role: event.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-team">Team</Label>
                  <Input
                    id="user-team"
                    value={settings.user.team}
                    onChange={(event) => setSettings((current) => ({ ...current, user: { ...current.user, team: event.target.value } }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Control where operational signals are routed and how much noise reaches the response teams.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-subtle space-y-3 p-4">
                <p className="text-sm font-semibold text-slate-950">Routing Summary</p>
                <p className="text-sm leading-6 text-slate-600">
                  Alerts are currently routed through <span className="font-semibold text-slate-950">{notificationSummary}</span> with{" "}
                  <span className="font-semibold text-slate-950">
                    {settings.notifications.criticalOnly ? "critical-only" : "all-severity"}
                  </span>{" "}
                  outbound policy.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">{criticalAlerts} critical open</Badge>
                  <Badge tone="sky">{openAlerts} total open</Badge>
                  <Badge tone="slate">{notificationSummary}</Badge>
                </div>
              </div>

              {notificationPreferenceOptions.map((option) => (
                <label key={option.key} className="surface-subtle flex items-start justify-between gap-4 px-4 py-4">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{option.label}</p>
                    <p className="text-sm leading-6 text-slate-600">{option.description}</p>
                  </div>
                  <input
                    checked={settings.notifications[option.key]}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                    type="checkbox"
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        notifications: { ...current.notifications, [option.key]: event.target.checked },
                      }))
                    }
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Secure Session</CardTitle>
              <CardDescription>Review save status, current account context, and sign out from the MediIntel workspace when needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Current Operator</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{displayName}</p>
                  <p className="mt-2 text-sm text-slate-600">{settings.user.role}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Local Save Status</p>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{statusLabel}</p>
                  <p className="mt-2 text-sm text-slate-600">{settingsSavedAt ? formatDateTime(settingsSavedAt) : "No local save recorded yet"}</p>
                </div>
              </div>

              <div className="surface-azure p-4 text-sm leading-6 text-slate-700">
                Signing out ends the authenticated session while leaving the current local settings profile available for the next authenticated return to this
                workspace.
              </div>

              <Button type="button" size="lg" variant="ghost" onClick={() => void logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
