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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { EdgePresetTasksCard } from "@/features/edge-companion/components/EdgePresetTasksCard";
import { EdgeCompanionCharacterHero } from "@/features/edge-companion/components/EdgeCompanionCharacterHero";
import {
  EDGE_FEED_NEW_PLAYER_SUBLINE,
  hasStartedEdgePlay,
} from "@/features/edge-companion/edge-feed-play-state";
import type { CompanionCharacterConfig } from "@/features/edge-companion/companion-surfaces/types";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import { EDGE_CHIP_ACCENT, EDGE_CHIP_WARN } from "@/features/edge-companion/edge-uix";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ACTIVE_NEED_RU: Record<"hungry" | "dirty" | "bored" | "anxious", string> = {
  hungry: "Хочет есть",
  dirty: "Нужно убрать",
  bored: "Хочет поиграть",
  anxious: "Нуждается в спокойствии",
};

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
  taskPresets?: EdgeTaskPresetPublic[];
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
  taskPresets = [],
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
    <section className="space-y-[var(--uix-space-4)] pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]" aria-label="Персонаж кампании EDGE">
      <div className="flex flex-wrap items-center gap-2">
        {hungerBadge ? (
          <span className={cn(EDGE_CHIP_WARN, "rounded-full px-2.5 py-0.5 text-[11px]")}>{hungerBadge}</span>
        ) : null}
        {s.careStreakDays > 0 ? (
          <span className={cn(EDGE_CHIP_ACCENT, "rounded-full px-2.5 py-0.5 text-[11px]")}>
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {s.careStreakDays} дн.
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
        <p
          className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-950/90 dark:text-amber-100/95"
          role="status"
        >
          Кампания на паузе или завершена — действия недоступны. Другие разделы — свайпом по точкам сверху.
        </p>
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
        <p className="text-[11px] text-muted-foreground">
          Прогресс: кормить {feedProgress}/{target} · туалет {toiletProgress}/{target} · игра {playProgress}/{target}
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
                "flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-transparent px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors",
                "hover:bg-muted/30 hover:text-foreground",
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

      {taskPresets.length > 0 ? (
        <Collapsible className="group border-t border-border/10 pt-3">
          <CollapsibleTrigger
            type="button"
            className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-between gap-2 rounded-lg px-0.5 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Задания кампании
            <ChevronDown
              className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1 data-[state=closed]:animate-none">
            <EdgePresetTasksCard edgeId={edgeId} presets={taskPresets} interactLocked={locked} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
