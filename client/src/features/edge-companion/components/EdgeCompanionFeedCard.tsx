import { Sparkles } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";

type EdgeCompanionFeedCardProps = {
  userId: number | string;
  onOpen: () => void;
  className?: string;
};

/**
 * Карточка EDGE в ленте: ведёт на полноэкранный режим `/edge/companion`.
 */
export function EdgeCompanionFeedCard({ userId, onOpen, className }: EdgeCompanionFeedCardProps) {
  return (
    <div className={cn("uix-content-x-tight py-3", className)}>
      <TapScaleButton
        type="button"
        onClick={onOpen}
        haptic
        data-user-id={String(userId)}
        className={cn(
          "w-full text-left rounded-2xl overflow-hidden border border-border/60",
          "bg-gradient-to-br from-violet-600/90 via-fuchsia-600/85 to-rose-500/90",
          "p-4 shadow-lg shadow-violet-500/15",
          "min-h-[var(--uix-touch-min)]",
        )}
        aria-label="Открыть EDGE Companion"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-6 w-6 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">EDGE</p>
            <p className="mt-0.5 text-base font-semibold text-white">Companion</p>
            <p className="mt-1 text-sm text-white/85 leading-snug">
              Интерактивный персонаж и сцена погружения — откройте полный экран.
            </p>
          </div>
        </div>
      </TapScaleButton>
    </div>
  );
}
