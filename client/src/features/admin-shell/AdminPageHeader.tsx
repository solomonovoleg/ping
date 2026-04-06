import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAdminShellBreadcrumbs, useAdminShellQuickActions, useAdminShellUser } from "./context";

function initialsFromUser(displayName: string | null, surname: string | null): string {
  const a = (displayName ?? "").trim().charAt(0);
  const b = (surname ?? "").trim().charAt(0);
  const out = (a + b).toUpperCase();
  return out || "?";
}

export type AdminPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Доп. кнопки справа (до аватара) */
  actions?: ReactNode;
  className?: string;
  /** Показать аватар (данные из AdminShellProvider) */
  showUserChrome?: boolean;
};

export function AdminPageHeader({
  title,
  description,
  actions,
  className,
  showUserChrome = true,
}: AdminPageHeaderProps) {
  const [, setLocation] = useLocation();
  const user = useAdminShellUser();
  const breadcrumbs = useAdminShellBreadcrumbs();
  const quickActions = useAdminShellQuickActions();

  return (
    <header
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 pb-6 min-w-0",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs.length > 0 ? (
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-[hsl(var(--admin-muted))]">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                  {crumb.path && !last ? (
                    <button
                      type="button"
                      className="hover:text-[hsl(210_20%_96%)] transition-colors"
                      onClick={() => setLocation(crumb.path!)}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={last ? "text-[hsl(210_20%_92%)]" : ""}>{crumb.label}</span>
                  )}
                  {!last ? <span className="opacity-60">/</span> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-[hsl(210_20%_98%)]">
          {title}
        </h1>
        {description != null && description !== "" ? (
          <div className="mt-1 max-w-2xl text-sm admin-text-muted [&_code]:rounded [&_code]:bg-[hsl(var(--admin-elevated-strong))] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]">
            {description}
          </div>
        ) : null}
        {quickActions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action.path}
                type="button"
                onClick={() => setLocation(action.path)}
                className="min-h-[28px] rounded-md border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.45)] px-2.5 text-xs text-[hsl(var(--admin-muted))] hover:text-[hsl(210_20%_96%)]"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {(actions || showUserChrome) && (
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          {actions}
          {showUserChrome ? (
            <>
              <Avatar className="h-10 w-10 rounded-xl border border-[hsl(var(--admin-border)/0.5)]">
                {user?.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="rounded-xl bg-[hsl(var(--admin-elevated-strong))] text-sm font-medium text-[hsl(210_20%_90%)]">
                  {user ? initialsFromUser(user.displayName, user.surname) : "?"}
                </AvatarFallback>
              </Avatar>
            </>
          ) : null}
        </div>
      )}
    </header>
  );
}
