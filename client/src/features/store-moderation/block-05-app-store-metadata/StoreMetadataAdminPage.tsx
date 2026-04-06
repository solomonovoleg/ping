import { cn } from "@/lib/utils";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";
import { StoreReviewHubNavCard } from "@/features/store-moderation/StoreReviewHubNavCard";
import { AppleMetadataLinksCard } from "./AppleMetadataLinksCard";
import { MetadataChecklistCopyCard } from "./MetadataChecklistCopyCard";
import { MetadataComplianceChecklistCard } from "./MetadataComplianceChecklistCard";

/**
 * Блок 5: листинг App Store Connect. Маршрут `/admin/store-review-metadata`.
 */
export default function StoreMetadataAdminPage() {
  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Сторы: листинг"
        description="Скриншоты, точность описания (§2.3), возрастной рейтинг и локализации в App Store Connect."
      />

      <StoreReviewHubNavCard
        hint="Review Notes для ревьюера — в «Сторы / UGC». Privacy и удаление аккаунта — «Сторы: Privacy»."
        activeSection="metadata"
      />

      <AppleMetadataLinksCard />
      <MetadataComplianceChecklistCard />
      <MetadataChecklistCopyCard />
    </div>
  );
}
