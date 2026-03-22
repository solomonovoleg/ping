import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Radio, PartyPopper } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/PageTitle";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useAuth } from "@/contexts/AuthContext";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { fetchEdgeCompanionCampaignConfig, type EdgeCompanionCampaignConfig } from "@/lib/edge-gamification";

const STATUS_LABEL: Record<EdgeCompanionCampaignConfig["status"], string> = {
  draft: "Черновик",
  published: "Активна",
  paused: "На паузе",
  ended: "Завершена",
};

function parseEdgeIdFromSearch(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

export default function EdgeCompanion() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const edgeCampaignId = useMemo(() => parseEdgeIdFromSearch(search), [search]);

  const campaignQuery = useQuery({
    queryKey: ["edge", "companion", "campaign-config", edgeCampaignId],
    queryFn: () => fetchEdgeCompanionCampaignConfig(edgeCampaignId),
    enabled: Boolean(user?.id && edgeCampaignId),
    retry: 1,
  });

  const campaign = campaignQuery.data;

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <PageTitle title={campaign?.title ? `${campaign.title} · EDGE` : "EDGE Companion"} />
      <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-y-auto overflow-x-hidden bg-background pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/posts")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary transition-colors"
            aria-label="Назад к ленте"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <div className="min-w-0 flex-1">
            <h1 className="uix-text-title truncate">EDGE</h1>
            {edgeCampaignId ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={edgeCampaignId}>
                Кампания · {edgeCampaignId.length > 36 ? `${edgeCampaignId.slice(0, 34)}…` : edgeCampaignId}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">Интерактивные кампании</p>
            )}
          </div>
        </header>

        <div className="uix-content-x flex flex-1 flex-col gap-4 pb-10 pt-4">
          {!user?.id ? (
            <ListEmptyState
              icon={Sparkles}
              title="Войдите в аккаунт"
              description="Чтобы открыть кампанию EDGE и участвовать в интерактиве."
              actionLabel="К ленте"
              onAction={() => setLocation("/posts")}
              className="min-h-[220px] rounded-2xl border border-dashed border-border/60 bg-card/40"
            />
          ) : !edgeCampaignId ? (
            <ListEmptyState
              icon={Radio}
              title="Кампания не выбрана"
              description="Откройте пост с кампанией в ленте и нажмите блок «Интерактив кампании» — ссылка откроется с нужным контекстом."
              actionLabel="Перейти в ленту"
              onAction={() => setLocation("/posts")}
              className="min-h-[220px] rounded-2xl border border-dashed border-border/60 bg-card/40"
            />
          ) : campaignQuery.isLoading ? (
            <div className="space-y-4 rounded-3xl border border-border/50 bg-card/60 p-6">
              <Skeleton className="h-8 w-3/4 max-w-sm rounded-lg" />
              <Skeleton className="h-4 w-full max-w-md rounded-md" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : campaignQuery.isError ? (
            <ErrorWithRetry
              title="Не удалось загрузить кампанию"
              description={
                campaignQuery.error instanceof Error
                  ? campaignQuery.error.message
                  : "Проверьте, что сервис EDGE подключён к платформе, или попробуйте позже."
              }
              onRetry={() => void campaignQuery.refetch()}
              className="min-h-[200px] rounded-2xl border border-border/50 bg-card/50"
            />
          ) : campaign ? (
            <CampaignHero campaign={campaign} reducedMotion={reducedMotion} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CampaignHero({
  campaign,
  reducedMotion,
}: {
  campaign: EdgeCompanionCampaignConfig;
  reducedMotion: boolean;
}) {
  const statusLabel = STATUS_LABEL[campaign.status] ?? campaign.status;
  const prizesCount = campaign.gifts?.templates?.length ?? 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-violet-600/18 via-fuchsia-600/12 to-rose-500/15 p-6 shadow-sm"
      role="region"
      aria-label={`Кампания ${campaign.title}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <motion.div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-border/30"
              animate={reducedMotion ? undefined : { scale: [1, 1.04, 1] }}
              transition={
                reducedMotion
                  ? undefined
                  : { duration: DURATION_NORMAL_S * 4, repeat: Infinity, ease: EASING_OUT_BEZIER }
              }
              aria-hidden
            >
              <Sparkles className="h-8 w-8" />
            </motion.div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Кампания</p>
              <h2 className="mt-1 text-xl font-bold leading-tight tracking-tight text-foreground">{campaign.title}</h2>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {statusLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/40 bg-background/70 p-4 text-sm text-muted-foreground backdrop-blur-sm">
          <p className="leading-relaxed text-foreground/90">
            {campaign.isStub
              ? "Сервис EDGE ещё не подключён к платформе — это превью экрана. После прокси к companion-бэкенду здесь появятся персонаж, задания и призы."
              : "Здесь будет полноценный интерактив: персонаж, задания и призы."}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {prizesCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 font-medium text-amber-800 dark:text-amber-200">
                <PartyPopper className="h-3.5 w-3.5" aria-hidden />
                Призов в фонде: {prizesCount}
              </span>
            ) : null}
            {campaign.leaderboard?.globalEnabled ? (
              <span className="rounded-lg bg-secondary px-2 py-1 font-medium text-secondary-foreground">Лидерборд</span>
            ) : null}
            {campaign.followReward?.enabled ? (
              <span className="rounded-lg bg-secondary px-2 py-1 font-medium text-secondary-foreground">Награда за подписку</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
