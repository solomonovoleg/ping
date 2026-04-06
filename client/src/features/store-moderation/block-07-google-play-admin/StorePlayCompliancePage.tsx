import { cn } from "@/lib/utils";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";
import { StoreLegalUrlsCard } from "@/features/store-moderation/block-02-legal/store-legal-urls-card";
import { StoreReviewHubNavCard } from "@/features/store-moderation/StoreReviewHubNavCard";
import { PlayComplianceChecklistCard } from "./PlayComplianceChecklistCard";
import { PlayConsoleLinksCard } from "./PlayConsoleLinksCard";
import { PlayReleaseChecklistCard } from "./PlayReleaseChecklistCard";
import { StoreReleaseReadinessSummaryCard } from "./StoreReleaseReadinessSummaryCard";

/** Блок 7: Google Play. Маршрут `/admin/store-review-play`. */
export default function StorePlayCompliancePage() {
  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Google Play: соответствие"
        description="Data safety, UGC, политики и согласованность с тем, что уже сделано под App Store."
      />

      <StoreReviewHubNavCard
        hint="Хаб разделов модерации и сторов — «Модерация»; жалобы — «Операции»."
        activeSection="play"
        opsButtonVariant="secondary"
      />

      <StoreLegalUrlsCard />
      <PlayConsoleLinksCard />
      <StoreReleaseReadinessSummaryCard />
      <PlayComplianceChecklistCard />
      <PlayReleaseChecklistCard />
    </div>
  );
}
