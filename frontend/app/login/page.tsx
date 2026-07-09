"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ActivitySquare, ArrowRight, BrainCircuit, Hospital, ShieldCheck, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME, APP_TAGLINE, roles } from "@/lib/constants";
import type { UserRole } from "@/types/auth";

const loadingSteps = ["Authenticating", "Connecting AI Agents", "Loading Hospital Digital Twin", "Preparing Workspace", "Redirecting..."];

const featureCards = [
  {
    title: "Predict",
    description: "Forecast shortages before patient care is exposed to supply disruption.",
    icon: BrainCircuit,
  },
  {
    title: "Prevent",
    description: "Recommend grounded interventions with policy, alert, and approval context.",
    icon: ShieldCheck,
  },
  {
    title: "Procure",
    description: "Accelerate replenishment workflows with enterprise procurement visibility.",
    icon: ShoppingCart,
  },
] as const;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { login, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = searchParams.get("redirect") ?? "/dashboard";
    }
  }, [isAuthenticated, searchParams]);

  useEffect(() => {
    if (!isSubmitting) {
      setLoadingStepIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 550);

    return () => window.clearInterval(intervalId);
  }, [isSubmitting]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login({
        username: username.trim(),
        password,
        role,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginPageShell
      formContent={{
        username,
        password,
        role,
        setUsername,
        setPassword,
        setRole,
        isSubmitting,
        handleSubmit,
        errorMessage,
        loadingLabel: loadingSteps[loadingStepIndex],
      }}
    />
  );
}

function LoginPageShell({
  formContent,
}: {
  formContent?: {
    username: string;
    password: string;
    role: UserRole;
    setUsername: (value: string) => void;
    setPassword: (value: string) => void;
    setRole: (value: UserRole) => void;
    isSubmitting: boolean;
    errorMessage: string | null;
    loadingLabel: string;
    handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  };
}) {
  return (
    <main className="min-h-screen bg-medical-gradient px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1680px] overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-panel lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-slate-50/80 px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-12">
          <div className="absolute inset-0 healthcare-grid opacity-70" />
          <div className="absolute right-[-120px] top-[-40px] h-72 w-72 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="absolute bottom-[-100px] left-[-80px] h-72 w-72 rounded-full bg-white blur-3xl" />

          <div className="relative flex h-full flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-sky-600 text-white shadow-lg shadow-sky-200/80">
                  <ActivitySquare className="h-6 w-6" />
                </div>
                <div>
                  <p className="section-title text-3xl font-semibold text-slate-950">{APP_NAME}</p>
                  <p className="mt-1 text-sm font-medium text-sky-700">{APP_TAGLINE}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="section-title max-w-2xl text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">
                  Enterprise AI Platform for Healthcare Inventory Management
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600">
                  Predict shortages, prevent disruption, and procure with traceable enterprise AI workflows.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;

                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: 0.06 * index }}
                      className="surface-card p-5"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-azure">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-950">{feature.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.2 }}
                className="surface-card overflow-hidden p-6"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200/60">
                        <Hospital className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Hospital Operations</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">Clinical Continuity Command Center</p>
                      </div>
                    </div>
                    <p className="max-w-xl text-sm leading-6 text-slate-600">
                      Unified inventory intelligence, procurement action, and operational review in one secure healthcare workspace.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Coverage</p>
                        <p className="mt-3 text-2xl font-semibold text-slate-950">24/7</p>
                        <p className="mt-2 text-sm text-slate-500">Continuous monitoring</p>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Focus</p>
                        <p className="mt-3 text-2xl font-semibold text-slate-950">100+</p>
                        <p className="mt-2 text-sm text-slate-500">Medicine continuity signals</p>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Control</p>
                        <p className="mt-3 text-2xl font-semibold text-slate-950">RBAC</p>
                        <p className="mt-2 text-sm text-slate-500">Audit-ready access posture</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 xl:w-[360px]">
                    <div className="relative rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-sm">
                      <div className="absolute inset-x-6 top-10 h-px bg-slate-200" />
                      <div className="absolute inset-x-6 top-1/2 h-px bg-slate-200" />
                      <div className="absolute left-1/2 top-6 bottom-6 w-px -translate-x-1/2 bg-slate-200" />

                      <div className="relative grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Inventory</p>
                          <p className="mt-3 text-lg font-semibold text-slate-950">Low stock watch</p>
                          <p className="mt-2 text-sm text-slate-500">Priority medicines monitored continuously.</p>
                        </div>
                        <div className="rounded-[1.4rem] border border-slate-200/70 bg-sky-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Intelligence</p>
                          <p className="mt-3 text-lg font-semibold text-slate-950">Demand forecast</p>
                          <p className="mt-2 text-sm text-slate-500">Trend analysis aligned to operational risk.</p>
                        </div>
                        <div className="rounded-[1.4rem] border border-slate-200/70 bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approvals</p>
                          <p className="mt-3 text-lg font-semibold text-slate-950">Decision queue</p>
                          <p className="mt-2 text-sm text-slate-500">Procurement actions awaiting reviewer sign-off.</p>
                        </div>
                        <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Procurement</p>
                          <p className="mt-3 text-lg font-semibold text-slate-950">Supplier execution</p>
                          <p className="mt-2 text-sm text-slate-500">Lead times and fulfillment posture tracked live.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-8 text-sm text-slate-500">
              <div>Version 2.0.0</div>
              <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Enterprise Healthcare Workspace
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className="w-full max-w-xl"
          >
            <Card className="workspace-glow rounded-[2rem] border-slate-200/80 bg-white p-2">
              <CardHeader className="space-y-3 px-6 pt-6">
                <div className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  Secure Access
                </div>
                <CardTitle className="text-3xl text-slate-950">Sign In</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6 text-slate-600">
                  Access the MediIntel operations center with your healthcare operations profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {formContent ? (
                  <form className="space-y-5" onSubmit={(event) => void formContent.handleSubmit(event)}>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        autoComplete="username"
                        placeholder="Enter your username"
                        value={formContent.username}
                        onChange={(event) => formContent.setUsername(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={formContent.password}
                        onChange={(event) => formContent.setPassword(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="role">Operational Role</Label>
                        <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Profile Context</span>
                      </div>
                      <Select value={formContent.role} onValueChange={(value) => formContent.setRole(value as UserRole)}>
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-slate-500">Use the role that matches your current operations workspace permissions.</p>
                    </div>

                    {formContent.errorMessage ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {formContent.errorMessage}
                      </div>
                    ) : null}

                    <Button className="w-full" size="lg" type="submit" disabled={formContent.isSubmitting}>
                      {formContent.isSubmitting ? formContent.loadingLabel : "Login"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      Secure access is backed by JWT session management, role-aware navigation, and audit-ready operational context.
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-2xl bg-sky-100" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
