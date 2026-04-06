import { useEffect, useMemo, useState } from "react";
import { fetchEdgeParticipantState } from "@/lib/edge-participant";
import { ChevronLeft, Radio, Sparkles } from "lucide-react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageTitle } from "@/components/PageTitle";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { fetchEdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { resolveEdgeCompanionBackFromSearch } from "@/features/edge-companion/edge-companion-navigation";
import { EdgeCompanionCampaignShell } from "@/features/edge-companion/EdgeCompanionCampaignShell";
import { EdgeMoneyTemplateFull } from "@/features/edge-money-template/EdgeMoneyTemplateFull";
import { resolveLeaderboardVisibility, resolveVisibleSurfaces } from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import { buildInteractiveTabs, tabLabel } from "@/features/edge-companion/interactive-template/build-interactive-tabs";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";
import { EdgeIntroFootnote } from "@/features/edge-companion/components/EdgeIntroFootnote";
import { markIntroOpenedFullIfEligible } from "@/features/edge-companion/edge-intro-onboarding";

function parseEdgeIdFromSearch(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

function normalizeSearchForParams(search: string): string {
  return search.startsWith("?") ? search : search ? `?${search}` : "";
}

export default function EdgeCompanion() {
  const queryClient = useQueryClient();
  const [loc, setLocation] = useLocation();
  const search = useSearch();
  const [matchEdgeId, paramsEdge] = useRoute("/edge/:edgeId");
  const { user } = useAuth();

  const edgeCampaignId = useMemo(() => {
    if (matchEdgeId && paramsEdge?.edgeId) {
      try {
        return decodeURIComponent(paramsEdge.edgeId);
      } catch {
        return paramsEdge.edgeId;
      }
    }
    return parseEdgeIdFromSearch(normalizeSearchForParams(search));
  }, [matchEdgeId, paramsEdge, search]);

  const companionBackPath = useMemo(
    () => resolveEdgeCompanionBackFromSearch(normalizeSearchForParams(search)),
    [search],
  );

  /** Старые закладки `/edge/companion?edgeId=` → `/edge/{id}?back=` */
  useEffect(() => {
    const pathOnly = loc.split("?")[0];
    if (pathOnly !== "/edge/companion") return;
    const id = parseEdgeIdFromSearch(normalizeSearchForParams(search));
    if (!id) return;
    const back = resolveEdgeCompanionBackFromSearch(normalizeSearchForParams(search));
    setLocation(`/edge/${encodeURIComponent(id)}?${new URLSearchParams({ back }).toString()}`, {
      replace: true,
    });
  }, [loc, search, setLocation]);
  const [surfaceLabel, setSurfaceLabel] = useState("");

  const campaignQuery = useQuery({
    queryKey: ["edge", "companion", "campaign-config", edgeCampaignId],
    queryFn: () => fetchEdgeCompanionCampaignConfig(edgeCampaignId),
    enabled: Boolean(user?.id && edgeCampaignId),
    retry: 1,
  });

  const participantStateQuery = useQuery({
    queryKey: ["edge", "participant", "state", edgeCampaignId],
    queryFn: () => fetchEdgeParticipantState(edgeCampaignId!),
    enabled: Boolean(user?.id && edgeCampaignId),
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (!edgeCampaignId) return;
    const taps = participantStateQuery.data?.introTapCount ?? 0;
    markIntroOpenedFullIfEligible(edgeCampaignId, taps);
  }, [edgeCampaignId, participantStateQuery.data?.introTapCount]);

  const campaign = campaignQuery.data;

  const companionVisibleCount = useMemo(() => {
    if (!campaign) return 1;
    if (campaign.edgeType === "money") return 3;
    const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
    const { primaryOn, secondaryOn } = resolveLeaderboardVisibility(campaign.leaderboard);
    const vis = resolveVisibleSurfaces({
      ui,
      edgeType: campaign.edgeType,
      leaderboardPrimaryEnabled: primaryOn,
      leaderboardSecondaryEnabled: secondaryOn,
      taskPresetsCount: (campaign.taskPresets ?? []).length,
    });
    const tabs = buildInteractiveTabs(vis, Boolean(campaign.pingInviteDm?.template?.trim()));
    return Math.max(1, tabs.length);
  }, [campaign]);

  useEffect(() => {
    if (!campaign) {
      setSurfaceLabel("");
      return;
    }
    if (campaign.edgeType === "money") {
      setSurfaceLabel("Инфо · Главная · Задания");
      return;
    }
    const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
    const { primaryOn, secondaryOn } = resolveLeaderboardVisibility(campaign.leaderboard);
    const vis = resolveVisibleSurfaces({
      ui,
      edgeType: campaign.edgeType,
      leaderboardPrimaryEnabled: primaryOn,
      leaderboardSecondaryEnabled: secondaryOn,
      taskPresetsCount: (campaign.taskPresets ?? []).length,
    });
    const tabs = buildInteractiveTabs(vis, Boolean(campaign.pingInviteDm?.template?.trim()));
    const ch = tabs.indexOf("character");
    const id = ch >= 0 ? tabs[ch]! : tabs[0];
    setSurfaceLabel(id ? tabLabel(id) : "");
  }, [campaign]);

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <PageTitle title={campaign?.title?.trim() ? campaign.title.trim() : "Кампания"} />
      <header className="glass z-10 flex shrink-0 items-center gap-2 border-b border-primary/15 bg-gradient-to-r from-primary/[0.08] via-transparent to-primary/[0.06] uix-content-x pt-6 pb-3 dark:from-primary/[0.1] dark:to-primary/[0.08]">
        <TapScaleButton
          type="button"
          onClick={() => setLocation(companionBackPath)}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary transition-colors"
          aria-label={
            companionBackPath === "/posts" ? "Назад к ленте" : "Назад к посту или профилю"
          }
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <div className="min-w-0 flex-1">
          {edgeCampaignId ? (
            <div className="space-y-0.5">
              <h1 className="uix-text-title truncate" title={edgeCampaignId}>
                {campaign?.edgeType === "money"
                  ? "ДЕЛАЕМ ДЕНЬГИ"
                  : campaign?.title?.trim()
                    ? campaign.title.trim()
                    : campaignQuery.isLoading
                      ? "Загрузка…"
                      : "Кампания"}
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {campaign?.edgeType === "money" ? "EDGE MONEY" : "Интерактив"}
              </p>
              {surfaceLabel ? (
                <p className="truncate text-[11px] font-semibold text-primary">{surfaceLabel}</p>
              ) : null}
            </div>
          ) : (
            <>
              <h1 className="uix-text-title truncate">Кампании</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">Интерактивные активности</p>
            </>
          )}
        </div>
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))] [-webkit-overflow-scrolling:touch]",
          campaign?.edgeType === "money" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {!user?.id ? (
          <ListEmptyState
            icon={Sparkles}
            title="Войдите в аккаунт"
            description="Войдите, чтобы открыть кампанию и участвовать."
            actionLabel="К ленте"
            onAction={() => setLocation("/posts")}
            className="m-[var(--uix-space-4)] min-h-[200px] rounded-2xl border border-dashed border-border/60 bg-card/40"
          />
        ) : !edgeCampaignId ? (
          <ListEmptyState
            icon={Radio}
            title="Кампания не выбрана"
            description="Откройте пост с кампанией в ленте и нажмите блок интерактива."
            actionLabel="Перейти в ленту"
            onAction={() => setLocation("/posts")}
            className="m-[var(--uix-space-4)] min-h-[200px] rounded-2xl border border-dashed border-border/60 bg-card/40"
          />
        ) : campaignQuery.isLoading ? (
          <div className="uix-content-x flex min-h-0 flex-1 flex-col gap-3 py-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="min-h-[200px] flex-1 rounded-3xl" />
          </div>
        ) : campaignQuery.isError ? (
          <div className="uix-content-x py-4">
            <ErrorWithRetry
              title="Не удалось загрузить кампанию"
              description={
                campaignQuery.error instanceof Error
                  ? campaignQuery.error.message
                  : "Сервис кампании сейчас недоступен — попробуйте позже."
              }
              onRetry={() => void campaignQuery.refetch()}
              className="min-h-[200px] rounded-3xl border border-border/60 bg-card/90"
            />
          </div>
        ) : campaign && edgeCampaignId ? (
          <div className="flex min-h-[min(520px,70dvh)] flex-1 flex-col overflow-hidden">
            {campaign.edgeType === "money" ? (
              <EdgeMoneyTemplateFull
                edgeId={edgeCampaignId}
                viewerDisplayName={user?.displayName?.trim() || "Вы"}
              />
            ) : (
              <>
                <div className="uix-content-x shrink-0 pt-2 pb-1">
                  <EdgeIntroFootnote
                    edgeId={edgeCampaignId}
                    introTapCount={participantStateQuery.data?.introTapCount}
                    layout="full"
                    hasMultipleSurfaces={companionVisibleCount > 1}
                  />
                </div>
                <EdgeCompanionCampaignShell
                  edgeCampaignId={edgeCampaignId}
                  campaign={campaign}
                  onBack={() => setLocation(companionBackPath)}
                  backAriaLabel={
                    companionBackPath === "/posts"
                      ? "Назад к ленте"
                      : "Назад к посту или профилю"
                  }
                  participantState={participantStateQuery.data}
                  onParticipantState={(state) => {
                    queryClient.setQueryData(["edge", "participant", "state", edgeCampaignId], state);
                  }}
                  introTapCount={participantStateQuery.data?.introTapCount ?? 0}
                  onActiveSurfaceLabel={setSurfaceLabel}
                />
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
