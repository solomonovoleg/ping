import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Sparkles } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { fetchEdgeMoneyCampaignConfig } from "@/lib/edge-money-public";
import { fetchEdgeLeaderboard } from "@/lib/edge-participant";
import { EdgeMoneyLeaderboardRows } from "./EdgeMoneyLeaderboardRows";
import { emoneyPresetToStyle } from "./emoney-color-presets";
import "./edge-money-template.css";

type Props = {
  edgeId: string;
  userId: number | string;
  onOpen: () => void;
  className?: string;
  variant?: "feed" | "banner";
};

export function EdgeMoneyFeedCard({ edgeId, userId, onOpen, className, variant = "feed" }: Props) {
  const isGuest = userId === "guest" || userId == null;

  const moneyQ = useQuery({
    queryKey: ["edge", "money", "campaign-config", edgeId],
    queryFn: () => fetchEdgeMoneyCampaignConfig(edgeId),
    enabled: Boolean(edgeId),
    staleTime: 60_000,
    retry: 1,
  });

  const lbKind: "primary" | "secondary" = moneyQ.data?.leaderboardSecondaryEnabled ? "secondary" : "primary";

  const lbQ = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId, lbKind, "feed5"],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 5, lbKind),
    enabled: Boolean(edgeId) && Boolean(moneyQ.data) && !isGuest,
    staleTime: 30_000,
    retry: 1,
  });

  const schemeStyle = useMemo(
    () => emoneyPresetToStyle(moneyQ.data?.money.colorScheme),
    [moneyQ.data?.money.colorScheme],
  );

  const locked = Boolean(moneyQ.data?.interactLocked);
  const headline = moneyQ.data?.money.headline?.trim() || moneyQ.data?.title?.trim() || "EDGE MONEY";
  const ctaLabel = locked ? "Игра недоступна" : isGuest ? "Войти и вступить" : "Вступить в игру";
  const ctaDisabled = locked;

  if (moneyQ.isLoading) {
    return (
      <div className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)} data-edge-id={edgeId}>
        <div className="overflow-hidden rounded-2xl border border-border/55 bg-card/[0.34] p-3">
          <Skeleton className="aspect-square w-full max-w-full rounded-xl bg-foreground/10" />
        </div>
      </div>
    );
  }

  if (moneyQ.isError || !moneyQ.data) {
    return (
      <div className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}>
        <ErrorWithRetry
          title="EDGE MONEY"
          description={moneyQ.error instanceof Error ? moneyQ.error.message : "Не загрузилось"}
          onRetry={() => void moneyQ.refetch()}
          className="min-h-[140px] rounded-2xl border border-border/60 bg-card/[0.32]"
        />
      </div>
    );
  }

  const entries = lbQ.data?.entries ?? [];
  const myRank = lbQ.data?.myRank ?? null;
  const myEntry = entries.find((e) => e.isMe);
  const myXp = myEntry?.xp ?? null;
  const viewerName = isGuest ? "Вы" : "Вы";

  const square = (
    <div
      data-edge-money-template
      className="relative flex aspect-square w-full max-w-full flex-col overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-[#0c0c12] to-[#030305] text-white shadow-inner"
      style={schemeStyle}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Banknote className="h-4 w-4 shrink-0 emoney-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">EDGE MONEY</p>
            <p className="truncate text-xs font-semibold text-white/90">{headline}</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 emoney-badge-text" aria-hidden />
      </div>

      <div className="emoney-hide-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-1">
        {isGuest || lbQ.isLoading ? (
          <p className="px-1 py-3 text-center text-[11px] leading-snug text-white/45">
            {isGuest
              ? "Войдите, чтобы видеть рейтинг и участвовать."
              : "Загрузка рейтинга…"}
          </p>
        ) : lbQ.isError ? (
          <p className="px-1 py-2 text-center text-[11px] emoney-badge-text" style={{ opacity: 0.9 }}>Рейтинг временно недоступен</p>
        ) : (
          <EdgeMoneyLeaderboardRows
            entries={entries}
            myRank={myRank}
            myXp={myXp}
            myDisplayName={viewerName}
            maxRows={5}
            compact
          />
        )}
      </div>

      <div className="border-t border-white/10 px-2 py-2">
        <p className="mb-1.5 text-center text-[10px] text-white/40">Полная версия: свайп «Инфо · Главная · Задания»</p>
        <TapScaleButton
          type="button"
          haptic
          className={cn(
            "flex min-h-[var(--uix-touch-min)] w-full items-center justify-center rounded-xl emoney-accent-bg py-2.5 text-sm font-bold emoney-on-accent-fg",
            ctaDisabled && "opacity-50",
          )}
          disabled={ctaDisabled}
          onClick={onOpen}
        >
          {ctaLabel}
        </TapScaleButton>
      </div>
    </div>
  );

  return (
    <div
      className={cn(variant === "feed" ? "w-full" : "uix-content-x-tight py-2", className)}
      data-user-id={String(userId)}
      data-edge-id={edgeId}
    >
      {square}
    </div>
  );
}
