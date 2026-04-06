import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import {
  APPLE_ACCOUNT_DELETION_EXPECTATIONS,
  APPLE_ACCOUNT_DELETION_SUPPORT_URL,
} from "./apple-account-deletion-citation";

export function AccountDeletionCitationCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Удаление аккаунта (Apple)</h2>
          <p className="mt-1 text-sm admin-text-muted">
            Обязательное требование для приложений с регистрацией. Официальная справка Apple:
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
          <a href={APPLE_ACCOUNT_DELETION_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Справка Apple
            <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </a>
        </Button>
      </div>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[hsl(210_18%_88%)]">
        {APPLE_ACCOUNT_DELETION_EXPECTATIONS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </AdminPanelCard>
  );
}
