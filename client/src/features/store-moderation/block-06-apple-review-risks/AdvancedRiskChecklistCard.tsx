import { AdminPanelCard } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { ADVANCED_RISK_ROWS } from "./advanced-risk-rows";
import type { AdvancedRiskStatus } from "./types";

const STATUS_LABEL: Record<AdvancedRiskStatus, string> = {
  na: "Не применяется",
  check: "Проверить",
  risk: "Риск",
};

const STATUS_CLASS: Record<AdvancedRiskStatus, string> = {
  na: "bg-slate-500/12 text-slate-100 border-slate-500/30",
  check: "bg-sky-500/12 text-sky-100 border-sky-500/30",
  risk: "bg-amber-500/15 text-amber-100 border-amber-500/35",
};

export function AdvancedRiskChecklistCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Дополнительные риски ревью</h2>
      <p className="mt-1 text-sm admin-text-muted">
        То, что часто проверяют отдельно от UGC и Privacy: платежи Apple, полнота продукта, стабильность билда, дубликаты в
        портфеле, специальные entitlements.
      </p>
      <div className="mt-4 space-y-3">
        {ADVANCED_RISK_ROWS.map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[hsl(210_20%_96%)]">{row.title}</p>
                <p className="mt-0.5 text-xs text-[hsl(210_12%_62%)]">{row.guideline}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  STATUS_CLASS[row.status],
                )}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[hsl(210_14%_72%)]">
              <span className="text-[hsl(210_12%_58%)]">Риск отказа: </span>
              {row.risk}
            </p>
            <p className="mt-2 text-sm leading-snug text-[hsl(210_16%_86%)]">
              <span className="text-[hsl(210_12%_58%)]">PING: </span>
              {row.productNote}
            </p>
          </div>
        ))}
      </div>
    </AdminPanelCard>
  );
}
