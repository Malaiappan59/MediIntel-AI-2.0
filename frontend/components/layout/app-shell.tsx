"use client";

import { motion } from "framer-motion";
import { useAppData } from "@/hooks/use-app-data";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { dataset, loadError } = useAppData();
  const density = dataset.settings.theme.density;

  return (
    <div
      data-density={density}
      data-theme-mode={dataset.settings.theme.mode}
      className={cn("min-h-screen bg-medical-gradient px-3 py-3 sm:px-5 sm:py-5", density === "compact" && "text-[15px]")}
    >
      <div className={cn("mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1720px] gap-5 lg:grid-cols-[298px_1fr]", density === "compact" && "gap-4")}>
        <div className="lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <Sidebar />
        </div>
        <div className={cn("flex min-w-0 flex-col gap-5", density === "compact" && "gap-4")}>
          <Topbar />
          {loadError ? (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {loadError}
            </div>
          ) : null}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="flex-1"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
