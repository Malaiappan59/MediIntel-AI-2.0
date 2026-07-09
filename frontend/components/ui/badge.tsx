import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "sky" | "amber" | "rose" | "emerald" | "slate";
};

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  sky: "border-sky-100 bg-sky-50 text-sky-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Badge({ className, tone = "slate", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
