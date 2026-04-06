import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import {
  APPLE_GUIDELINE_IAP_URL,
  APPLE_GUIDELINE_MINIMUM_FUNCTIONALITY_URL,
  APPLE_GUIDELINE_PERFORMANCE_URL,
  APPLE_GUIDELINE_SPAM_URL,
} from "./apple-guideline-anchors";

const LINKS: { href: string; label: string }[] = [
  { href: APPLE_GUIDELINE_IAP_URL, label: "§3.1 In-App Purchase" },
  { href: APPLE_GUIDELINE_MINIMUM_FUNCTIONALITY_URL, label: "§4.2 Minimum functionality" },
  { href: APPLE_GUIDELINE_SPAM_URL, label: "§4.3 Spam" },
  { href: APPLE_GUIDELINE_PERFORMANCE_URL, label: "§2.1 Performance" },
];

export function AppleAdvancedLinksCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Справка Apple (Business / Design)</h2>
      <p className="mt-1 text-sm admin-text-muted">
        Якоря на developer.apple.com; при смене вёрстки страницы откройте полный текст и найдите раздел по номеру пункта.
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
