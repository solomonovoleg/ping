import { ChevronRight, Sparkles } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";

type EdgeCompanionFeedCardProps = {
  userId: number | string;
  /** ID кампании — открываем companion в контексте этой кампании */
  edgeId?: string | null;
  /** Подпись под заголовком (например название кампании с API) */
  subtitle?: string | null;
  onOpen: () => void;
  className?: string;
  /**
   * `feed` — на всю ширину карточки ленты (как блок медиа).
   * `banner` — с боковыми отступами uix-content-x (над лентой и т.д.).
   */
  variant?: "feed" | "banner";
};

/**
 * Блок EDGE в теле поста ленты: тот же слот, что у медиа; реакции/комменты/просмотры — ниже, как у обычного поста.
 */
export function EdgeCompanionFeedCard({
  userId,
  edgeId,
  subtitle,
  onOpen,
  className,
  variant = "banner",
}: EdgeCompanionFeedCardProps) {
  const idLine = edgeId ? (edgeId.length > 28 ? `${edgeId.slice(0, 26)}…` : edgeId) : null;
  const detail = subtitle?.trim() || (idLine ? `ID: ${idLine}` : "Интерактив в полном экране");

  return (
    <div
      className={cn(
        variant === "feed" ? "w-full" : "uix-content-x-tight py-3",
        className,
      )}
      data-user-id={String(userId)}
      data-edge-id={edgeId ?? undefined}
    >
      <TapScaleButton
        type="button"
        onClick={onOpen}
        haptic
        className={cn(
          "group w-full text-left rounded-2xl overflow-hidden border border-border/60",
          "bg-gradient-to-br from-violet-600/90 via-fuchsia-600/85 to-rose-500/90",
          "p-4 shadow-lg shadow-violet-500/15",
          "min-h-[var(--uix-touch-min)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-label={edgeId ? `Открыть EDGE: ${edgeId}` : "Открыть EDGE Companion"}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-6 w-6 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">EDGE</p>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Интерактив
              </span>
            </div>
            <p className="mt-0.5 text-base font-semibold text-white">Участвуй в кампании</p>
            <p className="mt-1 text-sm text-white/90 leading-snug line-clamp-2">{detail}</p>
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-white">
              Открыть
              <ChevronRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" aria-hidden />
            </p>
          </div>
        </div>
      </TapScaleButton>
    </div>
  );
}
