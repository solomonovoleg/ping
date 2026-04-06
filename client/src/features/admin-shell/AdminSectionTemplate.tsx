import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPanelCard } from "./AdminPanelCard";

type AdminSectionTemplateProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  isLoading?: boolean;
  loadingRows?: number;
  error?: unknown;
  onRetry?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  empty?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
};

export function AdminSectionTemplate({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName = "space-y-4",
  isLoading = false,
  loadingRows = 3,
  error,
  onRetry,
  errorTitle,
  errorDescription,
  empty = false,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: AdminSectionTemplateProps) {
  const hasError = !!error;
  const showDefaultContent = !isLoading && !hasError && !empty;

  return (
    <AdminPanelCard className={className ?? "p-5 sm:p-6"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">{title}</h2>
          {description ? <p className="mt-1 text-sm admin-text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>

      <div className={bodyClassName}>
        {isLoading ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: Math.max(1, loadingRows) }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : null}

        {hasError ? (
          <ErrorWithRetry
            title={errorTitle ?? "Не удалось загрузить данные"}
            description={
              errorDescription ?? (error instanceof Error ? error.message : "Не удалось загрузить данные")
            }
            onRetry={onRetry ?? (() => {})}
            className="min-h-[180px]"
          />
        ) : null}

        {empty && emptyIcon && emptyTitle && emptyDescription ? (
          <ListEmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            actionLabel={emptyActionLabel}
            onAction={onEmptyAction}
            className="min-h-[180px]"
          />
        ) : null}

        {showDefaultContent ? children : null}
      </div>
    </AdminPanelCard>
  );
}
