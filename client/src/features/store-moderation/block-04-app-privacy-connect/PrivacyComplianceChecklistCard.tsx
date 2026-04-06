import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  APPLE_APP_PRIVACY_DETAILS_URL,
  APPLE_EXPORT_COMPLIANCE_HELP_URL,
  APPLE_THIRD_PARTY_SDK_REQUIREMENTS_URL,
  APPLE_UPCOMING_REQUIREMENTS_URL,
} from "./apple-privacy-export-citation";
import { PRIVACY_COMPLIANCE_ROWS } from "./privacy-compliance-rows";
import type { PrivacyComplianceStatus } from "./types";

const STATUS_LABEL: Record<PrivacyComplianceStatus, string> = {
  implemented: "В продукте",
  partial: "Частично",
  manual: "Connect / билд",
};

const STATUS_CLASS: Record<PrivacyComplianceStatus, string> = {
  implemented: "bg-emerald-500/15 text-emerald-200 border-emerald-500/35",
  partial: "bg-amber-500/15 text-amber-100 border-amber-500/35",
  manual: "bg-sky-500/12 text-sky-100 border-sky-500/30",
};

export function PrivacyComplianceChecklistCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Privacy, Connect, iOS</h2>
          <p className="mt-1 text-sm admin-text-muted">
            Данные для App Store Connect и нативной сборки. Сверяйте с политикой и реальным поведением приложения.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={APPLE_APP_PRIVACY_DETAILS_URL} target="_blank" rel="noopener noreferrer">
              App Privacy
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={APPLE_EXPORT_COMPLIANCE_HELP_URL} target="_blank" rel="noopener noreferrer">
              Export compliance
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={APPLE_THIRD_PARTY_SDK_REQUIREMENTS_URL} target="_blank" rel="noopener noreferrer">
              SDK privacy requirements
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={APPLE_UPCOMING_REQUIREMENTS_URL} target="_blank" rel="noopener noreferrer">
              Upcoming requirements
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {PRIVACY_COMPLIANCE_ROWS.map((row) => (
          <div
            key={row.key}
            className="rounded-xl border border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)] p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[hsl(210_20%_96%)]">{row.title}</p>
                <p className="mt-0.5 text-xs text-[hsl(210_12%_62%)]">{row.appleTopic}</p>
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
              <span className="text-[hsl(210_12%_58%)]">У нас: </span>
              {row.productNote}
            </p>
          </div>
        ))}
      </div>
    </AdminPanelCard>
  );
}
