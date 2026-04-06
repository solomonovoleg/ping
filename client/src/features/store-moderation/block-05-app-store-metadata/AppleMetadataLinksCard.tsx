import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import {
  APPLE_AGE_RATINGS_REFERENCE_URL,
  APPLE_MANAGE_AGE_RATING_URL,
  APPLE_REVIEW_GUIDELINES_ACCURACY_URL,
  APPLE_SCREENSHOT_SPECS_URL,
  APPLE_UPCOMING_REQUIREMENTS_URL,
  APPLE_UPLOAD_SCREENSHOTS_URL,
} from "./apple-metadata-links";

const LINKS: { href: string; label: string }[] = [
  { href: APPLE_REVIEW_GUIDELINES_ACCURACY_URL, label: "Guidelines: Accuracy" },
  { href: APPLE_SCREENSHOT_SPECS_URL, label: "Screenshot specs (Connect)" },
  { href: APPLE_UPLOAD_SCREENSHOTS_URL, label: "Upload screenshots" },
  { href: APPLE_AGE_RATINGS_REFERENCE_URL, label: "Age ratings (справка)" },
  { href: APPLE_MANAGE_AGE_RATING_URL, label: "Set app age rating" },
  { href: APPLE_UPCOMING_REQUIREMENTS_URL, label: "Upcoming requirements (SDK/Xcode)" },
];

export function AppleMetadataLinksCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Справка Apple (листинг)</h2>
      <p className="mt-1 text-sm admin-text-muted">
        Размеры скриншотов и правила загрузки — только из официальной документации; не полагайтесь на устаревшие таблицы
        из статей третьих лиц.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {LINKS.map(({ href, label }) => (
          <Button key={href} variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {label}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </a>
          </Button>
        ))}
      </div>
    </AdminPanelCard>
  );
}
