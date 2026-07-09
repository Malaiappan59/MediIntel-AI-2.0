"use client";

import { ArrowUpRight, Download, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatRelativeTime } from "@/lib/experience";
import { cn } from "@/lib/utils";
import type { ChatAction, ChatMessage, OperationalTraceReference } from "@/types/medintel";

type AgentMessageCardProps = {
  message: ChatMessage;
  onDownloadSource?: (sourceId: string) => void | Promise<void>;
  onOpenSource?: (sourceId: string) => void | Promise<void>;
  onTraceNavigate?: (reference: OperationalTraceReference) => void | Promise<void>;
  onAction?: (action: ChatAction, message: ChatMessage) => void | Promise<void>;
};

function sourceStrategyLabel(strategy?: string) {
  return strategy === "lexical-fallback" ? "Fallback Match" : "Indexed Source";
}

function formatSourceScore(score?: number) {
  if (score == null) {
    return null;
  }

  const normalized = score > 1 ? score : score * 100;
  return `${Math.round(normalized)}% relevance`;
}

function actionVariant(tone?: ChatAction["tone"]) {
  return tone === "primary" ? "default" : "secondary";
}

function runtimeTone(mode?: ChatMessage["runtimeMode"]) {
  return mode === "degraded" ? "amber" : "emerald";
}

function runtimeLabel(mode?: ChatMessage["runtimeMode"]) {
  return mode === "degraded" ? "Safeguarded mode" : "Live mode";
}

function traceActionLabel(reference: OperationalTraceReference) {
  if (reference.kind === "audit") {
    return "Open Audit";
  }

  if (reference.kind === "approval") {
    return "Open Approval";
  }

  return "Open Procurement";
}

export function AgentMessageCard({ message, onDownloadSource, onOpenSource, onTraceNavigate, onAction }: AgentMessageCardProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[88%] rounded-[1.75rem] bg-slate-950 px-5 py-4 text-white shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">You</p>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{formatRelativeTime(message.createdAt)}</p>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-100">{message.content}</p>
      </div>
    );
  }

  return (
    <Card className="workspace-glow">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-semibold">MediIntel AI</p>
            </div>
            {message.headline ? <h3 className="section-title text-2xl font-semibold text-slate-950">{message.headline}</h3> : null}
            <p className="text-sm leading-7 text-slate-600">{message.content}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {message.confidence != null ? <Badge tone="sky">{Math.round(message.confidence * 100)}% confidence</Badge> : null}
            {message.runtimeMode ? <Badge tone={runtimeTone(message.runtimeMode)}>{runtimeLabel(message.runtimeMode)}</Badge> : null}
            <Badge tone="slate">{formatDateTime(message.createdAt)}</Badge>
          </div>
        </div>

        {message.warnings?.length ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message.warnings[0]}
          </div>
        ) : null}

        {message.metrics?.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {message.metrics.map((metric) => (
              <div key={metric.label} className="surface-subtle p-4">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="section-title mt-3 text-2xl font-semibold text-slate-950">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {message.contributions?.length ? (
          <div className="space-y-3">
            {message.contributions.map((contribution) => (
              <div key={contribution.id} className="surface-subtle p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{contribution.agent}</p>
                  <Badge tone={contribution.status === "attention" ? "amber" : contribution.status === "running" ? "sky" : "emerald"}>
                    {contribution.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-900">{contribution.summary}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{contribution.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        {message.table ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">{message.table.title}</p>
            <div className="table-shell overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    {message.table.columns.map((column) => (
                      <th
                        key={column.key}
                        className={cn("px-4 py-4", column.align === "right" ? "text-right" : "text-left")}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {message.table.rows.map((row, rowIndex) => (
                    <tr key={`${message.id}-row-${rowIndex}`}>
                      {message.table?.columns.map((column) => (
                        <td
                          key={`${message.id}-${column.key}-${rowIndex}`}
                          className={cn("px-4 py-4 text-sm text-slate-700", column.align === "right" ? "text-right" : "text-left")}
                        >
                          {String(row[column.key] ?? "--")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {message.followUpActions?.length && onAction ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Response Actions</p>
              <Badge tone="slate">{message.followUpActions.length} action{message.followUpActions.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.followUpActions.map((action) => (
                <Button
                  key={`${message.id}-${action.id}`}
                  variant={actionVariant(action.tone)}
                  size="sm"
                  type="button"
                  onClick={() => void onAction(action, message)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {message.sources?.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Grounding Sources</p>
              <Badge tone="slate">{message.sources.length} document{message.sources.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {message.sources.map((source) => {
                const sourceScoreLabel = formatSourceScore(source.score);

                return (
                  <div key={`${message.id}-${source.id}`} className="surface-subtle p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-950">{source.filename}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{source.category}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sourceScoreLabel ? <Badge tone="sky">{sourceScoreLabel}</Badge> : null}
                        <Badge tone="slate">{sourceStrategyLabel(source.strategy)}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{source.excerpt}</p>
                    {onOpenSource || onDownloadSource ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {onOpenSource ? (
                          <Button variant="outline" size="sm" type="button" onClick={() => void onOpenSource(source.id)}>
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Open In Repository
                          </Button>
                        ) : null}
                        {onDownloadSource ? (
                          <Button variant="ghost" size="sm" type="button" onClick={() => void onDownloadSource(source.id)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Source
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {message.operationalTrace?.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Operational Trace</p>
              <Badge tone="slate">{message.operationalTrace.length} linked record{message.operationalTrace.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {message.operationalTrace.map((reference) => (
                <div key={`${message.id}-${reference.kind}-${reference.id}`} className="surface-subtle p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-950">{reference.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{reference.id}</p>
                    </div>
                    <Badge tone={reference.kind === "audit" ? "slate" : reference.kind === "approval" ? "amber" : "sky"}>{reference.view}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{reference.description}</p>
                  {onTraceNavigate ? (
                    <Button className="mt-3" variant="ghost" size="sm" type="button" onClick={() => void onTraceNavigate(reference)}>
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      {traceActionLabel(reference)}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {message.reasoning ? (
          <div className="surface-azure p-4">
            <p className="text-sm font-semibold text-slate-900">Reasoning</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message.reasoning}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
