import { createContext, useContext, type ReactNode } from "react";
import type { AuthUser } from "@/lib/auth";

export type AdminShellBreadcrumb = {
  label: string;
  path?: string;
};

export type AdminShellQuickAction = {
  label: string;
  path: string;
};

type AdminShellContextValue = {
  user: AuthUser | null;
  breadcrumbs: AdminShellBreadcrumb[];
  quickActions: AdminShellQuickAction[];
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({
  user,
  breadcrumbs = [],
  quickActions = [],
  children,
}: {
  user: AuthUser | null;
  breadcrumbs?: AdminShellBreadcrumb[];
  quickActions?: AdminShellQuickAction[];
  children: ReactNode;
}) {
  return <AdminShellContext.Provider value={{ user, breadcrumbs, quickActions }}>{children}</AdminShellContext.Provider>;
}

export function useAdminShellUser(): AuthUser | null {
  return useContext(AdminShellContext)?.user ?? null;
}

export function useAdminShellBreadcrumbs(): AdminShellBreadcrumb[] {
  return useContext(AdminShellContext)?.breadcrumbs ?? [];
}

export function useAdminShellQuickActions(): AdminShellQuickAction[] {
  return useContext(AdminShellContext)?.quickActions ?? [];
}
