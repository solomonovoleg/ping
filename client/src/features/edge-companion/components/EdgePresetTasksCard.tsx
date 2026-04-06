import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, Mail, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import {
  EdgePresetVerificationError,
  postEdgeParticipantTask,
  postEdgePingInvitePack,
  type EdgeParticipantState,
} from "@/lib/edge-participant";
import { EDGE_BLOCK_SUB, EDGE_BLOCK_TITLE, EDGE_CARD } from "@/features/edge-companion/edge-uix";
import {
  edgePresetTaskWhereLabel,
  edgeTaskPresetVerifyHint,
  formatEdgeTaskPresetLabel,
} from "@/lib/edge-task-preset-label";
import { edgeScoreTargetCaptionRu, effectiveEdgeTaskPresetScoreTarget } from "@/lib/edge-task-score-target";
import { EDGE_REWARD_READY_ROW_TW } from "@/lib/edge-task-reward-ready";
import { triggerSuccessFeedback } from "@/lib/micro-feedback";
import { cn } from "@/lib/utils";

type Props = {
  edgeId: string;
  presets: EdgeTaskPresetPublic[];
  /** Как у кормления: кампания на паузе / срок вышел. */
  interactLocked?: boolean;
  /** Полноэкранный свайп «Задания»: без дублирующего заголовка, акцентные карточки и CTA. */
  variant?: "default" | "surface";
  /** Состояние участника с `taskProgress` / `taskGrants` с EDGE. */
  participantState?: EdgeParticipantState;
};

function denyMessage(code: string | undefined): string {
  switch (code) {
    case "already_claimed":
      return "Вы уже забрали награду за это задание.";
    case "campaign_locked":
      return "Сейчас задания в этой кампании недоступны.";
    case "not_published":
      return "Кампания ещё не открыта для участников.";
    case "deadline_passed":
      return "Время на это задание вышло.";
    case "invalid_preset":
      return "Такого задания в кампании нет.";
    case "verification_failed":
      return "Условие задания ещё не выполнено — проверьте, всё ли сделано.";
    case "leaderboard_frozen":
      return "Рейтинг на паузе: наступила дата розыгрыша приза. Начисление очков временно остановлено.";
    case "honor_disabled":
      return "Это задание без проверки на сервере отключено. Пусть организатор выберет условие в конструкторе.";
    default:
      return "Сейчас награду выдать не удалось. Попробуйте позже.";
  }
}

