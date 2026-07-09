"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CheckCheck, Clock3, Database, Download, Loader2, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { KnowledgeFocusPanel } from "@/components/memory/knowledge-focus-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppData } from "@/hooks/use-app-data";
import { useAuth } from "@/hooks/use-auth";
import { downloadBlobFile } from "@/lib/download";
import { buildMemoryUrl, formatDateLabel, formatRelativeTime } from "@/lib/experience";
import { hasPermission } from "@/lib/permissions";
import { downloadMemoryFile } from "@/services/medintel-service";
import { cn } from "@/lib/utils";
import type { ChatMessage, MemoryFile } from "@/types/medintel";

const PAGE_SIZE = 7;

function inferKnowledgeCategory(filename: string) {
  const lower = filename.toLowerCase();

  if (lower.includes("contract")) {
    return "Supplier Contracts";
  }
  if (lower.includes("invoice")) {
    return "Invoice";
  }
  if (lower.includes("catalog") || lower.includes("catalogue")) {
    return "Medicine Catalogue";
  }
  if (lower.includes("inventory")) {
    return "Inventory Policy";
  }
  if (lower.includes("policy")) {
    return "Procurement Policy";
  }

  return "Hospital SOP";
}

function getFileStatusTone(status: MemoryFile["status"]) {
  if (status === "indexed") {
    return "emerald" as const;
  }

  if (status === "processing") {
    return "sky" as const;
  }

  return "amber" as const;
}

function normalizeConfidenceScore(value?: number) {
  if (value == null) {
    return undefined;
  }

  return value > 1 ? value / 100 : value;
}

