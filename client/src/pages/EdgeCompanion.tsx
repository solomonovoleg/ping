import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Radio, Sparkles } from "lucide-react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/PageTitle";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { resolveEdgeCompanionBackFromSearch } from "@/features/edge-companion/edge-companion-navigation";
import { EdgeCompanionCampaignShell } from "@/features/edge-companion/EdgeCompanionCampaignShell";
import {
  initialSurfaceIndex,
  resolveVisibleSurfaces,
} from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import { COMPANION_SURFACE_LABEL } from "@/features/edge-companion/companion-surfaces/surface-labels";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";

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

  const campaign = campaignQuery.data;

  useEffect(() => {
    if (!campaign) {
      setSurfaceLabel("");
      return;
    }
    const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
    const vis = resolveVisibleSurfaces({
      ui,
      edgeType: campaign.edgeType,
      leaderboardEnabled: Boolean(campaign.leaderboard?.globalEnabled),
    });
    const id = vis[initialSurfaceIndex(vis)];
    setSurfaceLabel(id ? COMPANION_SURFACE_LABEL[id] : "");
  }, [campaign]);

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <PageTitle title={campaign?.title ? `${campaign.title} · EDGE` : "EDGE Companion"} />
      <header className="glass z-10 flex shrink-0 items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-3">
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
          <h1 className="uix-text-title truncate">EDGE</h1>
          {edgeCampaignId ? (
            <div className="mt-0.5 space-y-0.5">
              <p className="truncate text-xs font-medium text-foreground/85" title={edgeCampaignId}>
                {campaign?.title ? campaign.title : campaignQuery.isLoading ? "Загрузка…" : edgeCampaignId}
              </p>
              {surfaceLabel ? (
                <p className="truncate text-[11px] text-primary font-semibold">{surfaceLabel}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Интерактивные кампании</p>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        {!user?.id ? (
          <ListEmptyState
            icon={Sparkles}
            title="Войдите в аккаунт"
            description="Чтобы открыть кампанию EDGE и участвовать в интерактиве."
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
                  : "Проверьте EDGE_UPSTREAM_URL или попробуйте позже."
              }
              onRetry={() => void campaignQuery.refetch()}
              className="min-h-[200px] rounded-3xl border border-border/60 bg-card/90"
            />
          </div>
        ) : campaign && edgeCampaignId ? (
          <EdgeCompanionCampaignShell
            edgeCampaignId={edgeCampaignId}
            campaign={campaign}
            onActiveSurfaceLabel={setSurfaceLabel}
          />
        ) : null}
      </div>
    </div>
  );
}
