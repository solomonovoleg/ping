import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import {
  APPLE_APP_REVIEW_GUIDELINES_UGC_URL,
  APPLE_UGC_CREATOR_APPS_NOTE,
  APPLE_UGC_REQUIRED_BULLETS,
} from "./apple-1-2-citation";

/** Карточка с цитатой требований Apple §1.2 (UGC) — первоисточник по ссылке. */
export function AppleUgcCitationCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Apple: §1.2 User-Generated Content</h2>
          <p className="mt-1 text-sm admin-text-muted">
            Дословный список из App Review Guidelines (раздел Safety). Для приложений с UGC и соцсетями.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
          <a href={APPLE_APP_REVIEW_GUIDELINES_UGC_URL} target="_blank" rel="noopener noreferrer">
            Гайдлайны Apple
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
        </Button>
      </div>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[hsl(210_18%_88%)]">
        {APPLE_UGC_REQUIRED_BULLETS.map((t) => (
          <li key={t} lang="en">
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.35)] p-3 text-xs leading-relaxed text-[hsl(210_16%_78%)]" lang="en">
        <span className="font-medium text-[hsl(210_20%_92%)]">1.2(a) creator apps: </span>
        {APPLE_UGC_CREATOR_APPS_NOTE}
      </p>
    </AdminPanelCard>
  );
}