export function EdgePresetTasksCard({
  edgeId,
  presets,
  interactLocked,
  variant = "default",
  participantState,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const claimMut = useMutation({
    mutationFn: (taskKey: string) => postEdgeParticipantTask(edgeId, taskKey),
    onSuccess: (data) => {
      qc.setQueryData(["edge", "participant", "state", edgeId], data.state);
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
      const preset = presets.find((x) => x.key === data.taskKey);
      const scoreTarget = preset ? effectiveEdgeTaskPresetScoreTarget(preset) : "primary";
      const board = edgeScoreTargetCaptionRu(scoreTarget);
      if (data.awarded) {
        triggerSuccessFeedback();
        const sign = data.xpDelta >= 0 ? "+" : "";
        toast({
          title: "Награда",
          description:
            data.xpDelta === 0
              ? `Задание засчитано — зачёт в «${board}».`
              : `${sign}${data.xpDelta} XP зачислено в «${board}».`,
        });
      } else {
        toast({
          title: "Задание",
          description: denyMessage(data.denyReason),
          variant: data.denyReason === "already_claimed" ? "default" : "destructive",
        });
      }
    },
    onError: (e) => {
      const msg =
        e instanceof EdgePresetVerificationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Повторите позже";
      toast({
        title: e instanceof EdgePresetVerificationError ? "Задание сейчас недоступно" : "Что-то пошло не так",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const invitePackMut = useMutation({
    mutationFn: (taskKey: string) => postEdgePingInvitePack(edgeId, taskKey),
    onSuccess: (data) => {
      const desc =
        data.hint ??
        `Автор кампании прислал вам в личный чат пригласительные коды — всего ${data.codesCount} шт. Смотрите раздел «Чаты».`;
      const action = (
        <ToastAction
          altText="Открыть чат с автором кампании"
          onClick={() => setLocation(`/chat/${encodeURIComponent(data.chatId)}`)}
        >
          Открыть чат
        </ToastAction>
      ) as ToastActionElement;
      toast({
        title: "Коды в чате",
        description: desc,
        duration: 10_000,
        action,
      });
    },
    onError: (e) => {
      toast({
        title: "Коды не отправились",
        description: e instanceof Error ? e.message : "Попробуйте ещё раз чуть позже.",
        variant: "destructive",
      });
    },
  });

  if (!presets.length) return null;

  const locked = Boolean(interactLocked);
  const isSurface = variant === "surface";

  const rowClass = cn(
    "flex flex-col gap-2.5 rounded-2xl px-[var(--uix-space-3)] py-[var(--uix-space-3)] sm:flex-row sm:items-center sm:justify-between",
    isSurface
      ? "border border-primary/22 bg-gradient-to-br from-card via-primary/[0.05] to-transparent shadow-[0_8px_28px_-16px_hsl(var(--primary)/0.35)] dark:border-primary/28 dark:via-primary/[0.07]"
      : "border border-border/40 bg-background/40",
  );

  const xpButtonClass = cn(
    "inline-flex min-h-[var(--uix-touch-min)] flex-row items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4",
    isSurface &&
      "border-0 bg-primary font-semibold text-primary-foreground shadow-md hover:bg-primary/92 active:bg-primary/88",
  );

  const mailButtonClass = cn(
    "inline-flex min-h-[var(--uix-touch-min)] flex-row items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border/60 bg-secondary/70 px-4 font-medium",
    isSurface && "border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15",
  );

  const inner = (
    <>
      {!isSurface ? (
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <h3 className={EDGE_BLOCK_TITLE}>Задания</h3>
        </div>
      ) : null}
      {locked ? (
        <p
          className={cn(
            EDGE_BLOCK_SUB,
            isSurface &&
              "rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-[13px] text-amber-950 dark:text-amber-100",
          )}
          role="status"
        >
          Задания сейчас закрыты: кампания на паузе или уже завершилась.
        </p>
      ) : !isSurface ? (
        <p className={EDGE_BLOCK_SUB}>Сделайте условие задания и нажмите «Забрать награду» — по одному разу на каждое.</p>
      ) : null}

      <ul className={cn("space-y-[var(--uix-space-2)]", isSurface && "space-y-3")}>
        {presets.map((p) => {
          const net = p.points - p.penalty;
          const busy = claimMut.isPending && claimMut.variables === p.key;
          const packBusy = invitePackMut.isPending && invitePackMut.variables === p.key;
          const hint = edgeTaskPresetVerifyHint(p.verify);
          const isPingInvite = p.verify?.type === "ping_invited_users";
          const displayLabel = formatEdgeTaskPresetLabel(p.label, p.verify);
          const line = participantState?.taskProgress?.find((t) => t.taskKey === p.key);
          const scoreTarget = effectiveEdgeTaskPresetScoreTarget(p);
          const boardShort = edgeScoreTargetCaptionRu(scoreTarget);
          const isClaimed = Boolean(line?.claimed);
          const blockEdge = Boolean(line && line.tracking === "edge" && !line.satisfied);
          const progressPct =
            line && line.ratio !== null && !isClaimed ? Math.min(100, Math.round(line.ratio * 100)) : null;
          const xpShown = isClaimed && line?.xpAwardedIfClaimed != null ? line.xpAwardedIfClaimed : net;
          const isHonor = p.verify?.type === "honor";
          const blockUnverifiable = isHonor;
          const whereLabel = edgePresetTaskWhereLabel(p);
          const edgeRewardReady =
            !isClaimed && line?.tracking === "edge" && Boolean(line?.satisfied);
          const platformRowAccent =
            !isClaimed && line?.tracking === "platform" && !edgeRewardReady;
          return (
            <li
              key={p.key}
              className={cn(
                rowClass,
                edgeRewardReady && EDGE_REWARD_READY_ROW_TW,
                platformRowAccent && "border-sky-500/35",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className={cn("uix-text-body font-medium text-foreground", isSurface && "text-[15px] font-semibold")}>
                  <span>{displayLabel}</span>
                  {whereLabel ? (
                    <span
                      className={cn(
                        "ml-2 inline-flex align-middle text-[10px] font-bold uppercase tracking-wide",
                        whereLabel === "в игре" && "text-emerald-600 dark:text-emerald-400",
                        whereLabel === "приложение" && "text-sky-600 dark:text-sky-400",
                        whereLabel === "нет проверки" && "text-destructive",
                      )}
                      aria-label={`Где считается задание: ${whereLabel}`}
                    >
                      · {whereLabel}
                    </span>
                  ) : null}
                </p>
                <p className={cn("uix-text-caption text-muted-foreground", isSurface && "mt-0.5 text-[12px] leading-snug")}>
                  <span className="font-semibold text-primary tabular-nums">
                    {xpShown >= 0 ? `+${xpShown}` : `${xpShown}`} XP
                  </span>
                  {" · "}
                  {boardShort}
                  {" · "}
                  срок {p.deadlineDays} дн. с входа в кампанию
                  {hint ? ` · ${hint}` : ""}
                </p>
                {isHonor && !isClaimed ? (
                  <p className="mt-1 text-[11px] font-medium text-destructive/95">
                    Награда недоступна: не задано условие, которое сервер может проверить. Организатору нужно выбрать тип
                    проверки (питомец, пост в ленте, приглашения, реакция…).
                  </p>
                ) : null}
                {line?.tracking === "platform" && !isClaimed ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Условие проверяется в приложении при нажатии «Забрать награду».
                  </p>
                ) : null}
                {progressPct !== null ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                      <span>Прогресс</span>
                      <span>
                        {line?.current ?? 0} / {line?.target ?? "—"}
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-1.5" aria-label={`Прогресс задания: ${progressPct}%`} />
                  </div>
                ) : null}
                {blockEdge ? (
                  <p className="mt-1.5 text-[11px] text-amber-800/95 dark:text-amber-100/90">
                    Сначала выполните условие в игре — кнопка разблокируется автоматически.
                  </p>
                ) : null}
                {edgeRewardReady ? (
                  <p
                    className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-primary"
                    role="status"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden strokeWidth={2.25} />
                    Условие в игре выполнено — заберите награду.
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {isClaimed ? (
                  <div
                    className="inline-flex min-h-[var(--uix-touch-min)] flex-row items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-[13px] font-semibold text-emerald-800 dark:text-emerald-100"
                    role="status"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                    Получено
                  </div>
                ) : (
                  <>
                    {isPingInvite ? (
                      <TapScaleButton
                        type="button"
                        haptic
                        subtle={!isSurface}
                        disabled={locked || packBusy}
                        className={mailButtonClass}
                        aria-label={`Прислать пригласительные коды в чат. Задание: ${displayLabel}`}
                        onClick={() => invitePackMut.mutate(p.key)}
                      >
                        {packBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Mail className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        Коды в ЛС
                      </TapScaleButton>
                    ) : null}
                    <TapScaleButton
                      type="button"
                      haptic
                      subtle={!isSurface}
                      disabled={locked || busy || blockEdge || blockUnverifiable}
                      className={xpButtonClass}
                      aria-label={`Забрать награду за задание: ${displayLabel}`}
                      onClick={() => claimMut.mutate(p.key)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      Забрать награду
                    </TapScaleButton>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  if (isSurface) {
    return (
      <section className="space-y-4" aria-label="Задания">
        {inner}
      </section>
    );
  }

  return (
    <section
      className={`${EDGE_CARD} mt-[var(--uix-space-4)] space-y-[var(--uix-space-3)]`}
      aria-label="Задания"
    >
      {inner}
    </section>
  );
}
