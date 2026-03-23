import { ChevronLeft, Sparkles, LayoutList, PlusCircle } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";

/**
 * Точка входа EDGE с Борда: каталог типов (пока один) и переход к управлению.
 */
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
          <p className="mt-0.5 text-xs text-muted-foreground">Интерактив в ленте</p>
        </div>
      </header>

      <div className="uix-content-x flex flex-1 flex-col gap-4 py-6 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-4))]">
        <p className="uix-text-list-secondary text-muted-foreground">
          Полный конструктор (персонаж, призы, задания, расписание) описан в репозитории:{" "}
          <span className="font-mono text-[11px] text-foreground/80">docs/EDGE_BOARD_CREATOR_SPEC.md</span>
        </p>

        <TapScaleButton
          type="button"
          haptic
          onClick={() => setLocation("/board/edge/new")}
          className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-4 rounded-3xl border border-primary/25 bg-primary/10 p-5 text-left shadow-sm"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <PlusCircle className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">Новый EDGE</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Каталог типов: пока доступен только «Персонаж». Мастер создания подключается поэтапно.
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
            <h2 className="font-semibold text-foreground">Мои кампании</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Черновики, активные и завершённые; участники и ручной розыгрыш (через админку).
            </p>
          </div>
        </TapScaleButton>

        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Каталог типов
          </div>
          <ul className="mt-2 space-y-1 uix-text-caption text-muted-foreground">
            <li>• Персонаж — тамагочи, лидерборд, призы (уже в продукте)</li>
            <li>• Остальные типы — в плане (`docs/EDGE_PRODUCT_SPEC.md`)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
