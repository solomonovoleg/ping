import { useQuery } from "@tanstack/react-query";
import { Flame, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { UserAvatar } from "@/components/UserAvatar";
import { fetchEdgeLeaderboard, type EdgeLeaderboardEntry } from "@/lib/edge-participant";
import { EDGE_CHIP_ACCENT } from "@/features/edge-companion/edge-uix";
import { cn } from "@/lib/utils";

type Props = {
  edgeId: string;
  kind?: "primary" | "secondary";
};

function rowClass(entry: EdgeLeaderboardEntry, rank: number): string {
  /** Одна палитра (primary): топ-3 чуть насыщеннее, без «серых плиток». */
  const base =
    rank <= 3
      ? "border-primary/25 bg-gradient-to-r from-primary/16 via-primary/10 to-transparent dark:from-primary/18"
      : "border-primary/16 bg-gradient-to-r from-primary/10 via-primary/[0.05] to-transparent dark:from-primary/12";
  if (entry.isMe) {
    return cn(base, "ring-1 ring-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.12)]");
  }
  return base;
}

function entryLabel(e: EdgeLeaderboardEntry): string {
  const fromApi = typeof e.displayName === "string" ? e.displayName.trim() : "";
  if (fromApi) return fromApi;
  return e.isMe ? "Вы" : `Участник ${e.rank}`;
}

function ruParticipantsWord(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "участников";
  if (mod10 === 1) return "участник";
  if (mod10 >= 2 && mod10 <= 4) return "участника";
  return "участников";
}

const HEADLINE: Record<"primary" | "secondary", { kicker: string; title: string; aria: string }> = {
  primary: { kicker: "Кто впереди", title: "Основной рейтинг", aria: "Основной рейтинг участников кампании" },
  secondary: {
    kicker: "Лента и задания",
    title: "Активность",
    aria: "Рейтинг активности в ленте и заданиях",
  },
};

export function EdgeLeaderboardCard({ edgeId, kind = "primary" }: Props) {
  const headline = HEADLINE[kind];
  const q = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId, kind],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 30, kind),
    enabled: Boolean(edgeId),
    retry: 1,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-3 py-1">
        <Skeleton className="h-14 w-full rounded-2xl bg-primary/15" />
        <Skeleton className="h-4 w-36 rounded-md bg-primary/10" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-xl bg-primary/10" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-xl bg-primary/10" />
        <Skeleton className="h-[var(--uix-touch-min)] w-full rounded-xl bg-primary/10" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorWithRetry
        title={headline.title}
        description={q.error instanceof Error ? q.error.message : "Не удалось загрузить список участников."}
        onRetry={() => void q.refetch()}
        className="min-h-0 gap-4 border-0 bg-transparent p-0 py-4"
      />
    );
  }

  const data = q.data;
  if (!data) return null;

  const frozen = Boolean(data.frozen);

  return (
    <section className="space-y-4 py-1" aria-label={headline.aria}>
      {frozen ? (
        <p
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[13px] font-medium leading-snug text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
          role="status"
        >
          Итоги по этому рейтингу зафиксированы — начисление очков остановлено.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-2 rounded-2xl border border-primary/18 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent px-4 py-3 dark:from-primary/14">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/90">{headline.kicker}</p>
          <h3 className="text-lg font-bold leading-tight text-foreground">{headline.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-primary dark:bg-primary/20">
          {data.totalParticipants} {ruParticipantsWord(data.totalParticipants)}
        </span>
      </div>

      {typeof data.myRank === "number" ? (
        <p className="rounded-xl border border-primary/12 bg-primary/[0.06] px-3 py-2 text-[13px] leading-snug text-foreground/90 dark:bg-primary/[0.08]">
          Ваше место:{" "}
          <span className="font-bold tabular-nums text-primary">{data.myRank}</span>
        </p>
      ) : kind === "primary" ? (
        <p className="rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2 text-[13px] leading-snug text-foreground/85 dark:bg-primary/[0.06]">
          Займите место в списке, поиграв с персонажем на вкладке «Персонаж». Награды смотрите во вкладке «Призы».
        </p>
      ) : (
        <p className="rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2 text-[13px] leading-snug text-foreground/85 dark:bg-primary/[0.06]">
          Выполняйте задания и действия в ленте — очки появятся в этом списке. Призы — во вкладке «Призы».
        </p>
      )}

      {data.entries.length === 0 ? (
        <div>
          <ListEmptyState
            icon={Trophy}
            title="Пока пусто"
            description="Нажмите «Начать игру» или ухаживайте за персонажем — очки появятся в списке. Что разыгрывают, смотрите во вкладке «Призы»."
            className="min-h-[140px] gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.04] p-4 dark:bg-primary/[0.06]"
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {data.entries.map((e, i) => {
            const label = entryLabel(e);
            return (
              <li
                key={`${edgeId}-lb-${e.rank}-${i}`}
                className={`uix-list-row flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-[13px] text-foreground/85 ${rowClass(e, e.rank)}`}
                aria-label={`${label}: ${e.rank} место, ${e.xp} очков, уровень ${e.level}`}
              >
                <span className="flex min-w-0 items-center gap-[var(--uix-space-2)]">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 uix-text-caption font-bold tabular-nums text-primary dark:bg-primary/25"
                    aria-hidden
                  >
                    {e.rank}
                  </span>
                  <UserAvatar
                    avatarUrl={e.avatarUrl ?? null}
                    displayName={label}
                    seed={`edge-lb-${edgeId}-${e.rank}`}
                    size={36}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {label}
                    {e.isMe && label !== "Вы" ? (
                      <span className="ml-1 font-normal text-muted-foreground">(вы)</span>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-[var(--uix-space-2)] text-right uix-text-caption">
                  <span className="text-foreground/80">
                    <span className="font-bold tabular-nums text-primary">{e.xp}</span> XP · ур.{" "}
                    <span className="font-semibold text-primary/90">{e.level}</span>
                  </span>
                  {e.careStreakDays > 0 ? (
                    <span className={EDGE_CHIP_ACCENT}>
                      <Flame className="h-3.5 w-3.5" aria-hidden />
                      {e.careStreakDays}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
