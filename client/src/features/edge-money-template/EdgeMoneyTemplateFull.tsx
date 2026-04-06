import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEdgeMoneyCampaignConfig } from "@/lib/edge-money-public";
import { fetchEdgeLeaderboard } from "@/lib/edge-participant";
import { fetchEdgeMoneyTaskProgress } from "@/lib/edge-money-task-progress-api";
import { fetchEdgeMoneyTrackingStarted, postEdgeMoneyStartTracking } from "@/lib/edge-money-tracking-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry } from "@/components/ui/empty";
import { EdgeMoneySessionRecapOverlay } from "./EdgeMoneySessionRecapOverlay";
import { EdgeMoneySwipeShell } from "./EdgeMoneySwipeShell";
import {
  buildMoneyVisitSnapshot,
  computeMoneySessionRecap,
  edgeMoneyVisitStorageKey,
  readMoneyVisitSnapshot,
  stringifyMoneyVisitSnapshot,
  type EdgeMoneyRecapLine,
} from "./edge-money-visit-snapshot";

type Props = {
  edgeId: string;
  viewerDisplayName: string;
};

export function EdgeMoneyTemplateFull({ edgeId, viewerDisplayName }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id?.trim() ?? "";
  const recapHandledRef = useRef(false);
  const [recap, setRecap] = useState<{ lines: EdgeMoneyRecapLine[]; totalDelta: number } | null>(null);
  const moneyQ = useQuery({
    queryKey: ["edge", "money", "campaign-config", edgeId],
    queryFn: () => fetchEdgeMoneyCampaignConfig(edgeId),
    enabled: Boolean(edgeId),
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const lbKind: "primary" | "secondary" = moneyQ.data?.leaderboardSecondaryEnabled ? "secondary" : "primary";

  useEffect(() => {
    recapHandledRef.current = false;
  }, [edgeId, userId, lbKind]);

  const lbQ = useQuery({
    queryKey: ["edge", "participant", "leaderboard", edgeId, lbKind],
    queryFn: () => fetchEdgeLeaderboard(edgeId, 40, lbKind),
    enabled: Boolean(edgeId) && Boolean(moneyQ.data),
    staleTime: 25_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const trackingQ = useQuery({
    queryKey: ["edge", "money", "tracking-started", edgeId],
    queryFn: () => fetchEdgeMoneyTrackingStarted(edgeId),
    enabled: Boolean(edgeId) && Boolean(moneyQ.data),
    staleTime: 20_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const taskProgressQ = useQuery({
    queryKey: ["edge", "money", "task-progress", edgeId],
    queryFn: () => fetchEdgeMoneyTaskProgress(edgeId),
    enabled: Boolean(edgeId) && Boolean(moneyQ.data),
    staleTime: 8_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 12_000,
  });

  useEffect(() => {
    if (!userId || !edgeId) return;
    if (recapHandledRef.current) return;
    if (!lbQ.data || taskProgressQ.data?.tasks === undefined) return;

    const tasks = taskProgressQ.data.tasks;
    const key = edgeMoneyVisitStorageKey(userId, edgeId, lbKind);
    let prev: ReturnType<typeof readMoneyVisitSnapshot> = null;
    try {
      prev = readMoneyVisitSnapshot(localStorage.getItem(key));
    } catch {
      prev = null;
    }

    const current = buildMoneyVisitSnapshot(lbQ.data, tasks, lbKind);

    if (!prev) {
      try {
        localStorage.setItem(key, stringifyMoneyVisitSnapshot(current));
      } catch {
        /* ignore quota / private mode */
      }
      recapHandledRef.current = true;
      return;
    }

    const { lines, totalDelta, shouldShow } = computeMoneySessionRecap(prev, lbQ.data, tasks, lbKind);

    if (shouldShow && (lines.length > 0 || totalDelta > 0)) {
      setRecap({ lines, totalDelta });
      recapHandledRef.current = true;
      return;
    }

    try {
      localStorage.setItem(key, stringifyMoneyVisitSnapshot(current));
    } catch {
      /* ignore */
    }
    recapHandledRef.current = true;
  }, [userId, edgeId, lbKind, lbQ.data, taskProgressQ.data]);

  const dismissRecap = useCallback(() => {
    setRecap(null);
    if (!userId || !edgeId || !lbQ.data || taskProgressQ.data?.tasks === undefined) return;
    const key = edgeMoneyVisitStorageKey(userId, edgeId, lbKind);
    try {
      localStorage.setItem(
        key,
        stringifyMoneyVisitSnapshot(buildMoneyVisitSnapshot(lbQ.data, taskProgressQ.data.tasks, lbKind)),
      );
    } catch {
      /* ignore */
    }
  }, [userId, edgeId, lbKind, lbQ.data, taskProgressQ.data]);

  const startTrackingMut = useMutation({
    mutationFn: () => postEdgeMoneyStartTracking(edgeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["edge", "money", "tracking-started", edgeId] });
      void qc.invalidateQueries({ queryKey: ["edge", "money", "invite-progress", edgeId] });
      void qc.invalidateQueries({ queryKey: ["edge", "money", "task-progress", edgeId] });
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
    },
  });

  if (moneyQ.isLoading || (moneyQ.data && lbQ.isLoading)) {
    return (
      <div className="uix-content-x flex min-h-[min(400px,55dvh)] flex-col gap-3 py-4">
        <Skeleton className="h-8 w-48 rounded-lg bg-white/10" />
        <Skeleton className="min-h-[280px] flex-1 rounded-2xl bg-white/10" />
      </div>
    );
  }

  if (moneyQ.isError || !moneyQ.data) {
    return (
      <div className="uix-content-x py-4">
        <ErrorWithRetry
          title="Не удалось загрузить EDGE MONEY"
          description={
            moneyQ.error instanceof Error ? moneyQ.error.message : "Попробуйте позже."
          }
          onRetry={() => void moneyQ.refetch()}
          className="min-h-[200px] rounded-2xl border border-border/60 bg-card/90"
        />
      </div>
    );
  }

  if (lbQ.isError || !lbQ.data) {
    return (
      <div className="uix-content-x py-4">
        <ErrorWithRetry
          title="Не удалось загрузить рейтинг"
          description={lbQ.error instanceof Error ? lbQ.error.message : "Ошибка"}
          onRetry={() => void lbQ.refetch()}
          className="min-h-[200px] rounded-2xl border border-border/60 bg-card/90"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-1 pb-1 sm:px-2">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <EdgeMoneySwipeShell
          money={moneyQ.data}
          leaderboard={lbQ.data}
          viewerDisplayName={viewerDisplayName}
          moneyTrackingStarted={trackingQ.data === true}
          moneyTrackingLoading={trackingQ.isLoading}
          moneyTrackingStatusError={trackingQ.isError}
          onRetryMoneyTrackingStatus={() => void trackingQ.refetch()}
          onStartMoneyTracking={() => startTrackingMut.mutateAsync()}
          startMoneyTrackingBusy={startTrackingMut.isPending}
          taskProgressTasks={taskProgressQ.data?.tasks}
          taskProgressLoading={taskProgressQ.isLoading}
          taskProgressError={taskProgressQ.isError}
          onRetryTaskProgress={() => void taskProgressQ.refetch()}
        />
        <EdgeMoneySessionRecapOverlay
          open={Boolean(recap)}
          lines={recap?.lines ?? []}
          totalDelta={recap?.totalDelta ?? 0}
          onDismiss={dismissRecap}
        />
      </div>
    </div>
  );
}
