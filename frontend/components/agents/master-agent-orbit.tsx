"use client";

import { Brain, Gauge, GitBranchPlus, Radar, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const orbitAgents = [
  { title: "Operations Agent", subtitle: "Inventory / Supplier / Procurement", x: "10%", y: "24%", icon: ShieldCheck },
  { title: "Intelligence Agent", subtitle: "Forecast / Expiry / Risk", x: "72%", y: "18%", icon: Radar },
  { title: "Decision Agent", subtitle: "Scenario / Cost / Impact", x: "73%", y: "66%", icon: Gauge },
  { title: "Action Agent", subtitle: "Workflow / Notify / Track", x: "12%", y: "68%", icon: GitBranchPlus },
];

export function MasterAgentOrbit() {
  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.1),transparent_52%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {orbitAgents.map((agent, index) => (
          <motion.line
            key={agent.title}
            x1="50"
            y1="50"
            x2={parseFloat(agent.x)}
            y2={parseFloat(agent.y)}
            stroke="rgba(14, 165, 233, 0.26)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            initial={{ pathLength: 0.2, opacity: 0.2 }}
            animate={{ pathLength: 1, opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.2 }}
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 flex h-56 w-56 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.32),rgba(14,165,233,0.1),transparent_72%)]">
        <div className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full border border-sky-100 bg-white shadow-[0_0_60px_rgba(14,165,233,0.25)]">
          <Brain className="h-12 w-12 text-sky-600" />
          <p className="section-title mt-4 text-xl font-semibold text-slate-900">Master Agent</p>
          <Badge tone="sky" className="mt-3">
            Blue Neural Glow
          </Badge>
        </div>
      </div>

      {orbitAgents.map((agent, index) => {
        const Icon = agent.icon;
        return (
          <motion.div
            key={agent.title}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="absolute w-52 rounded-[1.5rem] border border-white/80 bg-white/90 p-4 shadow-lg shadow-sky-100"
            style={{ left: agent.x, top: agent.y }}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-600">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{agent.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">{agent.subtitle}</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

