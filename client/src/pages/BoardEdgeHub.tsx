import { Banknote, ChevronLeft, LayoutList, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";

export default function BoardEdgeHub() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/board")}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
          aria-label="Назад к борду"
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <div className="min-w-0 flex-1">
          <h1 className="uix-text-title">EDGE</h1>
        </div>
      </header>

      <div className="uix-content-x flex flex-1 flex-col gap-4 py-6 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-4))]">
        <TapScaleButton
          type="button"
          haptic
          onClick={() => setLocation("/board/edge/new")}
          className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-4 rounded-3xl border border-primary/25 bg-primary/10 p-5 text-left shadow-sm"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">EDGE — персонаж</h2>
            <p className="mt-1 uix-text-caption leading-snug text-muted-foreground">
              Тамагочи, тапы, задания — как раньше.
            </p>
          </div>
        </TapScaleButton>

        <TapScaleButton
          type="button"
          haptic
          onClick={() => setLocation("/board/edge/new-money")}
          className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-4 rounded-3xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-left shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            <Banknote className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">EDGE MONEY</h2>
            <p className="mt-1 uix-text-caption leading-snug text-muted-foreground">
              Рейтинг за действия в Пинге и призы по местам. Мастер с подсказками.
            </p>
          </div>
        </TapScaleButton>

        <TapScaleButton
          type="button"
          haptic
          subtle
          onClick={() => setLocation("/board/edge/manage")}
          className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-4 rounded-3xl border border-border/60 bg-card p-5 text-left shadow-sm"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <LayoutList className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">МОИ EDGE</h2>
          </div>
        </TapScaleButton>
      </div>
    </div>
  );
}
