import { motion } from "framer-motion";
import { Sparkles, ListChecks, Play } from "lucide-react";
import type { EdgeMoneyScoringRulePublic } from "@/lib/edge-money-public";
import type { EdgeMoneyTaskProgressItemDto } from "@/lib/edge-money-task-progress-api";
import { MONEY_SCORING_UI, type MoneyScoringKind } from "@/lib/edge-money-wizard";
import { Progress } from "@/components/ui/progress";
import { usePrefersReducedMotion } from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { EdgeMoneyInviteFriendRow } from "./invite-friend-row/EdgeMoneyInviteFriendRow";
import { progressItemForScoringRule } from "./edge-money-task-completion";

function labelForRule(r: EdgeMoneyScoringRulePublic): string {
  const k = r.kind as MoneyScoringKind;
  const meta = MONEY_SCORING_UI[k];
  if (meta) return meta.title;
  return r.kind;
}

function detailForRule(r: EdgeMoneyScoringRulePublic): string {
  const k = r.kind as MoneyScoringKind;
  const meta = MONEY_SCORING_UI[k];
  const base = meta?.tagline ?? "Начисление по правилам игры.";
  const cap =
    (r.kind === "chat_messages" ||
      r.kind === "video_call_minutes" ||
      r.kind === "follow_creator" ||
      r.kind === "post_created" ||
      r.kind === "profile_likes_received") &&
    r.maxPointsPerDay &&
    r.maxPointsPerDay > 0
      ? ` Макс. за сутки: ${r.maxPointsPerDay}.`
      : "";
  return `${base} Порог: ${r.threshold} · +${r.points} балл.${cap}`;
}

type Props = {
  edgeId: string;
  interactLocked: boolean;
  rules: EdgeMoneyScoringRulePublic[];
  moneyTrackingStarted: boolean;
  moneyTrackingLoading: boolean;
  moneyTrackingStatusError: boolean;
  onRetryMoneyTrackingStatus: () => void;
  onStartMoneyTracking: () => Promise<void>;
  startMoneyTrackingBusy: boolean;
  taskProgressTasks: EdgeMoneyTaskProgressItemDto[] | undefined;
  taskProgressLoading: boolean;
  taskProgressError: boolean;
  onRetryTaskProgress: () => void;
};

