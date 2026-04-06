import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Секция/виджет в стиле макета админки (графики, таблицы, списки). */
export const AdminPanelCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AdminPanelCard({ className, ...props }, ref) {
    return <div ref={ref} className={cn("admin-surface-card", className)} {...props} />;
  }
);

/** Компактная плитка метрик (heap, RSS, load). */
export const AdminMetricTile = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AdminMetricTile({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("admin-surface-card rounded-[var(--admin-radius-md)] p-3 sm:p-4", className)}
        {...props}
      />
    );
  }
);
