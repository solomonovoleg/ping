import type { HungerLevel } from "@/features/edge-companion/edge-pet-display-helpers";
import { formatLastFedShort } from "@/features/edge-companion/edge-pet-display-helpers";
import { EDGE_INSET } from "@/features/edge-companion/edge-uix";

type Props = {
  level: number;
  happyScore: number;
  xpPct: number;
  toNextXp: number;
  lastFedAt: string | null;
  careDeadlineHint: string | null;
  hunger: HungerLevel;
};

export function EdgePetStatsPanel({
  level,
  happyScore,
  xpPct,
  toNextXp,
  lastFedAt,
  careDeadlineHint,
  hunger,
}: Props) {
  return (
    <div
      className={`relative mt-[var(--uix-space-4)] space-y-[var(--uix-space-3)] ${EDGE_INSET}`}
    >
      <div>
        <div className="mb-1 flex justify-between uix-text-caption">
          <span>Уровень {level}</span>
          <span>до след. уровня: {toNextXp} XP</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[var(--uix-duration-normal)] ease-[var(--uix-easing-out)]"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between uix-text-caption">
          <span>Забота</span>
          <span>{happyScore}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary/55 transition-[width] duration-[var(--uix-duration-normal)] ease-[var(--uix-easing-out)]"
            style={{ width: `${Math.min(100, Math.max(0, happyScore))}%` }}
          />
        </div>
      </div>
      <p className="uix-text-caption">
        Кормили: <span className="font-medium text-foreground/90">{formatLastFedShort(lastFedAt)}</span>
        {hunger !== "ok" ? (
          <span className="text-orange-700/90 dark:text-orange-300/90"> · не пропускайте кормление</span>
        ) : null}
      </p>
      {careDeadlineHint ? (
        <p className="uix-text-caption">
          <span className="font-medium text-foreground/85">{careDeadlineHint}</span>
        </p>
      ) : null}
    </div>
  );
}