export function EdgeMoneyTasksPanel({
  edgeId,
  interactLocked,
  rules,
  moneyTrackingStarted,
  moneyTrackingLoading,
  moneyTrackingStatusError,
  onRetryMoneyTrackingStatus,
  onStartMoneyTracking,
  startMoneyTrackingBusy,
  taskProgressTasks,
  taskProgressLoading,
  taskProgressError,
  onRetryTaskProgress,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const { toast } = useToast();
  const active = rules.filter((r) => r.enabled);
  const progressItems = active
    .map((r) => progressItemForScoringRule(r, taskProgressTasks))
    .filter((p): p is EdgeMoneyTaskProgressItemDto => Boolean(p));
  const completedCount = progressItems.filter((p) => (p.followCompleted ? true : (p.ratio ?? 0) >= 1)).length;
  const progressPct = active.length ? Math.min(100, Math.round((completedCount / active.length) * 100)) : 0;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: reduced ? 0 : 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, x: reduced ? 0 : 16 },
    show: {
      opacity: 1,
      x: 0,
      transition: reduced ? { duration: 0.15 } : { type: "spring" as const, stiffness: 300, damping: 26 },
    },
  };

  return (
    <div className="emoney-hide-scrollbar h-full w-full overflow-y-auto px-5 pt-14 pb-6">
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 space-y-6">
        <motion.div variants={item} className="mb-6 space-y-2 text-center">
          <div className="relative mb-3 inline-flex justify-center">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ backgroundColor: "var(--emoney-glow)" }} aria-hidden />
            <ListChecks className="relative z-10 h-11 w-11 emoney-accent" aria-hidden />
          </div>
          <h1 className="emoney-gradient-text text-2xl font-black">
            Задания
          </h1>
          <p className="text-sm font-medium text-white/55">
            Сначала подтвердите участие в заданиях — до этого переписки, звонки, приглашения и подписка на
            создателя в этой игре не засчитываются.
          </p>
        </motion.div>
        <motion.div
          variants={item}
          className="emoney-glass-panel rounded-[2rem] border border-white/10 bg-black/40 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
        >
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/50">Ваш прогресс</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{completedCount}</span>
                <span className="font-medium text-white/40">/ {active.length}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest emoney-badge-text">Процент</p>
              <span className="text-sm font-bold emoney-accent">{progressPct}%</span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-white/5 bg-black/60 p-0.5">
            <div className="emoney-gradient-bar relative h-full rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }}>
              <div className="emoney-shimmer absolute inset-0 -translate-x-[100%] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>
          </div>
        </motion.div>

        {moneyTrackingStatusError ? (
          <motion.div variants={item} className="rounded-2xl px-4 py-3 text-sm text-white/90 emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
            <p className="font-medium">Не удалось проверить статус заданий.</p>
            <TapScaleButton
              type="button"
              haptic
              className="mt-2 text-sm font-semibold emoney-accent underline-offset-2 hover:underline"
              onClick={onRetryMoneyTrackingStatus}
            >
              Повторить
            </TapScaleButton>
          </motion.div>
        ) : !interactLocked && !moneyTrackingLoading && !moneyTrackingStarted ? (
          <motion.div variants={item} className="rounded-[1.75rem] p-4 emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
            <p className="text-sm font-medium text-white">
              Нажмите кнопку ниже, чтобы мы начали учитывать ваши действия в этой кампании.
            </p>
            <TapScaleButton
              type="button"
              haptic
              disabled={startMoneyTrackingBusy}
              className="mt-3 inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl emoney-accent-bg px-4 py-3 text-sm font-bold emoney-on-accent-fg"
              onClick={() => {
                void onStartMoneyTracking().catch((e: unknown) => {
                  toast({
                    title: "Не удалось включить задания",
                    description: e instanceof Error ? e.message : "Попробуйте позже.",
                    variant: "destructive",
                  });
                });
              }}
            >
              <Play className="h-4 w-4" aria-hidden />
              {startMoneyTrackingBusy ? "Включаем…" : "Начать отслеживание заданий"}
            </TapScaleButton>
          </motion.div>
        ) : moneyTrackingLoading ? (
          <motion.p variants={item} className="text-center text-xs text-white/45">
            Проверяем статус…
          </motion.p>
        ) : null}

        {taskProgressError ? (
          <motion.div variants={item} className="rounded-2xl px-4 py-3 text-sm text-white/90 emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
            <p className="font-medium">Не удалось загрузить прогресс по заданиям.</p>
            <TapScaleButton
              type="button"
              haptic
              className="mt-2 text-sm font-semibold emoney-accent underline-offset-2 hover:underline"
              onClick={onRetryTaskProgress}
            >
              Повторить
            </TapScaleButton>
          </motion.div>
        ) : null}

        {active.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
            Создатель пока не включил правил начисления.
          </p>
        ) : (
          <div className="space-y-4">
            {active.map((r) => {
              const tp = progressItemForScoringRule(r, taskProgressTasks);
              const inviteMilestone =
                r.kind === "invite_friend" && moneyTrackingStarted && tp?.kind === "invite_friend"
                  ? { ratio: tp.ratio, detail: tp.detail }
                  : null;
              return r.kind === "invite_friend" ? (
                <motion.div key={r.id} variants={item}>
                  <EdgeMoneyInviteFriendRow
                    edgeId={edgeId}
                    rule={r}
                    interactLocked={interactLocked}
                    moneyTrackingStarted={moneyTrackingStarted}
                    milestoneHint={inviteMilestone}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={r.id}
                  variants={item}
                  className="rounded-[1.75rem] border border-white/10 bg-[#0a0a0f]/90 p-4 shadow-lg backdrop-blur-xl"
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 p-3 text-white">
                      <Sparkles className="h-5 w-5 emoney-accent" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold tracking-tight text-white">{labelForRule(r)}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/55">{detailForRule(r)}</p>
                      {!moneyTrackingStarted && !interactLocked ? (
                        <p className="mt-2 text-xs font-medium emoney-badge-text" style={{ opacity: 0.9 }}>
                          Включите отслеживание заданий выше — затем действия начнут засчитываться.
                        </p>
                      ) : null}
                      {moneyTrackingStarted && tp && tp.ratio !== null ? (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[11px] leading-snug text-white/70">{tp.detail}</p>
                          <Progress
                            className="h-1.5 bg-white/10"
                            value={Math.round(Math.min(100, Math.max(0, tp.ratio * 100)))}
                            aria-label={`Прогресс задания: ${Math.round(Math.min(100, Math.max(0, tp.ratio * 100)))}%`}
                          />
                        </div>
                      ) : moneyTrackingStarted && taskProgressLoading && !tp ? (
                        <p className="mt-2 text-[11px] text-white/40">Загружаем прогресс…</p>
                      ) : null}
                      <div className="mt-2 inline-flex items-center gap-1 rounded-md emoney-accent-soft-bg px-2 py-0.5" style={{ border: "1px solid var(--emoney-accent)" }}>
                        <Sparkles className="h-3 w-3 emoney-accent" aria-hidden />
                        <span className="text-xs font-bold emoney-accent">+{r.points} к рейтингу</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
