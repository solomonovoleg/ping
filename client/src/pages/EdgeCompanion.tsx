import { ChevronLeft, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { PageTitle } from "@/components/PageTitle";
import { TapScaleButton } from "@/components/ui/tap-scale";

export default function EdgeCompanion() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title="EDGE Companion" />
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/posts")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад к ленте"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <h2 className="uix-text-title">EDGE Companion</h2>
        </div>

        <div className="uix-content-x flex flex-1 flex-col gap-6 pb-8 pt-2">
          <div
            className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/15 to-rose-500/20 p-8"
            role="region"
            aria-label="Сцена погружения"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex flex-col items-center text-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Sparkles className="h-10 w-10" aria-hidden />
              </div>
              <p className="text-lg font-semibold text-foreground">Сцена готова</p>
              <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                Здесь будет интерактивный персонаж и сценарии погружения. Пока экран заглушка — лента и навигация уже работают.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
