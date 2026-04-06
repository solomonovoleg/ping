import { useMemo, useState } from "react";
import { ChevronLeft, Pencil, PlusCircle, Sparkles, Trophy, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { fetchMyEdgeCampaigns, type EdgeCreatorCampaignSummary } from "@/lib/edge-creator";

type Tab = "all" | "draft" | "published" | "ended";

function tabMatches(tab: Tab, s: string): boolean {
  const x = s.toLowerCase();
  if (tab === "all") return true;
  if (tab === "draft") return x === "draft";
  if (tab === "published") return x === "published" || x === "paused";
  return x === "ended";
}

function CampaignRow({ c }: { c: EdgeCreatorCampaignSummary }) {
  const [, setLocation] = useLocation();
  const statusRu =
    c.status === "published"
      ? "Активна"
      : c.status === "paused"
        ? "Пауза"
        : c.status === "ended"
          ? "Завершена"
          : c.status === "draft"
            ? "Черновик"
            : c.status;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{c.title}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate" title={c.edgeId}>
            {c.edgeId}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {statusRu}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 uix-text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {c.participantCount} уч.
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {c.edgeType === "money" ? "MONEY" : c.edgeType === "character" ? "персонаж" : c.edgeType}
        </span>
      </div>
      <p className="mt-2 uix-text-caption text-muted-foreground">
        Обновлено: {new Date(c.updatedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <TapScaleButton
          type="button"
          haptic
          subtle
          className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold"
          onClick={() =>
            setLocation(
              c.edgeType === "money"
                ? `/board/edge/new-money?edgeId=${encodeURIComponent(c.edgeId)}`
                : `/board/edge/new?edgeId=${encodeURIComponent(c.edgeId)}`,
            )
          }
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Редактировать
        </TapScaleButton>
        <TapScaleButton
          type="button"
          haptic
          subtle
          className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
          onClick={() => setLocation(`/create-post?edgeId=${encodeURIComponent(c.edgeId)}`)}
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden />
          Пост с EDGE
        </TapScaleButton>
        <TapScaleButton
          type="button"
          haptic
          subtle
          className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-3 py-1.5 text-xs font-semibold"
          onClick={() => setLocation(`/board/edge/draw?edgeId=${encodeURIComponent(c.edgeId)}`)}
        >
          Подвести итоги
        </TapScaleButton>
      </div>
      <p className="mt-2 uix-text-caption text-muted-foreground">
        Розыгрыш и ЛС победителям — кнопка «Подвести итоги». Для админов остаётся draw-prize.
      </p>
    </div>
  );
}

export default function BoardEdgeManage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("all");

  const q = useQuery({
    queryKey: ["edge", "my-campaigns"],
    queryFn: fetchMyEdgeCampaigns,
    retry: 1,
  });

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    return list.filter((c) => tabMatches(tab, c.status));
  }, [q.data, tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "draft", label: "Черновики" },
    { id: "published", label: "Активные" },
    { id: "ended", label: "Завершённые" },
  ];

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 uix-content-x pt-6 pb-4">
        <TapScaleButton
          type="button"
          onClick={() => setLocation("/board/edge")}
          haptic
          subtle
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 -ml-2 hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-6 w-6" />
        </TapScaleButton>
        <h1 className="uix-text-title min-w-0 flex-1 truncate">Мои EDGE</h1>
      </header>

      <div className="uix-content-x flex gap-1 overflow-x-auto border-b border-border/30 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto uix-content-x py-4 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-4))]">
        {q.isLoading ? (
          <>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
          </>
        ) : q.isError ? (
          <ErrorWithRetry
            title="Не удалось загрузить"
            description={q.error instanceof Error ? q.error.message : "Повторите"}
            onRetry={() => void q.refetch()}
            className="min-h-[160px] rounded-2xl border border-border/60"
          />
        ) : filtered.length === 0 ? (
          <ListEmptyState
            icon={Trophy}
            title="Пока нет кампаний"
            description="Создайте кампанию в конструкторе: Борд → EDGE → Новый EDGE. Список пуст, если EDGE недоступен или ещё не создано ни одной кампании."
            actionLabel="Как включить"
            onAction={() => setLocation("/board/edge/new")}
            className="min-h-[200px] rounded-3xl border border-dashed border-border/60"
          />
        ) : (
          filtered.map((c) => <CampaignRow key={c.edgeId} c={c} />)
        )}
      </div>
    </div>
  );
}
