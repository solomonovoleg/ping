import { cn } from "@/lib/utils";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";
import { StoreLegalUrlsCard } from "@/features/store-moderation/block-02-legal/store-legal-urls-card";
import { StoreReviewHubNavCard } from "@/features/store-moderation/StoreReviewHubNavCard";
import { AppleUgcCitationCard } from "./AppleUgcCitationCard";
import { ComplianceChecklistCard } from "./ComplianceChecklistCard";
import { ReviewNotesTemplateCard } from "./ReviewNotesTemplateCard";

/**
 * Раздел админки: требования Apple к UGC и подготовка к App Review.
 * Маршрут: `/admin/store-review`.
 */
export default function StoreModerationAdminPage() {
  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Сторы и UGC (App Review)"
        description="Чеклист по App Review Guidelines §1.2 и шаблон заметок для ревьюера. Жалобы — в «Операции». Для Google Play см. раздел «Google Play» в том же хабе «Модерация»."
      />

      <StoreReviewHubNavCard
        hint="Очередь жалоб пользователей и статусы — в «Операции» (карточка «Жалобы пользователей»)."
        activeSection="ugc"
        opsButtonVariant="secondary"
      />

      <StoreLegalUrlsCard />
      <AppleUgcCitationCard />
      <ComplianceChecklistCard />
      <ReviewNotesTemplateCard />
    </div>
  );
}
