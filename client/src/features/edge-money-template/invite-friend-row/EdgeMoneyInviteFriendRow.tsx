import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import type { EdgeMoneyScoringRulePublic } from "@/lib/edge-money-public";
import { fetchEdgeMoneyInviteProgress, postEdgeMoneyInvitePack } from "@/lib/edge-money-invite-api";
import { MONEY_SCORING_UI } from "@/lib/edge-money-wizard";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = {
  edgeId: string;
  rule: EdgeMoneyScoringRulePublic;
  interactLocked: boolean;
  /** Пока игрок не нажал «Начать отслеживание заданий», коды не выдаём (сервер тоже режет). */
  moneyTrackingStarted: boolean;
  /** Прогресс до следующего начисления с `GET …/task-progress` (после старта трекинга). */
  milestoneHint?: { ratio: number | null; detail: string } | null;
};

export function EdgeMoneyInviteFriendRow({
  edgeId,
  rule,
  interactLocked,
  moneyTrackingStarted,
  milestoneHint,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const reduced = usePrefersReducedMotion();

  const prevInvitePoints = useRef<number | null>(null);

  const progressQ = useQuery({
    queryKey: ["edge", "money", "invite-progress", edgeId],
    queryFn: () => fetchEdgeMoneyInviteProgress(edgeId),
    enabled: Boolean(edgeId),
    staleTime: 12_000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: 25_000,
  });

  useEffect(() => {
    const p = progressQ.data?.pointsAwardedForInviteTask;
    if (typeof p !== "number") return;
    const prev = prevInvitePoints.current;
    if (prev !== null && p > prev) {
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
    }
    prevInvitePoints.current = p;
  }, [edgeId, progressQ.data?.pointsAwardedForInviteTask, qc]);

  const packMut = useMutation({
    mutationFn: () => postEdgeMoneyInvitePack(edgeId),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["edge", "money", "invite-progress", edgeId] });
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
      const desc =
        data.hint ??
        `Автор кампании прислал коды в личный чат (${data.codesCount} шт.). Откройте «Чаты».`;
      const action = (
        <ToastAction
          altText="Открыть чат с автором кампании"
          onClick={() => setLocation(`/chat/${encodeURIComponent(data.chatId)}`)}
        >
          Открыть чат
        </ToastAction>
      ) as ToastActionElement;
      toast({
        title: "Коды отправлены",
        description: desc,
        duration: 12_000,
        action,
      });
    },
    onError: (e) => {
      toast({
        title: "Не удалось выдать коды",
        description: e instanceof Error ? e.message : "Попробуйте позже.",
        variant: "destructive",
      });
    },
  });

  const meta = MONEY_SCORING_UI.invite_friend;
  const title = meta?.title ?? "Пригласи друга";
  const locked = interactLocked || !moneyTrackingStarted;
  const progress = progressQ.data;
  const busy = packMut.isPending || progressQ.isLoading;

  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-white/10 bg-[#0a0a0f]/90 p-4 shadow-lg backdrop-blur-xl",
        reduced ? "" : "transition-[box-shadow] duration-200",
      )}
    >
      <div className="flex gap-3">
        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 text-white">
          <Users className="h-5 w-5 emoney-accent" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-semibold tracking-tight text-white">{title}</h3>
          <p className="text-xs leading-relaxed text-white/60">
            Пригласи друга по коду из игры —{" "}
            <span className="font-bold emoney-accent tabular-nums">+{rule.points}</span> в рейтинг за каждого
            зарегистрировавшегося
            {rule.threshold > 1 ? (
              <>
                {" "}
                (одно начисление за <span className="tabular-nums">{rule.threshold}</span> регистраций)
              </>
            ) : null}
            . Рейтинг и шанс на победу растут сразу.
          </p>
          {moneyTrackingStarted && milestoneHint && milestoneHint.ratio !== null ? (
            <div className="space-y-1.5 rounded-xl emoney-accent-soft-bg px-3 py-2" style={{ border: "1px solid var(--emoney-accent)" }}>
              <p className="text-[11px] leading-snug text-white/70">{milestoneHint.detail}</p>
              <Progress
                className="h-1.5 bg-white/10"
                value={Math.round(Math.min(100, Math.max(0, milestoneHint.ratio * 100)))}
                aria-label={`Прогресс приглашений: ${Math.round(Math.min(100, Math.max(0, milestoneHint.ratio * 100)))}%`}
              />
            </div>
          ) : null}
          {progressQ.isError ? (
            <p className="text-xs text-amber-300/90" role="status">
              Прогресс не загрузился. Потяните экран вниз или откройте задания снова.
            </p>
          ) : progress ? (
            <div className="space-y-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-white/70">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  Кодов в текущей тройке:{" "}
                  <strong className="text-white tabular-nums">{progress.codesIssuedInOpenBatch}</strong> /{" "}
                  {progress.slotCount || 3}
                </span>
                <span>
                  Регистраций по ним:{" "}
                  <strong className="text-white tabular-nums">{progress.registrationsFromOpenBatchCodes}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1 emoney-accent">
                <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  Начислено за приглашения:{" "}
                  <strong className="tabular-nums">{progress.pointsAwardedForInviteTask}</strong> балл.
                </span>
              </div>
              {!progress.canRequestNewBatch && progress.pendingReason === "pending_invite_codes" ? (
                <p className="text-amber-200/90">
                  Сначала пусть друзья зарегистрируются по текущим трём кодам — затем можно запросить новые.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="pt-1">
            <TapScaleButton
              type="button"
              haptic
              disabled={
                locked ||
                busy ||
                progressQ.isLoading ||
                (progress !== undefined && !progress.canRequestNewBatch)
              }
              className="inline-flex min-h-[var(--uix-touch-min)] items-center justify-center gap-2 rounded-xl emoney-accent-soft-bg px-4 text-sm font-semibold emoney-accent"
              style={{ border: "1px solid var(--emoney-accent)" }}
              aria-label="Получить пригласительные коды в личный чат"
              onClick={() => packMut.mutate()}
            >
              {packMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Gift className="h-4 w-4" aria-hidden />
              )}
              Получить коды в чат
            </TapScaleButton>
          </div>
          {interactLocked ? (
            <p className="text-xs text-amber-200/85" role="status">
              Кампания на паузе или срок истёк — новые коды сейчас не выдаются.
            </p>
          ) : !moneyTrackingStarted ? (
            <p className="text-xs text-amber-200/85" role="status">
              Сначала нажмите «Начать отслеживание заданий» вверху вкладки — затем можно получить коды.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
