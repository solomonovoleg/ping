import { ExternalLink } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import {
  PLAY_DATA_SAFETY_HELP_URL,
  PLAY_DEVELOPER_POLICY_CENTER_URL,
  PLAY_UGC_POLICY_HELP_URL,
} from "./play-console-links";

const LINKS: { href: string; label: string }[] = [
  { href: PLAY_DATA_SAFETY_HELP_URL, label: "Data safety (справка)" },
  { href: PLAY_UGC_POLICY_HELP_URL, label: "UGC и модерация" },
  { href: PLAY_DEVELOPER_POLICY_CENTER_URL, label: "Политики Play" },
];

export function PlayConsoleLinksCard() {
  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Справка Google Play</h2>
      <p className="mt-1 text-sm admin-text-muted">Официальные страницы поддержки разработчиков, не копии с третьих сайтов.</p>
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
