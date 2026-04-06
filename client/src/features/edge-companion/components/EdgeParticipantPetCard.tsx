import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Apple,
  Bath,
  ChevronDown,
  Clock,
  Flame,
  Gamepad2,
  HandHeart,
  Loader2,
  MousePointerClick,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  EdgeCampaignLockedError,
  EdgeInteractCooldownError,
  fetchEdgeLeaderboard,
  fetchEdgeParticipantState,
  postEdgeParticipantFeed,
  postEdgeParticipantInteract,
  type EdgeInteractKind,
  type EdgeParticipantState,
} from "@/lib/edge-participant";
import {
  formatCareDeadlineHint,
  getHungerLevel,
  hungerBadgeLabel,
} from "@/features/edge-companion/edge-pet-display-helpers";
import { EdgeCompanionCharacterHero } from "@/features/edge-companion/components/EdgeCompanionCharacterHero";
import {
  EDGE_FEED_NEW_PLAYER_SUBLINE,
  hasStartedEdgePlay,
} from "@/features/edge-companion/edge-feed-play-state";
import type { CompanionCharacterConfig } from "@/features/edge-companion/companion-surfaces/types";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ACTIVE_NEED_RU: Record<"hungry" | "dirty" | "bored" | "anxious", string> = {
  hungry: "Хочет есть",
  dirty: "Нужно убрать",
  bored: "Хочет поиграть",
  anxious: "Нуждается в спокойствии",
};

