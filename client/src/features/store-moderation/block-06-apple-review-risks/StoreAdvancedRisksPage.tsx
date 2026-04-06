import { cn } from "@/lib/utils";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";
import { StoreReviewHubNavCard } from "@/features/store-moderation/StoreReviewHubNavCard";
import { AdvancedRiskChecklistCard } from "./AdvancedRiskChecklistCard";
import { AppleAdvancedLinksCard } from "./AppleAdvancedLinksCard";
import { UxRequirementChecklistCard } from "./UxRequirementChecklistCard";
import { StoreReleaseReadinessSummaryCard } from "../block-07-google-play-admin/StoreReleaseReadinessSummaryCard";

/** Блок 6: IAP, 4.x, стабильность. Маршрут `/admin/store-review-risks`. */
export default function StoreAdvancedRisksPage() {
  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Сторы: риски ревью"
        description="Платежи Apple (§3.1), минимальная функциональность (§4.2), спам/дубликаты (§4.3), стабильность (§2.1) и особые capabilities."
      />

      <StoreReviewHubNavCard
        hint="UGC и Review Notes — «Сторы / UGC»; Privacy — отдельный раздел; листинг — «Сторы: листинг»."
        activeSection="risks"
      />

      <AppleAdvancedLinksCard />
      <StoreReleaseReadinessSummaryCard />
      <AdvancedRiskChecklistCard />
      <UxRequirementChecklistCard />
    </div>
  );
}
