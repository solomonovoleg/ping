import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { EdgeTaskQuestSummary } from "@/lib/edge-participant";
import {
  EDGE_REWARD_READY_SUMMARY_READY_DARK_TW,
  EDGE_REWARD_READY_SUMMARY_READY_TW,
  EDGE_TASK_SUMMARY_BASE_DARK_TW,
} from "@/lib/edge-task-reward-ready";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = {
  summary: EdgeTaskQuestSummary;
  className?: string;
  /** Полноэкранный интерактивный шаблон: тёмный фон, читаемый текст без `html.dark`. */
  variant?: "default" | "onDarkCanvas";
};

/**
 * Компактная сводка квестов: считает только «свои» данные из стейта участника (без лишних запросов).
 * При готовых к клейму наградах в игре — заметный акцент (октализис / ясность следующего шага).
 */
export function EdgeTaskQuestSummaryStrip({ summary, className, variant = "default" }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    presetTotal,
    objectiveTotal,
    completedObjective,
    edgeIncomplete,
    edgeReadyToClaim,
    platformOpen,
    blockedConfig,
  } = summary;

  if (presetTotal === 0) return null;

  const hasReadyInGame = edgeReadyToClaim > 0;

  const parts: string[] = [];
  if (objectiveTotal > 0) {
    parts.push(`С наградой: ${completedObjective} из ${objectiveTotal}`);
  }
  if (edgeIncomplete > 0) parts.push(`в игре осталось: ${edgeIncomplete}`);
  if (edgeReadyToClaim > 0) parts.push(`можно забрать XP: ${edgeReadyToClaim}`);
  if (platformOpen > 0) parts.push(`через приложение: ${platformOpen}`);
  if (blockedConfig > 0) parts.push(`нужна настройка: ${blockedConfig}`);

  if (parts.length === 0) return null;

  const shellClass = cn(
    "rounded-xl border px-3 py-2 text-[12px] leading-snug",
    variant === "onDarkCanvas"
      ? hasReadyInGame
        ? EDGE_REWARD_READY_SUMMARY_READY_DARK_TW
        : EDGE_TASK_SUMMARY_BASE_DARK_TW
      : hasReadyInGame
        ? cn("text-muted-foreground", EDGE_REWARD_READY_SUMMARY_READY_TW)
        : "border-primary/20 bg-primary/[0.06] text-muted-foreground",
    className,
  );

  const kickerClass =
    variant === "onDarkCanvas"
      ? "mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#c4b5fd]"
      : "mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary";

  const inner = (
    <>
      {hasReadyInGame ? (
        <p className={kickerClass}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
          В игре можно забрать награду
        </p>
      ) : null}
      <p className="m-0">
        <span
          className={cn(
            "font-semibold",
            variant === "onDarkCanvas" ? "text-slate-100" : "text-foreground/90",
          )}
        >
          Прогресс заданий:{" "}
        </span>
        {parts.join(" · ")}
      </p>
    </>
  );

  if (hasReadyInGame && !reducedMotion) {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={shellClass}
        animate={{
          boxShadow: [
            "0 0 0 0 hsl(var(--primary) / 0)",
            "0 0 0 6px hsl(var(--primary) / 0.12)",
            "0 0 0 0 hsl(var(--primary) / 0)",
          ],
        }}
        transition={{ duration: DURATION_NORMAL_S * 2.2, repeat: Infinity, ease: EASING_OUT_BEZIER }}
      >
        {inner}
      </motion.div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={shellClass}>
      {inner}
    </div>
  );
}
