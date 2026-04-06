import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { fetchEdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { fetchEdgeParticipantState, type EdgeParticipantState } from "@/lib/edge-participant";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { EDGE_EYEBROW } from "@/features/edge-companion/edge-uix";
import { hasStartedEdgePlay } from "@/features/edge-companion/edge-feed-play-state";
import { EdgeFeedCardEntrance } from "@/features/edge-companion/feed-delight";
import { EdgeMoneyFeedCard } from "@/features/edge-money-template/EdgeMoneyFeedCard";
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
  const title = configQ.data?.title?.trim() || "Интерактивная кампания";

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
        <div className="edge-feed-shell overflow-hidden rounded-2xl border border-border/55 bg-card/[0.34] p-3">
          <Skeleton className="h-4 w-40 rounded-md bg-foreground/15" />
          <Skeleton className="mt-3.5 h-[320px] w-full rounded-xl bg-foreground/10" />
          <Skeleton className="mt-3 h-12 w-full rounded-2xl bg-foreground/16" />
        </div>
      </div>
    );
  }

  if (configQ.isError || !configQ.data) {
    return (
      <div className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}>
        <ErrorWithRetry
          title="Не загрузилось"
          description={
            configQ.error instanceof Error ? configQ.error.message : "Кампанию сейчас не удалось открыть."
          }
          onRetry={() => void configQ.refetch()}
          className="edge-feed-shell min-h-[160px] rounded-2xl border border-border/60 bg-card/[0.32]"
        />
      </div>
    );
  }

  const campaign = configQ.data;

  if (campaign.edgeType === "money") {
    return (
      <div
        className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}
        data-user-id={String(userId)}
        data-edge-id={edgeId}
      >
        {variant === "feed" ? (
          <EdgeFeedCardEntrance className="w-full">
            <EdgeMoneyFeedCard edgeId={edgeId} userId={userId} onOpen={onOpen} variant={variant} />
          </EdgeFeedCardEntrance>
        ) : (
          <EdgeMoneyFeedCard edgeId={edgeId} userId={userId} onOpen={onOpen} variant={variant} />
        )}
      </div>
    );
  }

  const eyebrow = "Интерактив";

  const card = (
    <div className="edge-feed-shell relative w-full overflow-hidden rounded-2xl border border-border/55 bg-card/[0.34]">
      <span className="edge-feed-shell__glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3">
        <div className="flex flex-wrap items-start justify-between gap-2 px-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary/70" aria-hidden />
            <div className="min-w-0">
              <p className={EDGE_EYEBROW}>{eyebrow}</p>
              <span className="sr-only">{title}</span>
            </div>
          </div>
          {locked ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Пауза
            </span>
          ) : null}
        </div>

        <div className="mt-[5px] min-w-0">
        <EdgeFeedSurfacePager
          edgeId={edgeId}
          campaign={campaign}
          stats={stats}
          isGuest={isGuest}
          stateLoading={stateQ.isLoading}
          stateError={stateQ.isError}
          locked={locked}
          onOpenGame={onOpen}
          openGameLabel={ctaLabel}
          openGameDisabled={ctaDisabled}
          ctaAccent={ctaAccent}
        />
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
