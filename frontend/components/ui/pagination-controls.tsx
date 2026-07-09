"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  currentCount: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  currentCount,
  pageSize,
  itemLabel,
  onPageChange,
}: PaginationControlsProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : start + Math.max(currentCount - 1, 0);

  return (
    <div className="surface-subtle flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Badge tone="slate">
          Page {Math.min(currentPage, Math.max(totalPages, 1))} of {Math.max(totalPages, 1)}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
