import { cn } from "@/lib/utils";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";
import { StoreLegalUrlsCard } from "@/features/store-moderation/block-02-legal/store-legal-urls-card";
import { StoreReviewHubNavCard } from "@/features/store-moderation/StoreReviewHubNavCard";
import { AccountDeletionCitationCard } from "./AccountDeletionCitationCard";
import { PrivacyComplianceChecklistCard } from "./PrivacyComplianceChecklistCard";

/**
 * Раздел админки: Privacy / удаление аккаунта / Connect (блок 4).
 * Маршрут: `/admin/store-review-privacy`.
 */
export default function StorePrivacyCompliancePage() {
  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Сторы: Privacy и Connect"
        description="Удаление аккаунта, анкета App Privacy, export compliance, Support URL и строки использования на iOS. Дополняет раздел «Сторы / UGC»."
      />

      <StoreReviewHubNavCard
        hint="Чеклист UGC и шаблон Review Notes — в «Сторы / UGC». Жалобы — в «Операции»."
        activeSection="privacy"
      />

      <StoreLegalUrlsCard />
      <AccountDeletionCitationCard />
      <PrivacyComplianceChecklistCard />
    </div>
  );
}
