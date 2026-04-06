import type { CompanionResultsConfig } from "../types";
import type { ResultsLivePayload } from "@/lib/edge-gamification";
import { EDGE_CARD, EDGE_CHIP_ACCENT } from "@/features/edge-companion/edge-uix";
import { ListEmptyState } from "@/components/ui/empty";
import { CalendarClock, Sparkles, Trophy } from "lucide-react";

type Props = {
  staticConfig: CompanionResultsConfig | null;
  live: ResultsLivePayload | null;
};

function formatDrawnAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ResultsSurfacePanel({ staticConfig, live }: Props) {
  const hasLive = Boolean(live && live.winners.length > 0);
  const hasStatic = Boolean(
    staticConfig &&
      (staticConfig.lastDrawSummary ||
        staticConfig.nextDrawHint ||
        (staticConfig.winners && staticConfig.winners.length > 0)),
  );

  if (!hasLive && !hasStatic) {
    return (
      <div className="uix-content-x box-border min-h-full pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]">
        <ListEmptyState
          icon={Trophy}
          title="Итоги и розыгрыши"
          description="Когда пройдёт розыгрыш, победители появятся здесь. Организатор может добавить подсказку о следующем этапе."
          className={`${EDGE_CARD} min-h-[200px]`}
        />
      </div>
    );
  }

  return (
    <section
      className="uix-content-x box-border min-h-full space-y-[var(--uix-space-4)] pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]"
      aria-label="Итоги кампании"
    >
      <h2 className="font-edge-pet rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/12 to-transparent px-4 py-3 text-xl font-semibold leading-tight text-foreground dark:from-primary/14">
        Итоги
      </h2>

      {hasLive && live ? (
        <div className={`${EDGE_CARD} space-y-[var(--uix-space-3)]`}>
          <div className="flex items-center gap-2 uix-text-caption font-semibold text-primary">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            Последний розыгрыш
          </div>
          <p className="uix-text-caption text-muted-foreground">{formatDrawnAt(live.drawnAt)}</p>
          <ul className="space-y-2">
            {live.winners.map((w) => (
              <li
                key={`${w.platformUserId}-${w.giftKey}`}
                className="flex flex-col gap-0.5 rounded-xl border border-primary/18 bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:from-primary/12"
              >
                <span className="font-medium text-foreground">{w.giftLabel}</span>
                <span className="uix-text-caption text-muted-foreground">
                  Участник {w.anonLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasStatic && staticConfig ? (
        <div className={`${EDGE_CARD} space-y-[var(--uix-space-4)]`}>
          <p className="uix-text-caption font-semibold text-primary/90">От организатора</p>
          {staticConfig.lastDrawSummary ? (
            <p className="uix-text-list-secondary leading-relaxed text-foreground/90">
              <span className="font-semibold text-foreground">Коротко о прошлом этапе: </span>
              {staticConfig.lastDrawSummary}
            </p>
          ) : null}
          {staticConfig.nextDrawHint ? (
            <p
              className={`inline-flex flex-wrap items-center gap-2 ${EDGE_CHIP_ACCENT} uix-text-list-secondary`}
            >
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              {staticConfig.nextDrawHint}
            </p>
          ) : null}
          {staticConfig.winners && staticConfig.winners.length > 0 ? (
            <ul className="space-y-2">
              {staticConfig.winners.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-xl border border-primary/16 bg-gradient-to-r from-primary/8 to-transparent px-3 py-2.5 dark:from-primary/10"
                >
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    {w.title ? (
                      <p className="uix-text-caption font-semibold text-muted-foreground">{w.title}</p>
                    ) : null}
                    <p className="uix-text-list-secondary font-medium text-foreground">{w.name}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
