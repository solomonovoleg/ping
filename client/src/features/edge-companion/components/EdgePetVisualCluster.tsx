import { motion } from "framer-motion";
import { Bird, Sparkles } from "lucide-react";
import { resolveUrl } from "@/lib/api-base";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";

type Props = {
  speech: string;
  moodLabel: string;
  dotsFilled: number;
  /** PNG персонажа с Борда / конфига кампании. */
  characterAssetUrl?: string | null;
};

export function EdgePetVisualCluster({ speech, moodLabel, dotsFilled, characterAssetUrl }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const imgSrc = characterAssetUrl?.trim() ? resolveUrl(characterAssetUrl.trim()) : "";

  return (
    <div className="mt-[var(--uix-space-4)] flex gap-[var(--uix-space-4)]">
      <motion.div
        className="relative flex h-[7.5rem] w-28 shrink-0 items-center justify-center overflow-hidden rounded-[45%] border border-border/60 bg-muted/35 shadow-inner"
        animate={reducedMotion ? undefined : { y: [0, -3, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: DURATION_NORMAL_S * 10, repeat: Infinity, ease: EASING_OUT_BEZIER }
        }
        aria-hidden
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="max-h-full max-w-full object-contain p-1"
            draggable={false}
          />
        ) : (
          <Bird className="h-12 w-12 text-primary" strokeWidth={1.5} />
        )}
        <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
        </span>
      </motion.div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div
          className="rounded-2xl border border-border/50 bg-card/90 px-[var(--uix-space-3)] py-2 uix-text-list-secondary leading-snug text-foreground/95 backdrop-blur-sm"
          role="status"
        >
          «{speech}»
        </div>
        <div className="flex items-center gap-1.5" aria-label={`Настроение, ${dotsFilled} из 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i < dotsFilled ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            />
          ))}
          <span className="ml-2 uix-text-caption">{moodLabel}</span>
        </div>
      </div>
    </div>
  );
}