export default function MemoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataset, addFiles, deleteFiles } = useAppData();
  const { permissions, username } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingState, setDeletingState] = useState<{ mode: "single" | "bulk"; fileIds: string[] } | null>(null);
  const focusedFileId = searchParams.get("file");
  const canUpload = hasPermission(permissions, "knowledge.upload");
  const canDelete = hasPermission(permissions, "knowledge.delete");
  const displayName = dataset.settings.user.displayName || username || "Operations Lead";

  useEffect(() => {
    const nextQuery = searchParams.get("q");
    const nextCategory = searchParams.get("category");
    const nextStatus = searchParams.get("status");

    setQuery(nextQuery ?? "");
    setCategory(nextCategory ?? "all");
    setStatusFilter(nextStatus ?? "all");
  }, [searchParams]);

  const categoryOptions = useMemo(() => Array.from(new Set(dataset.files.map((file) => file.category))).sort(), [dataset.files]);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return [...dataset.files]
      .filter((file) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          file.filename.toLowerCase().includes(normalizedQuery) ||
          file.category.toLowerCase().includes(normalizedQuery) ||
          (file.uploadedBy ?? "").toLowerCase().includes(normalizedQuery);

        if (!matchesQuery) {
          return false;
        }
        if (category !== "all" && file.category !== category) {
          return false;
        }
        if (statusFilter !== "all" && file.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => new Date(right.uploadDate).getTime() - new Date(left.uploadDate).getTime());
  }, [category, dataset.files, query, statusFilter]);

  const citationFileIds = useMemo(
    () =>
      new Set(
        dataset.chatHistory.flatMap((message) => (message.role === "assistant" ? (message.sources ?? []).map((source) => source.id) : [])),
      ),
    [dataset.chatHistory],
  );

  const selectedFile = useMemo(
    () => (focusedFileId ? dataset.files.find((file) => file.id === focusedFileId) ?? filteredFiles[0] ?? null : filteredFiles[0] ?? null),
    [dataset.files, filteredFiles, focusedFileId],
  );

  const relatedCitations = useMemo(() => {
    if (!selectedFile) {
      return [];
    }

    return [...dataset.chatHistory]
      .filter((message): message is ChatMessage & { sources: NonNullable<ChatMessage["sources"]> } => message.role === "assistant" && Array.isArray(message.sources))
      .map((message) => ({
        message,
        source:
          message.sources.find((source) => source.id === selectedFile.id) ??
          message.sources.find((source) => source.filename === selectedFile.filename),
      }))
      .filter((entry): entry is { message: ChatMessage; source: NonNullable<ChatMessage["sources"]>[number] } => Boolean(entry.source))
      .sort((left, right) => new Date(right.message.createdAt).getTime() - new Date(left.message.createdAt).getTime())
      .map((entry, index) => ({
        id: `${entry.message.id}-${entry.source.id}-${index}`,
        headline: entry.message.headline ?? "Grounded MediIntel AI response",
        excerpt: entry.source.excerpt,
        createdAt: entry.message.createdAt,
        score: normalizeConfidenceScore(entry.source.score),
        strategy: entry.source.strategy,
      }));
  }, [dataset.chatHistory, selectedFile]);

  const relatedAuditLogs = useMemo(() => {
    if (!selectedFile) {
      return [];
    }

    const normalizedFilename = selectedFile.filename.toLowerCase();
    const seen = new Set<string>();

    return [...dataset.auditLogs]
      .filter((log) => {
        const entityType = log.entityType?.toLowerCase() ?? "";
        const detail = log.detail.toLowerCase();

        return (
          (entityType === "file" && log.entityId === selectedFile.id) ||
          log.entityId === selectedFile.id ||
          detail.includes(normalizedFilename)
        );
      })
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .filter((log) => {
        if (seen.has(log.id)) {
          return false;
        }

        seen.add(log.id);
        return true;
      });
  }, [dataset.auditLogs, selectedFile]);

  const siblingFiles = useMemo(
    () =>
      selectedFile
        ? [...dataset.files]
            .filter((file) => file.category === selectedFile.category && file.id !== selectedFile.id)
            .sort((left, right) => new Date(right.uploadDate).getTime() - new Date(left.uploadDate).getTime())
        : [],
    [dataset.files, selectedFile],
  );

  const categoryDistribution = useMemo(
    () =>
      categoryOptions
        .map((option) => ({
          category: option,
          count: dataset.files.filter((file) => file.category === option).length,
        }))
        .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category)),
    [categoryOptions, dataset.files],
  );

  const repositorySummary = useMemo(() => {
    const sortedFiles = [...dataset.files].sort((left, right) => new Date(right.uploadDate).getTime() - new Date(left.uploadDate).getTime());
    const indexedCount = sortedFiles.filter((file) => file.status === "indexed").length;
    const processingFiles = sortedFiles.filter((file) => file.status === "processing");
    const reviewFiles = sortedFiles.filter((file) => file.status === "needs-review");
    const groundedFiles = sortedFiles.filter((file) => citationFileIds.has(file.id));

    return {
      indexedCount,
      processingCount: processingFiles.length,
      reviewCount: reviewFiles.length,
      categoryCount: new Set(sortedFiles.map((file) => file.category)).size,
      newestFile: sortedFiles[0] ?? null,
      attentionFile: reviewFiles[0] ?? processingFiles[0] ?? sortedFiles[0] ?? null,
      groundedLead: groundedFiles[0] ?? null,
    };
  }, [citationFileIds, dataset.files]);

  const repositoryAuditEvents = useMemo(
    () =>
      [...dataset.auditLogs]
        .filter((log) => {
          const entityType = log.entityType?.toLowerCase() ?? "";
          return entityType === "file" || log.agent === "Knowledge Repository";
        })
        .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime()),
    [dataset.auditLogs],
  );

  const latestRepositoryEvent = repositoryAuditEvents[0] ?? null;
  const repositoryCommandHeadline = repositorySummary.reviewCount
    ? `${repositorySummary.reviewCount} knowledge document${repositorySummary.reviewCount > 1 ? "s" : ""} waiting for curator review`
    : repositorySummary.processingCount
      ? `${repositorySummary.processingCount} knowledge document${repositorySummary.processingCount > 1 ? "s are" : " is"} still being indexed`
      : `${repositorySummary.indexedCount} documents are retrieval-ready for grounded operations`;
  const repositoryCommandDetail = repositorySummary.reviewCount
    ? `${repositorySummary.attentionFile?.filename ?? "The current priority file"} should be reviewed before it is relied on for procurement, policy, or shortage recommendations.`
    : repositorySummary.processingCount
      ? `${repositorySummary.attentionFile?.filename ?? "The current indexing queue"} is still processing. Grounded evidence coverage will expand after indexing completes.`
      : repositorySummary.groundedLead
        ? `${repositorySummary.groundedLead.filename} is already supporting grounded MediIntel AI responses in the current workspace.`
        : "The repository is ready for new grounded workflows. Upload additional SOPs, contracts, and stock reports to widen coverage.";
  const activeScopeLabel = useMemo(() => {
    const parts = [query.trim() ? `Search: "${query.trim()}"` : "All repository documents"];

    parts.push(category !== "all" ? category : "All categories");
    parts.push(statusFilter !== "all" ? statusFilter.replace("-", " ") : "All statuses");

    return parts.join(" | ");
  }, [category, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, query, statusFilter]);

  useEffect(() => {
    const activeFileId = focusedFileId && filteredFiles.some((file) => file.id === focusedFileId) ? focusedFileId : filteredFiles[0]?.id;

    if (!activeFileId) {
      setCurrentPage(1);
      return;
    }

    const activeIndex = filteredFiles.findIndex((file) => file.id === activeFileId);
    if (activeIndex >= 0) {
      setCurrentPage(Math.floor(activeIndex / PAGE_SIZE) + 1);
    }
  }, [filteredFiles, focusedFileId]);

  useEffect(() => {
    const validIds = new Set(dataset.files.map((file) => file.id));
    setSelectedFileIds((current) => current.filter((id) => validIds.has(id)));
  }, [dataset.files]);

  const paginatedFiles = filteredFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleFileIds = paginatedFiles.map((file) => file.id);
  const allVisibleFilesSelected = visibleFileIds.length > 0 && visibleFileIds.every((id) => selectedFileIds.includes(id));
  const selectedFiles = dataset.files.filter((file) => selectedFileIds.includes(file.id));
  const selectedIndexedCount = selectedFiles.filter((file) => file.status === "indexed").length;
  const selectedReferencedCount = selectedFiles.filter((file) => citationFileIds.has(file.id)).length;

  const buildRepositoryUrl = ({
    fileId,
    queryValue = query,
    categoryValue = category,
    statusValue = statusFilter,
  }: {
    fileId?: string | null;
    queryValue?: string;
    categoryValue?: string;
    statusValue?: string;
  } = {}) =>
    buildMemoryUrl(fileId === undefined ? (focusedFileId ?? undefined) : (fileId ?? undefined), {
      category: categoryValue !== "all" ? categoryValue : undefined,
      status: statusValue !== "all" ? statusValue : undefined,
      query: (queryValue ?? "").trim() || undefined,
    });

  const focusFile = (fileId: string) => {
    router.replace(buildRepositoryUrl({ fileId }));
  };

  const clearFocus = () => {
    router.replace(buildRepositoryUrl({ fileId: null }));
  };

  const clearFilters = () => {
    const nextUrl = buildRepositoryUrl({
      fileId: null,
      queryValue: "",
      categoryValue: "all",
      statusValue: "all",
    });

    setQuery("");
    setCategory("all");
    setStatusFilter("all");
    router.replace(nextUrl);
  };

  const applyQuickScope = ({
    queryValue = "",
    categoryValue = "all",
    statusValue = "all",
  }: {
    queryValue?: string;
    categoryValue?: string;
    statusValue?: string;
  }) => {
    setQuery(queryValue);
    setCategory(categoryValue);
    setStatusFilter(statusValue);
    setCurrentPage(1);
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((current) => (current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]));
  };

  const toggleVisibleFiles = () => {
    setSelectedFileIds((current) => {
      if (allVisibleFilesSelected) {
        return current.filter((id) => !visibleFileIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleFileIds]));
    });
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    setIsUploading(true);

    try {
      const createdFiles = await addFiles(
        files.map((file) => ({
          filename: file.name,
          category: inferKnowledgeCategory(file.name),
          sizeLabel: `${Math.max(file.size / 1024 / 1024, 0.2).toFixed(1)} MB`,
          content: "",
          file,
        })),
      );
      const newestFile = createdFiles[createdFiles.length - 1];

      setQuery("");
      setCategory("all");
      setStatusFilter("all");
      router.replace(buildMemoryUrl(newestFile?.id));
    } finally {
      event.target.value = "";
      setIsUploading(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    const { filename, blob } = await downloadMemoryFile(fileId);
    downloadBlobFile(filename, blob);
  };

  const handleDeleteOne = async (fileId: string) => {
    setDeletingState({ mode: "single", fileIds: [fileId] });

    try {
      await deleteFiles([fileId]);
      setSelectedFileIds((current) => current.filter((id) => id !== fileId));

      if (focusedFileId === fileId) {
        clearFocus();
      }
    } finally {
      setDeletingState(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedFileIds.length) {
      return;
    }

    const ids = [...selectedFileIds];
    setDeletingState({ mode: "bulk", fileIds: ids });

    try {
      await deleteFiles(ids);
      setSelectedFileIds([]);

      if (focusedFileId && ids.includes(focusedFileId)) {
        clearFocus();
      }
    } finally {
      setDeletingState(null);
    }
  };

  useEffect(() => {
    const nextFocusedFileId = focusedFileId && filteredFiles.some((file) => file.id === focusedFileId) ? focusedFileId : undefined;
    const targetUrl = buildMemoryUrl(nextFocusedFileId, {
      category: category !== "all" ? category : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      query: query.trim() || undefined,
    });
    const currentUrl = buildMemoryUrl(searchParams.get("file") ?? undefined, {
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      query: searchParams.get("q") ?? undefined,
    });

    if (currentUrl !== targetUrl) {
      router.replace(targetUrl);
    }
  }, [category, filteredFiles, focusedFileId, query, router, searchParams, statusFilter]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Knowledge Repository"
        title="Repository for retrieval-ready operational knowledge"
        description="Manage the hospital files that support grounded AI responses, policy compliance, inventory governance, supplier decision review, and operational traceability."
        actionLabel={canUpload ? "Upload Documents" : undefined}
        onAction={canUpload ? () => fileInputRef.current?.click() : undefined}
      />

      <input ref={fileInputRef} className="hidden" type="file" accept=".txt,.pdf,.docx" multiple onChange={handleUpload} />

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="workspace-glow overflow-hidden">
          <CardContent className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-sky-100/70 blur-3xl" />
            <div className="relative space-y-5">
              <div className="panel-label">Knowledge Operations</div>
              <div className="space-y-3">
                <h2 className="section-title text-3xl font-semibold text-slate-950 sm:text-4xl">Hello {displayName}</h2>
                <p className="text-lg font-medium text-sky-700">Repository Mission</p>
                <p className="max-w-3xl text-base leading-7 text-slate-600">
                  Keep policy, supplier, and inventory intelligence ready for grounded MediIntel AI decisions across procurement, alerts, and operational audits.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Repository Lead</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{displayName}</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Categories Covered</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{repositorySummary.categoryCount} knowledge lanes</p>
                </div>
                <div className="surface-subtle p-4">
                  <p className="text-sm text-slate-500">Latest Upload</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{repositorySummary.newestFile?.filename ?? "No files uploaded"}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {repositorySummary.newestFile
                      ? `${formatRelativeTime(repositorySummary.newestFile.uploadDate)} to the repository`
                      : "Upload operational reference documents to begin grounded coverage."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-sky-100 bg-sky-50/70">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700">
                <Sparkles className="h-4 w-4" />
                Repository Command Brief
              </div>
              <p className="text-2xl font-semibold text-slate-950">{repositoryCommandHeadline}</p>
              <p className="text-sm leading-6 text-slate-600">{repositoryCommandDetail}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Retrieval Ready</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{repositorySummary.indexedCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Review Queue</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{repositorySummary.reviewCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-sky-100 bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Grounded Sources</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{citationFileIds.size}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  applyQuickScope({
                    statusValue: repositorySummary.reviewCount ? "needs-review" : repositorySummary.processingCount ? "processing" : "indexed",
                  })
                }
              >
                <Clock3 className="mr-2 h-4 w-4" />
                Open Priority Queue
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!repositorySummary.attentionFile}
                onClick={() => repositorySummary.attentionFile && focusFile(repositorySummary.attentionFile.id)}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Focus Priority File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Total Files</p>
                <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{dataset.files.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-azure">
                <Database className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">Knowledge documents currently supporting the hospital repository.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Retrieval Ready</p>
                <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{repositorySummary.indexedCount}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">Documents indexed and ready for grounded retrieval and AI evidence lookups.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Grounded Sources</p>
                <p className="section-title mt-3 text-4xl font-semibold text-slate-950">{citationFileIds.size}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">Repository files already cited by grounded MediIntel AI responses.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Attention Queue</p>
                <p className="section-title mt-3 text-4xl font-semibold text-slate-950">
                  {repositorySummary.processingCount + repositorySummary.reviewCount}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">Files still processing or waiting for repository readiness review.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Repository Filters</CardTitle>
              <CardDescription>Filter by filename, category, and indexing status while keeping deep links aligned with the active document focus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 xl:grid-cols-[1.15fr_repeat(2,minmax(0,0.72fr))_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search filename, category, or uploader"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="indexed">Indexed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="needs-review">Needs review</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>

              <div className="surface-subtle flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Active Repository Scope</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{activeScopeLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {latestRepositoryEvent
                      ? `${latestRepositoryEvent.action} ${formatRelativeTime(latestRepositoryEvent.time)} by ${latestRepositoryEvent.agent}.`
                      : "Use the shortcuts to jump directly into indexing, review, or grounded evidence lanes."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!repositorySummary.reviewCount}
                    onClick={() => applyQuickScope({ statusValue: "needs-review" })}
                  >
                    Needs Review
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!repositorySummary.processingCount}
                    onClick={() => applyQuickScope({ statusValue: "processing" })}
                  >
                    Indexing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!repositorySummary.groundedLead && !repositorySummary.newestFile}
                    onClick={() => {
                      const targetFile = repositorySummary.groundedLead ?? repositorySummary.newestFile;

                      if (targetFile) {
                        focusFile(targetFile.id);
                      }
                    }}
                  >
                    Focus Live Source
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {categoryDistribution.length ? (
                  categoryDistribution.map((entry) => (
                    <Badge key={entry.category} tone={entry.count >= 4 ? "sky" : "slate"}>
                      {entry.category} {entry.count}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="slate">No repository categories available</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repository Queue</CardTitle>
              <CardDescription>Select knowledge files for review, bulk deletion, download, or document focus inspection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="surface-subtle flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  {canDelete ? (
                    <label className="flex items-center gap-3 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                        checked={allVisibleFilesSelected}
                        disabled={!visibleFileIds.length}
                        onChange={() => toggleVisibleFiles()}
                      />
                      Select visible files
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="sky">{filteredFiles.length} filtered</Badge>
                    <Badge tone={selectedFileIds.length ? "amber" : "slate"}>{selectedFileIds.length} selected</Badge>
                    <Badge tone={selectedReferencedCount > 0 ? "emerald" : "slate"}>{selectedReferencedCount} cited by AI</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canUpload ? (
                    <Button type="button" variant="secondary" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                      {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {isUploading ? "Uploading..." : "Upload Files"}
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={!selectedFileIds.length || !!deletingState}
                      onClick={() => void handleDeleteSelected()}
                    >
                      {deletingState?.mode === "bulk" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete Selected
                    </Button>
                  ) : null}
                </div>
              </div>

              {selectedFileIds.length ? (
                <div className="surface-azure flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sky-700 ring-azure">
                      <CheckCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedFileIds.length} repository files ready for action</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedIndexedCount} indexed files selected across {category === "all" ? "all categories" : category}.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="emerald">{selectedIndexedCount} indexed</Badge>
                    <Badge tone={selectedReferencedCount > 0 ? "sky" : "slate"}>{selectedReferencedCount} grounded</Badge>
                  </div>
                </div>
              ) : null}

              <div className="table-shell overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      {canDelete ? <th className="px-4 py-4" /> : null}
                      <th className="px-4 py-4">File Name</th>
                      <th className="px-4 py-4">Category</th>
                      <th className="px-4 py-4">Uploaded By</th>
                      <th className="px-4 py-4">Date</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedFiles.length ? (
                      paginatedFiles.map((file) => {
                        const isFocused = file.id === focusedFileId || file.id === selectedFile?.id;
                        const isDeleting = deletingState?.fileIds.includes(file.id) ?? false;

                        return (
                          <tr
                            key={file.id}
                            className={cn("cursor-pointer transition-colors duration-200 hover:bg-slate-50", isFocused && "bg-sky-50/70")}
                            onClick={() => focusFile(file.id)}
                          >
                            {canDelete ? (
                              <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                                  checked={selectedFileIds.includes(file.id)}
                                  onChange={() => toggleFileSelection(file.id)}
                                />
                              </td>
                            ) : null}
                            <td className="px-4 py-4">
                              <div className="space-y-2">
                                <p className="font-semibold text-slate-950">{file.filename}</p>
                                <p className="text-sm leading-6 text-slate-500">{file.summary}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                                  <span>{file.sizeLabel}</span>
                                  {citationFileIds.has(file.id) ? <span>Grounded evidence source</span> : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-slate-700">{file.category}</td>
                            <td className="px-4 py-4 text-sm text-slate-700">{file.uploadedBy ?? dataset.settings.user.displayName}</td>
                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-slate-700">{formatDateLabel(file.uploadDate)}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{formatRelativeTime(file.uploadDate)}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Badge tone={getFileStatusTone(file.status)}>{file.status}</Badge>
                                {citationFileIds.has(file.id) ? <Badge tone="sky">Grounded</Badge> : null}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button type="button" size="sm" variant="secondary" onClick={() => focusFile(file.id)}>
                                  Inspect
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => void handleDownload(file.id)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </Button>
                                {canDelete ? (
                                  <Button type="button" size="sm" variant="ghost" disabled={isDeleting} onClick={() => void handleDeleteOne(file.id)}>
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Delete
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={canDelete ? 7 : 6} className="px-4 py-12 text-center text-sm text-slate-500">
                          No documents match the current repository filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredFiles.length ? (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredFiles.length}
                  currentCount={paginatedFiles.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="documents"
                  onPageChange={setCurrentPage}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <KnowledgeFocusPanel
          file={selectedFile}
          relatedCitations={relatedCitations}
          relatedAuditLogs={relatedAuditLogs}
          siblingFiles={siblingFiles}
          canDelete={canDelete}
          isDeleting={selectedFile ? deletingState?.fileIds.includes(selectedFile.id) ?? false : false}
          onOpenFile={focusFile}
          onDownload={(fileId) => void handleDownload(fileId)}
          onDelete={(fileId) => void handleDeleteOne(fileId)}
          onClearFocus={clearFocus}
        />
      </div>
    </section>
  );
}
