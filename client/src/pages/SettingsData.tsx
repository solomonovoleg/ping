import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import { SettingsDataMemoryCard } from "@/features/settings/components/SettingsDataMemoryCard";

export default function SettingsData() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title="Данные и память" />
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <header className="uix-content-x py-4 glass z-10 sticky top-0 flex items-center gap-2 border-b border-border/30">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
            onClick={() => setLocation("/settings")}
            aria-label="Назад к настройкам"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="uix-text-title font-semibold truncate">Данные и память</h1>
        </header>
        <div className="p-4 flex flex-col gap-2 flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
            Устройство и сервер
          </p>
          <SettingsDataMemoryCard onNavigateSaved={() => setLocation("/saved")} />
        </div>
      </div>
    </div>
  );
}
