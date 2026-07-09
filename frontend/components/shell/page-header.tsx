"use client";

import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actionLabel, onAction, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-3">
        {eyebrow ? <p className="panel-label">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="section-title text-3xl font-semibold text-slate-950 sm:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
        </div>
      </div>
      {actionLabel && onAction ? (
        <Button size="lg" onClick={onAction}>
          {actionLabel}
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
