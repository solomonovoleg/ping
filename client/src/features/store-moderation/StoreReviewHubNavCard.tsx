import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AdminPanelCard } from "@/features/admin-shell";

type StoreReviewSection = "ugc" | "privacy" | "metadata" | "risks" | "play";

const SECTION_TO_ROUTE: Record<StoreReviewSection, string> = {
  ugc: "/admin/store-review",
  privacy: "/admin/store-review-privacy",
  metadata: "/admin/store-review-metadata",
  risks: "/admin/store-review-risks",
  play: "/admin/store-review-play",
};

const SECTION_TO_LABEL: Record<StoreReviewSection, string> = {
  ugc: "Сторы / UGC",
  privacy: "Сторы: Privacy",
  metadata: "Сторы: листинг",
  risks: "Сторы: риски",
  play: "Google Play",
};

export function StoreReviewHubNavCard({
  hint,
  activeSection,
  opsButtonVariant = "outline",
}: {
  hint: string;
  activeSection: StoreReviewSection;
  opsButtonVariant?: "outline" | "secondary";
}) {
  const [, setLocation] = useLocation();
  return (
    <AdminPanelCard className="border-dashed border-[hsl(var(--admin-border)/0.5)] bg-[hsl(var(--admin-elevated)/0.25)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm admin-text-muted">
        <span className="min-w-0">{hint}</span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setLocation("/admin/moderation")}>
            Обзор модерации
          </Button>
          {(Object.keys(SECTION_TO_ROUTE) as StoreReviewSection[]).map((section) => (
            <Button
              key={section}
              type="button"
              variant={activeSection === section ? "secondary" : "outline"}
              size="sm"
              onClick={() => setLocation(SECTION_TO_ROUTE[section])}
            >
              {SECTION_TO_LABEL[section]}
            </Button>
          ))}
          <Button type="button" variant={opsButtonVariant} size="sm" onClick={() => setLocation("/admin/ops")}>
            Операции
          </Button>
        </div>
      </div>
    </AdminPanelCard>
  );
}
