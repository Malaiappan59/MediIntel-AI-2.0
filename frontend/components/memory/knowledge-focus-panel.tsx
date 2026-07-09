"use client";

import { Database, Download, History, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateLabel, formatDateTime, formatRelativeTime } from "@/lib/experience";
import { cn } from "@/lib/utils";
import type { AuditLogItem, MemoryFile } from "@/types/medintel";

type KnowledgeCitation = {
  id: string;
  headline: string;
  excerpt: string;
  createdAt: string;
  score?: number;
  strategy?: string;
};

type KnowledgeFocusPanelProps = {
  file: MemoryFile | null;
  relatedCitations: KnowledgeCitation[];
  relatedAuditLogs: AuditLogItem[];
  siblingFiles: MemoryFile[];
  canDelete: boolean;
  isDeleting: boolean;
  onOpenFile: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onClearFocus: () => void;
};

function getFileStatusTone(status: MemoryFile["status"]) {
  if (status === "indexed") {
    return "emerald" as const;
  }

  if (status === "processing") {
    return "sky" as const;
  }

  return "amber" as const;
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

function getRepositoryGuidance(file: MemoryFile, citationCount: number) {
  if (file.status === "needs-review") {
    return {
      title: "Review before grounded use",
      detail: "This document is flagged for repository review and should be validated before it supports procurement, policy, or shortage recommendations.",
      badge: "Needs curator review",
      tone: "amber" as const,
    };
  }

  if (file.status === "processing") {
    return {
      title: "Indexing is still in progress",
      detail: "Extraction and indexing are still running. Grounded citations will become available after processing completes.",
      badge: "Indexing in progress",
      tone: "sky" as const,
    };
  }

  if (citationCount > 0) {
    return {
      title: "Already supporting grounded responses",
      detail: "This document is indexed and has already been cited by MediIntel AI in the current workspace history.",
      badge: "Grounded evidence active",
      tone: "emerald" as const,
    };
  }

  return {
    title: "Ready for future grounding",
    detail: "This document is indexed and available for retrieval, but it has not yet appeared in grounded response history.",
    badge: "Ready for retrieval",
    tone: "slate" as const,
  };
}

export function KnowledgeFocusPanel({
  file,
  relatedCitations,
  relatedAuditLogs,
  siblingFiles,
  canDelete,
  isDeleting,
  onOpenFile,
  onDownload,
  onDelete,
  onClearFocus,
}: KnowledgeFocusPanelProps) {
  if (!file) {
    return (
      <Card className="border border-dashed border-sky-200 bg-white/90">
        <CardContent className="space-y-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Database className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="section-title text-xl font-semibold text-slate-950">Focus a knowledge document</p>
            <p className="text-sm leading-6 text-slate-600">
              Select a repository file to inspect its summary, extracted preview, grounded AI citations, and repository audit history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const previewText = file.downloadContent.trim();
  const latestCitation = relatedCitations[0] ?? null;
  const latestAuditLog = relatedAuditLogs[0] ?? null;
  const guidance = getRepositoryGuidance(file, relatedCitations.length);

  return (
    <Card className="border border-sky-100">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle>Focused Knowledge Document</CardTitle>
            <CardDescription>Review repository readiness, AI citation evidence, and recent repository events for the selected document.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClearFocus}>
            <X className="mr-2 h-4 w-4" />
            Clear Focus
          </Button>
        </div>

        <div className="surface-subtle space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-slate-950">{file.filename}</p>
              <p className="text-sm leading-6 text-slate-600">{file.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="slate">{file.category}</Badge>
              <Badge tone={getFileStatusTone(file.status)}>{file.status}</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Uploaded</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateLabel(file.uploadDate)}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDateTime(file.uploadDate)}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Uploaded By</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{file.uploadedBy ?? "Repository curator"}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Repository Size</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{file.sizeLabel}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Retrieval Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{file.status}</p>
              <p className="mt-1 text-sm text-slate-500">{guidance.badge}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Grounded Citations</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{relatedCitations.length} linked responses</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Latest Activity</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{latestAuditLog?.action ?? "Upload received"}</p>
              <p className="mt-1 text-sm text-slate-500">{formatRelativeTime(latestAuditLog?.time ?? file.uploadDate)}</p>
            </div>
          </div>

          <div className="surface-azure space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
              <ShieldCheck className="h-4 w-4" />
              Repository Guidance
            </div>
            <p className="text-sm font-semibold text-slate-950">{guidance.title}</p>
            <p className="text-sm leading-6 text-slate-600">{guidance.detail}</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone={guidance.tone}>{guidance.badge}</Badge>
              {latestCitation ? <Badge tone="sky">Last grounded {formatRelativeTime(latestCitation.createdAt)}</Badge> : <Badge tone="slate">No grounded citations yet</Badge>}
              <Badge tone="slate">{relatedAuditLogs.length} audit entries</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => onDownload(file.id)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {canDelete ? (
              <Button type="button" size="sm" variant="danger" disabled={isDeleting} onClick={() => onDelete(file.id)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Document preview</p>
          </div>
          <div className="surface-subtle max-h-[340px] overflow-y-auto p-4 text-sm leading-7 text-slate-600">
            {previewText.length > 0 ? previewText : "No extracted text is currently available for preview."}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Grounded AI citations</p>
          </div>
          {relatedCitations.length ? (
            <div className="space-y-3">
              {relatedCitations.slice(0, 4).map((citation) => (
                <div key={citation.id} className="surface-subtle space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{citation.headline}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{citation.excerpt}</p>
                    </div>
                    {citation.score != null ? <Badge tone="sky">{Math.round(citation.score * 100)}%</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{formatRelativeTime(citation.createdAt)}</span>
                    {citation.strategy ? <span>{citation.strategy}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              This file has not yet appeared in grounded AI response citations in the current workspace history.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Repository audit history</p>
          </div>
          {relatedAuditLogs.length ? (
            <div className="space-y-3">
              {relatedAuditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className={cn("surface-subtle space-y-2 p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{log.action}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{log.detail}</p>
                    </div>
                    <Badge tone={getAuditStatusTone(log.status)}>{log.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{log.agent}</span>
                    <span>{formatRelativeTime(log.time)}</span>
                    {log.tool ? <span>{log.tool}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              Repository audit entries will appear here after uploads, deletes, or future index maintenance events are recorded.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-950">Related documents</p>
          </div>
          {siblingFiles.length ? (
            <div className="space-y-3">
              {siblingFiles.slice(0, 4).map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="surface-subtle w-full space-y-2 p-4 text-left transition-colors duration-200 hover:bg-sky-50"
                  onClick={() => onOpenFile(candidate.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{candidate.filename}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{candidate.summary}</p>
                    </div>
                    <Badge tone={getFileStatusTone(candidate.status)}>{candidate.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                    <span>{candidate.category}</span>
                    <span>{formatRelativeTime(candidate.uploadDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-subtle p-4 text-sm leading-6 text-slate-600">
              No additional documents are currently grouped under this knowledge category.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
