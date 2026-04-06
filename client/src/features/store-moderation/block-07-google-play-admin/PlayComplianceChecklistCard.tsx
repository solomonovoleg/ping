import { AdminPanelCard } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { PLAY_COMPLIANCE_ROWS } from "./play-compliance-rows";
import type { PlayComplianceStatus } from "./play-compliance-rows";

const STATUS_LABEL: Record<PlayComplianceStatus, string> = {
  check: "Сверено в продукте",
  manual: "Заполнить в Console",
};

const STATUS_CLASS: Record<PlayComplianceStatus, string> = {
  check: "bg-emerald-500/12 text-emerald-100 border-emerald-500/30",
  manual: "bg-sky-500/12 text-sky-100 border-sky-500/30",
};

export function PlayComplianceChecklistCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Чеклист Google Play</h2>
      <p className="mt-1 text-sm admin-text-muted">
        Дополняет разделы под Apple; при публикации в обоих сторах обе анкеты должны быть согласованы с приложением.
      </p>
      <div className="mt-4 space-y-3">
        {PLAY_COMPLIANCE_ROWS.map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium text-[hsl(210_20%_96%)]">{row.title}</p>
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
