import { Camera, LayoutList, MessageSquare, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { requestOpenCreateStandalonePushDrawer } from "@/features/push/open-create-standalone-push";

export type FeedQuickActionsAsideContext = "feed" | "chat" | "reels";

export function FeedQuickActionsAside({ context = "feed" }: { context?: FeedQuickActionsAsideContext }) {
  const [, setLocation] = useLocation();
  const infoTitle =
    context === "chat"
      ? "Диалог на десктопе"
      : context === "reels"
        ? "Видео на десктопе"
        : "Лента на десктопе";
  const infoBody =
    context === "chat"
      ? "Та же ширина колонки, что и в ленте. Справа — быстрые действия."
      : context === "reels"
        ? "Видео в той же узкой колонке, что и лента — без растягивания на весь экран. Справа — быстрые действия."
        : "Правая панель сужает центральный поток и делает чтение постов более комфортным на широких экранах.";

  return (
    <aside className="hidden w-[280px] shrink-0 min-[1500px]:block" aria-label="Быстрые действия">
      <div className="sticky top-4 space-y-3 pb-4">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-3">
          <p className="text-sm font-semibold">Быстрые действия</p>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setLocation("/create-post")}
              className="flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border/50 bg-secondary/35 px-3 py-2 text-left text-sm font-medium hover:bg-secondary/55"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Создать пост
            </button>
            <button
              type="button"
              onClick={() => requestOpenCreateStandalonePushDrawer()}
              className="flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-rose-300/40 bg-gradient-to-r from-rose-500/92 via-pink-500/92 to-orange-400/88 px-3 py-2 text-left text-sm font-semibold text-white shadow-[0_4px_18px_-6px_rgba(236,72,153,0.42)] hover:brightness-[1.03]"
              aria-label="Создать Push для подписчиков"
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
              Создать Push
            </button>
            {context === "reels" ? (
              <button
                type="button"
                onClick={() => setLocation("/posts")}
                className="flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-left text-sm font-medium hover:bg-secondary/40"
              >
                <LayoutList className="h-4 w-4" aria-hidden />
                К ленте
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLocation("/reels")}
                className="flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-left text-sm font-medium hover:bg-secondary/40"
              >
                <Camera className="h-4 w-4" aria-hidden />
                Открыть iSee
              </button>
            )}
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-left text-sm font-medium hover:bg-secondary/40"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Перейти в чаты
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-border/45 bg-card/30 p-3">
          <p className="text-sm font-semibold">{infoTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{infoBody}</p>
        </div>
      </div>
    </aside>
  );
}
