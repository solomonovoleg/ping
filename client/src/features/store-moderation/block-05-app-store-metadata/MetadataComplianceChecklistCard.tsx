import { AdminPanelCard } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { METADATA_COMPLIANCE_ROWS } from "./metadata-compliance-rows";
import type { MetadataComplianceStatus } from "./types";

const STATUS_LABEL: Record<MetadataComplianceStatus, string> = {
  ok: "Ок / опционально",
  risk: "Риск",
  manual: "Проверить в Connect",
};

const STATUS_CLASS: Record<MetadataComplianceStatus, string> = {
  ok: "bg-emerald-500/12 text-emerald-100 border-emerald-500/30",
  risk: "bg-amber-500/15 text-amber-100 border-amber-500/35",
  manual: "bg-sky-500/12 text-sky-100 border-sky-500/30",
};

export function MetadataComplianceChecklistCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Чеклист листинга</h2>
      <p className="mt-1 text-sm admin-text-muted">
        Соответствие тому, что ревьюер увидит в приложении и в карточке стора. Неточные скриншоты и описание — частая
        причина отказа (§2.3).
      </p>
      <div className="mt-4 space-y-3">
        {METADATA_COMPLIANCE_ROWS.map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[hsl(210_20%_96%)]">{row.title}</p>
                <p className="mt-0.5 text-xs text-[hsl(210_12%_62%)]">{row.source}</p>
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
              <span className="text-[hsl(210_12%_58%)]">Ожидание: </span>
              {row.expectation}
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
