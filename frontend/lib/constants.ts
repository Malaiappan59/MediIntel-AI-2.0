export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MediIntel";
export const APP_TAGLINE = "Predict. Prevent. Procure.";
export const LOGIN_REDIRECT = process.env.NEXT_PUBLIC_LOGIN_REDIRECT ?? "/dashboard";
export const SESSION_COOKIE = "medintel_session";
export const ROLE_COOKIE = "medintel_role";
export const USER_COOKIE = "medintel_user";

export const roles = [
  "Admin",
  "Inventory Manager",
  "Procurement Manager",
  "Pharmacist",
  "Auditor",
  "Viewer",
] as const;

export const sidebarItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agents", label: "AI Workspace" },
  { href: "/tools#approvals", label: "Approvals" },
  { href: "/tools#procurement", label: "Procurement" },
  { href: "/alerts", label: "Alerts" },
  { href: "/tools#audit", label: "Audit Logs" },
  { href: "/settings", label: "Settings" },
] as const;

export const sidebarUtilityItems = [
  { href: "/memory", label: "Knowledge Repository" },
  { href: "/tools#apis", label: "API Registry" },
] as const;
