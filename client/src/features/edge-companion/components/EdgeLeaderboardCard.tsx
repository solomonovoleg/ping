import { useQuery } from "@tanstack/react-query";
import { Flame, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { fetchEdgeLeaderboard, type EdgeLeaderboardEntry } from "@/lib/edge-participant";
import { EDGE_CHIP_ACCENT } from "@/features/edge-companion/edge-uix";

type Props = {
  edgeId: string;
};

function rowClass(entry: EdgeLeaderboardEntry): string {
  if (entry.isMe) {
    return "border-primary/35 bg-primary/5 ring-1 ring-primary/15";
  }
  return "border-border/50 bg-secondary/15";
}

export function EdgeLeaderboardCard({ edgeId }: Props) {
  const q = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId],
    queryFn: () => fetchEdgeLeaderboard(edgeId),
    enabled: Boolean(edgeId),
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3 py-1">
        <Skeleton className="h-4 w-36 rounded-md" />
        <Skeleton className="h-3 w-2/3 max-w-xs rounded-md" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-lg" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-lg" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-lg" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorWithRetry
        title="Лидерборд"
        description={q.error instanceof Error ? q.error.message : "Не удалось загрузить таблицу."}
        onRetry={() => void q.refetch()}
        className="min-h-0 gap-4 border-0 bg-transparent p-0 py-4"
      />
    );
  }

  const data = q.data;
  if (!data) return null;

  return (
    <section className="space-y-4 py-1" aria-label="Лидерборд кампании EDGE">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/15 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Рейтинг</p>
          <h3 className="text-lg font-semibold leading-tight text-foreground">Лидерборд</h3>
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">
          {data.totalParticipants} уч.
        </span>
      </div>

      {typeof data.myRank === "number" ? (
        <p className="text-[13px] leading-snug text-muted-foreground">
          Ваше место:{" "}
          <span className="font-semibold text-foreground tabular-nums">{data.myRank}</span>
        </p>
      ) : (
        <p className="text-[13px] leading-snug text-muted-foreground">
          Появитесь в таблице после действий с персонажем (вкладка «Персонаж»). Призы — свайп до «Призы».
        </p>
      )}

      {data.entries.length === 0 ? (
        <div>
          <ListEmptyState
            icon={Trophy}
            title="Пока пусто"
            description="Сделайте «Начать игру» или любое действие у персонажа — очки появятся здесь. Полный список призов — в разделе «Призы»."
            className="min-h-[140px] gap-3 border-0 bg-transparent p-3"
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {data.entries.map((e, i) => (
            <li
              key={`${edgeId}-lb-${i}`}
              className={`uix-list-row flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[13px] text-muted-foreground ${rowClass(e)}`}
            >
              <span className="flex min-w-0 items-center gap-[var(--uix-space-2)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary uix-text-caption font-bold text-secondary-foreground">
                  {e.rank}
                </span>
                <span className="truncate font-medium text-foreground">
                  {e.isMe ? "Вы" : `Участник ${e.rank}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-[var(--uix-space-2)] text-right uix-text-caption">
                <span>
                  <span className="font-semibold text-foreground tabular-nums">{e.xp}</span> XP · ур.{" "}
                  {e.level}
                </span>
                {e.careStreakDays > 0 ? (
                  <span className={EDGE_CHIP_ACCENT}>
                    <Flame className="h-3.5 w-3.5" aria-hidden />
                    {e.careStreakDays}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
