import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, PartyPopper } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  edgeCreatorDestructiveToast,
  fetchEdgeCampaignDetail,
  formatPrizeDmNotifyError,
  parseGiftTemplatesFromRow,
  postEdgeCreatorPrizeDraw,
  type EdgeCreatorPrizeDrawResult,
} from "@/lib/edge-creator";

function parseSearchEdgeId(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(raw).get("edgeId")?.trim() ?? "";
  } catch {
    return "";
  }
}

function readCfg(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

export default function BoardEdgePrizeDraw() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const qc = useQueryClient();
  const edgeId = useMemo(() => parseSearchEdgeId(search), [search]);

  const detailQ = useQuery({
    queryKey: ["edge", "creator", "detail", edgeId],
    queryFn: () => fetchEdgeCampaignDetail(edgeId),
    enabled: Boolean(edgeId),
    retry: 1,
  });

  const gifts = useMemo(
    () => (detailQ.data ? parseGiftTemplatesFromRow(detailQ.data.giftsJson) : []),
    [detailQ.data],
  );

  const [giftKey, setGiftKey] = useState("");
  const [count, setCount] = useState(1);
  const [pool, setPool] = useState<"all" | "top">("all");
  const [topN, setTopN] = useState(50);
  const [method, setMethod] = useState<"random" | "first">("random");
  const [rankingKind, setRankingKind] = useState<"primary" | "secondary">("primary");
  const [notify, setNotify] = useState(true);
  const [lastResult, setLastResult] = useState<EdgeCreatorPrizeDrawResult | null>(null);

  const secondaryEnabled = detailQ.data?.leaderboardSecondaryEnabled === true;
  const initForEdgeRef = useRef<string>("");

  useEffect(() => {
    if (!detailQ.data) return;
    if (initForEdgeRef.current === edgeId) return;
    initForEdgeRef.current = edgeId;
    const root = readCfg(detailQ.data.configJson);
    const pr = readCfg(root.prizeRules);
    const p = pr.pool === "top" ? "top" : "all";
    const m = pr.method === "first" ? "first" : "random";
    const tn =
      typeof pr.topN === "number" && Number.isFinite(pr.topN)
        ? Math.min(5000, Math.max(1, Math.floor(pr.topN)))
        : 50;
    let rk: "primary" | "secondary" =
      pr.rankingKind === "secondary" || pr.rankingScope === "secondary" ? "secondary" : "primary";
    if (detailQ.data.edgeType === "money" && detailQ.data.leaderboardSecondaryEnabled) {
      rk = "secondary";
    }
    setPool(p);
    setMethod(m);
    setTopN(tn);
    setRankingKind(rk);
    const list = parseGiftTemplatesFromRow(detailQ.data.giftsJson);
    const keys = list.map((g, i) => (g.key && g.key.trim()) || `gift_${i + 1}`);
    setGiftKey(keys[0] ?? "");
  }, [detailQ.data, edgeId]);

  const giftOptions = useMemo(
    () =>
      gifts.map((g, i) => ({
        key: (g.key && g.key.trim()) || `gift_${i + 1}`,
        title: g.title.trim() || `Приз ${i + 1}`,
      })),
    [gifts],
  );

  const drawMut = useMutation({
    mutationFn: () =>
      postEdgeCreatorPrizeDraw(edgeId, {
        giftKey: giftKey.trim() || undefined,
        count,
        pool,
        method,
        topN,
        rankingKind,
        notify,
      }),
    onSuccess: (data) => {
      setLastResult(data);
      void qc.invalidateQueries({ queryKey: ["edge", "my-campaigns"] });
      void qc.invalidateQueries({ queryKey: ["edge", "creator", "detail", edgeId] });
      const skip = data.notifications?.skippedReason;
      toast({
        title: "Розыгрыш выполнен",
        description: skip
          ? `Победителей: ${data.drawnCount}. ${skip}`
          : `Выбрано победителей: ${data.drawnCount}. ЛС ушли только им, от вашего имени.`,
        variant: skip ? "destructive" : "default",
      });
    },
    onError: (e) => {
      toast({ ...edgeCreatorDestructiveToast(e), variant: "destructive" });
    },
  });

  if (!edgeId) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/edge/manage")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Подвести итоги</h1>
        </header>
        <div className="uix-content-x flex-1 py-6">
          <ListEmptyState
            icon={PartyPopper}
            title="Не выбрана кампания"
            description="Откройте эту страницу из списка «Мои EDGE» с параметром edgeId."
            actionLabel="К списку"
            onAction={() => setLocation("/board/edge/manage")}
            className="min-h-[200px] rounded-2xl border border-dashed border-border/60"
          />
        </div>
      </div>
    );
  }

  if (detailQ.isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/edge/manage")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Подвести итоги</h1>
        </header>
        <div className="uix-content-x flex flex-1 flex-col gap-3 py-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (detailQ.isError || !detailQ.data) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/edge/manage")}
            haptic
            subtle
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Подвести итоги</h1>
        </header>
        <div className="uix-content-x flex-1 py-6">
          <ErrorWithRetry
            title="Не удалось загрузить кампанию"
            description={detailQ.error instanceof Error ? detailQ.error.message : "Повторите"}
            onRetry={() => void detailQ.refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/board/edge/manage")}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <h1 className="uix-text-title min-w-0 flex-1 truncate">Подвести итоги</h1>
      </header>

      <div className="uix-content-x flex flex-1 flex-col gap-4 overflow-y-auto py-4 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-4))]">
        <p className="uix-text-caption text-muted-foreground leading-relaxed">
          Выберите приз и правила отбора для <span className="font-medium text-foreground">{detailQ.data.title}</span>.
          «Случайно» — жеребьёвка среди допущенных; «По порядку» — места 1…N в пуле (для топа — по выбранному рейтингу, для
          всех участников — по дате входа). Повторно уже выигравших того же приза система не берёт.
        </p>

        {giftOptions.length === 0 ? (
          <ListEmptyState
            icon={PartyPopper}
            title="Нет призов в кампании"
            description="Добавьте призы в конструкторе EDGE, затем вернитесь сюда."
            actionLabel="Редактировать кампанию"
            onAction={() =>
              setLocation(
                detailQ.data?.edgeType === "money"
                  ? `/board/edge/new-money?edgeId=${encodeURIComponent(edgeId)}`
                  : `/board/edge/new?edgeId=${encodeURIComponent(edgeId)}`,
              )
            }
            className="min-h-[180px] rounded-2xl border border-dashed border-border/60"
          />
        ) : (
          <>
            <div>
              <Label htmlFor="pd-gift">Приз</Label>
              <select
                id="pd-gift"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={giftKey}
                onChange={(e) => setGiftKey(e.target.value)}
              >
                {giftOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pd-count">Сколько победителей выбрать сейчас</Label>
              <Input
                id="pd-count"
                type="number"
                min={1}
                max={50}
                className="mt-1.5"
                value={count}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setCount(Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1);
                }}
              />
            </div>
            <div>
              <Label htmlFor="pd-pool">Пул участников</Label>
              <select
                id="pd-pool"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pool}
                onChange={(e) => setPool(e.target.value as "all" | "top")}
              >
                <option value="all">Все участники</option>
                <option value="top">Топ по рейтингу (укажите размер топа ниже)</option>
              </select>
            </div>
            {pool === "top" ? (
              <div>
                <Label htmlFor="pd-topn">Размер топа (например 10)</Label>
                <Input
                  id="pd-topn"
                  type="number"
                  min={1}
                  max={5000}
                  className="mt-1.5"
                  value={topN}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setTopN(Number.isFinite(n) ? Math.min(5000, Math.max(1, n)) : 50);
                  }}
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="pd-rank">Рейтинг для топа</Label>
              <select
                id="pd-rank"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={rankingKind}
                onChange={(e) => setRankingKind(e.target.value as "primary" | "secondary")}
                disabled={pool !== "top"}
              >
                <option value="primary">Основной</option>
                <option value="secondary" disabled={!secondaryEnabled}>
                  Дополнительный{!secondaryEnabled ? " (не включён в кампании)" : ""}
                </option>
              </select>
            </div>
            <div>
              <Label htmlFor="pd-method">Способ выбора</Label>
              <select
                id="pd-method"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as "random" | "first")}
              >
                <option value="random">Случайно среди допущенных</option>
                <option value="first">По порядку (1-й, 2-й, … в пуле)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 uix-text-caption">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Отправить ЛС только победителям розыгрыша, от моего имени (не подписчикам и не в чаты)
            </label>
            <TapScaleButton
              type="button"
              haptic
              className="inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              disabled={drawMut.isPending || giftOptions.length === 0}
              onClick={() => drawMut.mutate()}
            >
              {drawMut.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <PartyPopper className="h-5 w-5" aria-hidden />
              )}
              Провести розыгрыш
            </TapScaleButton>
          </>
        )}

        {lastResult?.winners?.length ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2">
            <p className="text-sm font-semibold">Последний результат</p>
            <p className="uix-text-caption text-muted-foreground">
              Партия {lastResult.drawBatchId.slice(0, 8)}… · в пуле было {lastResult.poolSize} кандидатов
            </p>
            <ul className="space-y-1 uix-text-caption font-mono text-[11px] break-all">
              {lastResult.winners.map((w, i) => (
                <li key={`${w.platformUserId}-${i}`}>{w.platformUserId}</li>
              ))}
            </ul>
            {lastResult.notifications?.skippedReason ? (
              <p className="text-sm text-destructive">{lastResult.notifications.skippedReason}</p>
            ) : null}
            {lastResult.notifications?.results?.length ? (
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs font-medium mb-1">ЛС</p>
                <ul className="space-y-0.5 uix-text-caption">
                  {lastResult.notifications.results.map((r) => (
                    <li key={r.platformUserId} className={r.ok ? "text-muted-foreground" : "text-destructive"}>
                      {r.platformUserId.slice(0, 12)}… —{" "}
                      {r.ok ? "отправлено" : formatPrizeDmNotifyError(r.error)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
