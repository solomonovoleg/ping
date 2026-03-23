import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { fetchEdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { fetchEdgeParticipantState, type EdgeParticipantState } from "@/lib/edge-participant";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { EDGE_ACTION_PRIMARY, EDGE_EYEBROW } from "@/features/edge-companion/edge-uix";
import { hasStartedEdgePlay } from "@/features/edge-companion/edge-feed-play-state";
import { EdgeFeedCardEntrance } from "@/features/edge-companion/feed-delight";
import { EdgeFeedSurfacePager } from "./EdgeFeedSurfacePager";

type Props = {
  edgeId: string;
  userId: number | string;
  onOpen: () => void;
  className?: string;
  variant?: "feed" | "banner";
};

export function EdgeCompanionFeedHero({ edgeId, userId, onOpen, className, variant = "feed" }: Props) {
  const isGuest = userId === "guest" || userId == null;

  const configQ = useQuery({
    queryKey: ["edge", "companion", "campaign-config", edgeId],
    queryFn: () => fetchEdgeCompanionCampaignConfig(edgeId),
    enabled: Boolean(edgeId),
    staleTime: 60_000,
    retry: 1,
  });

  const stateQ = useQuery({
    queryKey: ["edge", "participant", "state", edgeId],
    queryFn: () => fetchEdgeParticipantState(edgeId),
    enabled: Boolean(edgeId) && !isGuest,
    staleTime: 30_000,
    retry: 1,
  });

  const stats = stateQ.data as EdgeParticipantState | undefined;
  const locked = Boolean(configQ.data?.interactLocked);
  const title = configQ.data?.title?.trim() || "Кампания EDGE";

  const started = Boolean(stats && hasStartedEdgePlay(stats));
  const ctaLabel = locked ? "Недоступно" : isGuest ? "Начать игру" : started ? "Вернуться в игру" : "Начать игру";
  const ctaDisabled = locked;
  /** Только визуал: пульс рамки CTA, без смены логики кнопки. */
  const ctaAccent = !locked && (isGuest || !started);

  if (configQ.isLoading) {
    return (
      <div
        className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}
        data-edge-id={edgeId}
      >
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card p-4">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="mt-4 h-[280px] w-full rounded-xl" />
          <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (configQ.isError || !configQ.data) {
    return (
      <div className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}>
        <ErrorWithRetry
          title="EDGE"
          description={
            configQ.error instanceof Error ? configQ.error.message : "Не удалось загрузить кампанию."
          }
          onRetry={() => void configQ.refetch()}
          className="min-h-[140px] rounded-2xl border border-border/60"
        />
      </div>
    );
  }

  const campaign = configQ.data;

  const card = (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/12 via-card to-card shadow-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.18),transparent)]" />

      <div className="relative px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className={EDGE_EYEBROW}>EDGE · интерактив</p>
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            </div>
          </div>
          {locked ? (
            <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
              Пауза / завершено
            </span>
          ) : null}
        </div>

        <EdgeFeedSurfacePager
          edgeId={edgeId}
          campaign={campaign}
          stats={stats}
          isGuest={isGuest}
          stateLoading={stateQ.isLoading}
          stateError={stateQ.isError}
          locked={locked}
        />

        <div className={cn("mt-4 w-full", ctaAccent && "edge-feed-cta-accent-wrap")}>
          <TapScaleButton
            type="button"
            haptic
            disabled={ctaDisabled}
            onClick={onOpen}
            className={`${EDGE_ACTION_PRIMARY} relative z-[1] w-full`}
            aria-label={ctaLabel}
          >
            {ctaLabel}
          </TapScaleButton>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}
      data-user-id={String(userId)}
      data-edge-id={edgeId}
    >
      {variant === "feed" ? (
        <EdgeFeedCardEntrance className="w-full">{card}</EdgeFeedCardEntrance>
      ) : (
        card
      )}
    </div>
  );
}
