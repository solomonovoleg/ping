import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { useToast } from "@/hooks/use-toast";
import {
  EDGE_INTRO_STEP1_TAPS,
  resolveIntroStep,
  type EdgeIntroStep,
} from "@/features/edge-companion/edge-intro-onboarding";

type Props = {
  edgeId: string;
  introTapCount: number | undefined;
  /** Лента — компактнее; полный экран — чуть больше воздуха. */
  layout: "feed" | "full";
  /** Если в кампании один экран — шаг 3 (свайп) пропускается. */
  hasMultipleSurfaces?: boolean;
  className?: string;
};

function stepTitle(step: EdgeIntroStep): string {
  if (step === "done") return "";
  return `Шаг ${step} из 3`;
}

function stepBody(step: EdgeIntroStep, layout: "feed" | "full"): string {
  switch (step) {
    case 1:
      return `Сделай ${EDGE_INTRO_STEP1_TAPS} тапов по персонажу — так начинается контакт с кампанией.`;
    case 2:
      return layout === "full"
        ? "Ты уже в полной игре — отлично. Дальше изучи разделы кампании (следующий шаг)."
        : "Открой полную игру кнопкой ниже — там задания, прогресс и все разделы.";
    case 3:
      return "Свайпни в сторону (точки или стрелки) — там призы, правила и рейтинг участников.";
    default:
      return "";
  }
}

const doneToastKey = (edgeId: string) => `pingEdgeIntroDoneToast:v1:${edgeId.trim()}`;

export function EdgeIntroFootnote({
  edgeId,
  introTapCount,
  layout,
  hasMultipleSurfaces = true,
  className,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const { toast } = useToast();
  const prevStep = useRef<EdgeIntroStep | null>(null);

  const step = resolveIntroStep(edgeId, introTapCount, { hasMultipleSurfaces });
  const taps = introTapCount ?? 0;
  const p1 = Math.min(1, taps / EDGE_INTRO_STEP1_TAPS);

  useEffect(() => {
    if (step !== "done") {
      prevStep.current = step;
      return;
    }
    if (prevStep.current == null || prevStep.current === "done") return;
    prevStep.current = "done";
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(doneToastKey(edgeId)) === "1") return;
      sessionStorage.setItem(doneToastKey(edgeId), "1");
    } catch {
      /* ignore */
    }
    toast({
      title: "Можно играть",
      description: "Заглядывайте к персонажу и заданиям — удачи в кампании.",
      duration: 4500,
    });
  }, [edgeId, step, toast]);

  if (step === "done") return null;

  const compact = layout === "feed";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/[0.07] text-left shadow-sm backdrop-blur-[2px] dark:bg-primary/[0.12]",
        compact ? "mx-0.5 px-2.5 py-2 sm:px-3" : "uix-content-x mx-[var(--uix-space-2)] px-3 py-2.5 sm:mx-4",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-2">
        <BookOpen
          className={cn("mt-0.5 shrink-0 text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[10px] sm:text-[11px]" : "text-xs sm:text-sm",
            )}
          >
            {stepTitle(step)}
          </p>
          <p
            className={cn(
              "mt-0.5 text-muted-foreground leading-snug",
              compact ? "text-[9px] sm:text-[10px]" : "text-[11px] sm:text-xs",
            )}
          >
            {stepBody(step, layout)}
          </p>
          {step === 1 ? (
            <div className="mt-1.5">
              <div
                className="h-1 overflow-hidden rounded-full bg-muted/80"
                role="progressbar"
                aria-valuenow={taps}
                aria-valuemin={0}
                aria-valuemax={EDGE_INTRO_STEP1_TAPS}
                aria-label={`Нажатий по персонажу: ${taps} из ${EDGE_INTRO_STEP1_TAPS}`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${p1 * 100}%` }}
                />
              </div>
              <p className="mt-0.5 tabular-nums text-[9px] text-muted-foreground sm:text-[10px]">
                {taps} / {EDGE_INTRO_STEP1_TAPS}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