const LIFE_QUEUE_RU: Record<"feed" | "toilet" | "play" | "calm", string> = {
  feed: "Покормить",
  toilet: "Туалет",
  play: "Поиграть",
  calm: "Успокоить",
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

type ActionKind = "feed" | EdgeInteractKind;

const ACTION_ROWS: { kind: ActionKind; label: string; Icon: LucideIcon }[] = [
  { kind: "feed", label: "Покормить", Icon: Apple },
  { kind: "play", label: "Поиграть", Icon: Gamepad2 },
  { kind: "pet", label: "Погладить", Icon: HandHeart },
  { kind: "tap", label: "Тапнуть", Icon: MousePointerClick },
  { kind: "toilet", label: "Туалет", Icon: Bath },
  { kind: "calm", label: "Успокоить", Icon: Sparkles },
];

function resolvePrimaryKind(rec: EdgeParticipantState["recommendedAction"]): ActionKind {
  if (rec && rec !== "feed") return rec;
  return "feed";
}

type Props = {
  edgeId: string;
  campaignTitle?: string;
  character?: CompanionCharacterConfig | null;
  interactLocked?: boolean;
  /** Есть ли экран «Задания» в свайпе — показываем короткую подсказку. */
  showTasksPagerHint?: boolean;
  giftTemplates?: unknown[];
};

/**
 * Полноэкранный персонаж: макет как в референсе — плоские метрики, одно главное действие,
 * остальное в лёгком меню «Ещё действия».
 */
export function EdgeParticipantPetCard({
  edgeId,
  campaignTitle: _campaignTitle,
  character,
  interactLocked,
  showTasksPagerHint = false,
  giftTemplates = [],
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();

  const stateQuery = useQuery({
    queryKey: ["edge", "participant", "state", edgeId],
    queryFn: () => fetchEdgeParticipantState(edgeId),
    enabled: Boolean(edgeId),
    retry: 1,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 30),
    enabled: Boolean(edgeId),
    staleTime: 60_000,
  });

  const feedMutation = useMutation({
    mutationFn: () => postEdgeParticipantFeed(edgeId),
    onSuccess: (data) => {
      qc.setQueryData(["edge", "participant", "state", edgeId], data);
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
      const target = data.actionProgress?.target ?? 15;
      const feedProgress = data.actionProgress?.feed ?? 0;
      if (feedProgress > 0) {
        toast({
          title: "Кормление",
          description: `Прогресс: ${feedProgress}/${target}. Продолжайте «Покормить».`,
        });
      } else {
        toast({ title: "Отлично!", description: "Персонаж накормлен" });
      }
    },
    onError: (e) => {
      if (e instanceof EdgeCampaignLockedError) {
        toast({ title: e.message });
        return;
      }
      toast({
        title: e instanceof Error ? e.message : "Не удалось выполнить действие",
        variant: "destructive",
      });
    },
  });

  const interactMutation = useMutation({
    mutationFn: (kind: EdgeInteractKind) => postEdgeParticipantInteract(edgeId, kind),
    onSuccess: (data, kind) => {
      qc.setQueryData(["edge", "participant", "state", edgeId], data);
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
      const target = data.actionProgress?.target ?? 15;
      const playProgress = data.actionProgress?.play ?? 0;
      const toiletProgress = data.actionProgress?.toilet ?? 0;
      if (kind === "play" && playProgress > 0) {
        toast({ title: "Игра", description: `Прогресс: ${playProgress}/${target}` });
        return;
      }
      if (kind === "toilet" && toiletProgress > 0) {
        toast({ title: "Уборка", description: `Прогресс: ${toiletProgress}/${target}` });
        return;
      }
      const desc =
        kind === "play"
          ? "Вы поиграли с птенцом."
          : kind === "pet"
            ? "Птенец доволен лаской."
            : kind === "toilet"
              ? "Сходили в туалет."
              : kind === "calm"
                ? "Птенец успокоился."
                : "Ещё один тап засчитан.";
      toast({ title: "Супер!", description: desc });
    },
    onError: (e) => {
      if (e instanceof EdgeInteractCooldownError) {
        toast({ title: "Перезарядка", description: e.message });
        return;
      }
      if (e instanceof EdgeCampaignLockedError) {
        toast({ title: e.message });
        return;
      }
      toast({
        title: e instanceof Error ? e.message : "Не удалось выполнить действие",
        variant: "destructive",
      });
    },
  });

  if (stateQuery.isLoading) {
    return (
      <div className="space-y-4 pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]">
        <Skeleton className="h-8 w-2/3 max-w-xs rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <Skeleton className="h-24 rounded-none md:col-span-3" />
          <Skeleton className="h-52 rounded-2xl md:col-span-6" />
          <Skeleton className="h-32 rounded-none md:col-span-3" />
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    );
  }

  if (stateQuery.isError) {
    return (
      <ErrorWithRetry
        title="Персонаж"
        description={
          stateQuery.error instanceof Error ? stateQuery.error.message : "Попробуйте ещё раз."
        }
        onRetry={() => void stateQuery.refetch()}
        className="min-h-[160px] rounded-[1.75rem] border border-border/50 bg-card/50"
      />
    );
  }

  const s = stateQuery.data;
  if (!s) return null;

  const hunger = getHungerLevel(s.lastFedAt, s.happyScore);
  const hungerBadge = hungerBadgeLabel(hunger);
  const locked = Boolean(interactLocked);
  const target = s.actionProgress?.target ?? 15;
  const feedProgress = s.actionProgress?.feed ?? 0;
  const toiletProgress = s.actionProgress?.toilet ?? 0;
  const playProgress = s.actionProgress?.play ?? 0;
  const activeNeedHint =
    s.activeNeed && ACTIVE_NEED_RU[s.activeNeed] ? ACTIVE_NEED_RU[s.activeNeed] : null;
  const careHint = formatCareDeadlineHint(s.careDeadlineAt ?? null);
  const life = s.lifeSimulation?.enabled === true ? s.lifeSimulation : null;
  const lifePct =
    life && life.lifeMax > life.lifeMin
      ? Math.round(
          ((life.lifeRating - life.lifeMin) / (life.lifeMax - life.lifeMin)) * 100,
        )
      : 0;
  const myRank = leaderboardQuery.data?.myRank;

  const started = hasStartedEdgePlay(s);
  const showStartCta = !locked && !started;

  const primaryKind = resolvePrimaryKind(s.recommendedAction);
  const effectiveKind: ActionKind = showStartCta ? "feed" : primaryKind;
  const secondaryActions = ACTION_ROWS.filter((a) => a.kind !== effectiveKind);
  const primaryDefEffective = ACTION_ROWS.find((a) => a.kind === effectiveKind) ?? ACTION_ROWS[0]!;
  const primaryLabel = showStartCta ? "Начать игру" : primaryDefEffective.label;
  const PrimaryActionIcon = showStartCta ? Gamepad2 : primaryDefEffective.Icon;

  const runKind = (kind: ActionKind) => {
    if (kind === "feed") feedMutation.mutate();
    else interactMutation.mutate(kind);
  };

  const isPendingKind = (kind: ActionKind) =>
    (kind === "feed" && feedMutation.isPending) ||
    (kind !== "feed" && interactMutation.isPending && interactMutation.variables === kind);

  const isPendingPrimary = isPendingKind(effectiveKind);

  const primaryDisabled =
    locked ||
    isPendingPrimary ||
    (effectiveKind === "feed" && interactMutation.isPending) ||
    (effectiveKind !== "feed" && feedMutation.isPending);

  return (
    <section
      className="space-y-[var(--uix-space-4)] rounded-3xl border border-primary/12 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent px-1 pb-[var(--uix-space-6)] pt-[var(--uix-space-2)] dark:from-primary/[0.08]"
      aria-label="Персонаж и уход"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-primary/[0.05] px-2 py-1.5 text-[11px] text-foreground/80 dark:bg-primary/[0.07]">
        {life ? (
          <span
            className="inline-flex flex-col gap-0.5 font-medium text-emerald-800 dark:text-emerald-300/95"
            title="Рейтинг жизни персонажа"
          >
            <span className="tabular-nums">
              Жизнь {life.lifeRating}/{life.lifeMax}
            </span>
            <span className="h-[3px] w-[4.5rem] max-w-full overflow-hidden rounded-full bg-muted/60">
              <span
                className="block h-full rounded-full bg-emerald-500/90 dark:bg-emerald-400/90"
                style={{ width: `${clampPct(lifePct)}%` }}
              />
            </span>
          </span>
        ) : null}
        {typeof myRank === "number" ? (
          <span className="font-medium tabular-nums text-foreground/90" title="Место в лидерборде кампании">
            Топ #{myRank}
          </span>
        ) : null}
        {hungerBadge ? (
          <span className="font-medium text-orange-600 dark:text-orange-400">{hungerBadge}</span>
        ) : null}
        {s.careStreakDays > 0 ? (
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {s.careStreakDays} дн. подряд
          </span>
        ) : null}
      </div>

      <EdgeCompanionCharacterHero
        edgeId={edgeId}
        character={character ?? null}
        templates={giftTemplates}
        stats={s}
        locked={locked}
        reducedMotion={reducedMotion}
        speechBubbleOverride={showStartCta ? EDGE_FEED_NEW_PLAYER_SUBLINE : null}
      />

      {locked ? (
        <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300/95" role="status">
          Кампания на паузе или уже закончилась — с персонажом сейчас нельзя взаимодействовать. Остальные разделы — верхние вкладки или свайп.
        </p>
      ) : null}

      {!locked && showTasksPagerHint ? (
        <p
          className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/[0.06] px-3 py-2.5 text-[12px] leading-snug text-muted-foreground dark:bg-primary/[0.09]"
          role="status"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden strokeWidth={2} />
          <span>
            <span className="font-semibold text-foreground">Дополнительные очки</span> — во вкладке{" "}
            <span className="font-medium text-primary">«Задания»</span> (слева от «Персонаж») или свайпните экран
            вбок.
          </span>
        </p>
      ) : null}

      {!locked && life && life.needQueue.length > 0 ? (
        <div
          className="rounded-xl border border-primary/12 bg-primary/[0.04] px-2.5 py-2 text-[11px] dark:bg-primary/[0.06]"
          role="status"
          aria-label="Очередь запросов персонажа"
        >
          <p className="mb-1 font-semibold text-foreground/90">Сейчас важно (по очереди)</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
            {life.needQueue.map((item) => (
              <li
                key={item.id}
                className={cn(
                  item.penalized && "text-amber-700 dark:text-amber-400",
                  item.overdue && !item.penalized && "font-medium text-destructive",
                )}
              >
                {LIFE_QUEUE_RU[item.kind]}
                {item.penalized ? " — просрочено (штраф)" : item.overdue ? " — пора!" : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {!locked && (activeNeedHint || careHint) ? (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
          {activeNeedHint ? (
            <span className="font-medium text-orange-600 dark:text-orange-400">{activeNeedHint}</span>
          ) : null}
          {activeNeedHint && careHint ? <span aria-hidden>·</span> : null}
          {careHint ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {careHint}
            </span>
          ) : null}
        </p>
      ) : null}

      {feedProgress > 0 || toiletProgress > 0 || playProgress > 0 ? (
        <p className="rounded-lg border border-primary/12 bg-primary/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-foreground/85 dark:bg-primary/[0.08]">
          Прогресс:{" "}
          <span className="text-primary tabular-nums">
            кормить {feedProgress}/{target}
          </span>{" "}
          · туалет{" "}
          <span className="text-primary tabular-nums">
            {toiletProgress}/{target}
          </span>{" "}
          · игра{" "}
          <span className="text-primary tabular-nums">
            {playProgress}/{target}
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <TapScaleButton
          type="button"
          haptic
          disabled={primaryDisabled}
          onClick={() => runKind(effectiveKind)}
          className={cn(
            "flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold text-white shadow-md transition-colors",
            "bg-orange-500 hover:bg-orange-600 active:scale-[0.99] dark:bg-orange-600 dark:hover:bg-orange-500",
          )}
          aria-label={primaryLabel}
        >
          {isPendingPrimary ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <PrimaryActionIcon className="h-5 w-5 shrink-0 opacity-95" aria-hidden strokeWidth={2} />
          )}
          {primaryLabel}
        </TapScaleButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={locked}
              className={cn(
                "flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/[0.04] px-3 py-2.5 text-[13px] font-medium text-primary/90 transition-colors",
                "hover:bg-primary/10 hover:text-primary",
                locked && "pointer-events-none opacity-50",
              )}
            >
              Ещё действия
              <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-[min(100vw-2rem,300px)]">
            {secondaryActions.map(({ kind, label, Icon }) => (
              <DropdownMenuItem
                key={kind}
                disabled={locked || isPendingKind(kind) || (kind === "feed" && interactMutation.isPending) || (kind !== "feed" && feedMutation.isPending)}
                className="gap-2 py-2.5"
                onSelect={() => {
                  runKind(kind);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </section>
  );
}
