import { motion } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";
import { ListEmptyState } from "@/components/ui/empty";
import { EdgePresetTasksCard } from "@/features/edge-companion/components/EdgePresetTasksCard";
import { EdgeTaskQuestSummaryStrip } from "@/features/edge-companion/components/EdgeTaskQuestSummaryStrip";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import { effectiveEdgeTaskPresetScoreTarget } from "@/lib/edge-task-score-target";
import { cn } from "@/lib/utils";

type Props = {
  edgeId: string;
  presets: EdgeTaskPresetPublic[];
  interactLocked?: boolean;
  /** Какие вкладки рейтинга включены в кампании — список заданий режется и делится на блоки. */
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  participantState?: EdgeParticipantState;
  /** Карточка в ленте: ниже hero, плотнее типографика. */
  embedVariant?: "full" | "feed";
};

function splitByScoreTarget(presets: EdgeTaskPresetPublic[]) {
  const primary: EdgeTaskPresetPublic[] = [];
  const secondary: EdgeTaskPresetPublic[] = [];
  for (const p of presets) {
    if (effectiveEdgeTaskPresetScoreTarget(p) === "primary") primary.push(p);
    else secondary.push(p);
  }
  return { primary, secondary };
}

/**
 * Отдельный свайп-экран «Задания»: заметный hero, акцент primary, список заданий (UIX / touch / reduced motion).
 */
export function TasksSurfacePanel({
  edgeId,
  presets,
  interactLocked,
  leaderboardPrimaryEnabled = true,
  leaderboardSecondaryEnabled = true,
  participantState,
  embedVariant = "full",
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const inFeed = embedVariant === "feed";
  const { primary, secondary } = splitByScoreTarget(presets);
  const showPrimary = leaderboardPrimaryEnabled;
  const showSecondary = leaderboardSecondaryEnabled;
  const bothBoards = showPrimary && showSecondary;

  const visiblePrimary = showPrimary ? primary : [];
  const visibleSecondary = showSecondary ? secondary : [];
  const hasAny =
    (showPrimary && visiblePrimary.length > 0) || (showSecondary && visibleSecondary.length > 0);

  const heroKicker = bothBoards
    ? "Награды XP"
    : showSecondary && !showPrimary
      ? "Дополнительный рейтинг"
      : "Основной рейтинг";
  const heroBody = bothBoards
    ? "Задания разделены: одни увеличивают основной рейтинг (игра и персонаж), другие — дополнительный (лента и активность). Каждое задание можно выполнить один раз."
    : showSecondary && !showPrimary
      ? "Очки от этих заданий идут в дополнительный рейтинг. Нажмите «Забрать награду», когда условие выполнено."
      : "Очки от этих заданий идут в основной рейтинг. Нажмите «Забрать награду», когда условие выполнено.";

  return (
    <div
      className={cn("uix-content-x box-border min-h-full", inFeed ? "pb-6 pt-0" : "pb-8 pt-1")}
    >
      <motion.header
        className={cn(
          "relative overflow-hidden rounded-[1.35rem] border border-primary/25 bg-gradient-to-br from-primary/22 via-primary/10 to-transparent shadow-[0_12px_40px_-18px_hsl(var(--primary)/0.55)] dark:from-primary/18 dark:via-primary/8 dark:shadow-[0_14px_44px_-16px_hsl(var(--primary)/0.45)]",
          inFeed ? "mb-3 px-4 py-3.5" : "mb-5 px-5 py-5",
        )}
        initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
        aria-labelledby="edge-tasks-surface-title"
      >
        <div
          className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-primary/20 blur-2xl dark:bg-primary/25"
          aria-hidden
        />
        <div className={cn("relative flex flex-col", inFeed ? "gap-1.5" : "gap-2")}>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
            {heroKicker}
          </p>
          <h2
            id="edge-tasks-surface-title"
            className={cn(
              "font-bold leading-tight tracking-tight text-foreground",
              inFeed ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
            )}
          >
            Задания
          </h2>
          <p
            className={cn(
              "max-w-prose leading-snug text-muted-foreground",
              inFeed ? "text-[12px] line-clamp-4" : "text-[13px]",
            )}
          >
            {heroBody}
          </p>
          <p
            className={cn(
              "max-w-prose leading-snug text-muted-foreground/85",
              inFeed ? "text-[10px] line-clamp-2" : "text-[11px]",
            )}
          >
            Дневные счётчики заданий обнуляются в полночь по UTC (как в серверной игре).
          </p>
          {participantState?.taskQuestSummary && participantState.taskQuestSummary.presetTotal > 0 ? (
            <EdgeTaskQuestSummaryStrip summary={participantState.taskQuestSummary} className={inFeed ? "mt-2" : "mt-3"} />
          ) : null}
        </div>
      </motion.header>

      {!presets.length ? (
        <ListEmptyState
          icon={Sparkles}
          title="Пока без заданий"
          description="Когда организатор добавит задания, они появятся здесь — с наградой в очках и простыми условиями."
          className="min-h-[180px] gap-3 rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent px-4 py-8 dark:from-primary/[0.1]"
        />
      ) : !hasAny ? (
        <ListEmptyState
          icon={Sparkles}
          title="Нет заданий для этого рейтинга"
          description="В кампании есть задания, но ни одно не относится к выбранным вкладкам рейтинга. Проверьте настройки у организатора."
          className="min-h-[160px] gap-3 rounded-3xl border border-dashed border-primary/25 bg-muted/10 px-4 py-6"
        />
      ) : (
        <div className={inFeed ? "space-y-6" : "space-y-8"}>
          {showPrimary ? (
            <section className="space-y-3" aria-label="Задания для основного рейтинга">
              {bothBoards ? (
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-primary/90">Основной рейтинг</h3>
              ) : null}
              {visiblePrimary.length ? (
                <EdgePresetTasksCard
                  edgeId={edgeId}
                  presets={visiblePrimary}
                  interactLocked={interactLocked}
                  variant="surface"
                  participantState={participantState}
                />
              ) : bothBoards ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-[13px] text-muted-foreground">
                  Нет заданий для основного рейтинга.
                </p>
              ) : null}
            </section>
          ) : null}
          {showSecondary ? (
            <section className="space-y-3" aria-label="Задания для дополнительного рейтинга">
              {bothBoards ? (
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-primary/90">Дополнительный рейтинг</h3>
              ) : null}
              {visibleSecondary.length ? (
                <EdgePresetTasksCard
                  edgeId={edgeId}
                  presets={visibleSecondary}
                  interactLocked={interactLocked}
                  variant="surface"
                  participantState={participantState}
                />
              ) : bothBoards ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-[13px] text-muted-foreground">
                  Нет заданий для дополнительного рейтинга.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
