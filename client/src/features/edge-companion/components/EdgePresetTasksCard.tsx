import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Loader2, Mail } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import {
  EdgePresetVerificationError,
  postEdgeParticipantTask,
  postEdgePingInvitePack,
} from "@/lib/edge-participant";
import { EDGE_BLOCK_SUB, EDGE_BLOCK_TITLE, EDGE_CARD } from "@/features/edge-companion/edge-uix";

type Props = {
  edgeId: string;
  presets: EdgeTaskPresetPublic[];
  /** Как у кормления: кампания на паузе / срок вышел. */
  interactLocked?: boolean;
};

function denyMessage(code: string | undefined): string {
  switch (code) {
    case "already_claimed":
      return "Награда за это задание уже получена.";
    case "campaign_locked":
      return "Кампания недоступна для заданий.";
    case "not_published":
      return "Кампания ещё не опубликована.";
    case "deadline_passed":
      return "Срок выполнения задания истёк.";
    case "invalid_preset":
      return "Задание не найдено в кампании.";
    case "verification_failed":
      return "Условие задания не выполнено (уровень, streak или др.).";
    default:
      return "Не удалось начислить XP.";
  }
}

function verifyHint(p: EdgeTaskPresetPublic): string | null {
  const v = p.verify ?? { type: "honor" as const };
  if (v.type === "honor") return null;
  if (v.type === "follow_creator") return "Нужна подписка на автора кампании.";
  if (v.type === "react_post") return "Нужна реакция на пост кампании (указан в настройках).";
  if (v.type === "comment_post") return "Нужен комментарий к посту кампании.";
  if (v.type === "edge_min_level") return `Мин. уровень в кампании: ${v.minLevel}.`;
  if (v.type === "edge_min_xp") return `Мин. XP в кампании: ${v.minXp}.`;
  if (v.type === "edge_min_care_streak") return `Серия заботы: минимум ${v.minDays} дн.`;
  if (v.type === "ping_invited_users") {
    return `Порог: ${v.minCount} приглашённых. «Коды в ЛС» — столько же персональных кодов от автора (не расходуют ваш лимит).`;
  }
  return null;
}

export function EdgePresetTasksCard({ edgeId, presets, interactLocked }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const claimMut = useMutation({
    mutationFn: (taskKey: string) => postEdgeParticipantTask(edgeId, taskKey),
    onSuccess: (data) => {
      qc.setQueryData(["edge", "participant", "state", edgeId], data.state);
      void qc.invalidateQueries({ queryKey: ["edge", "participant", "leaderboard", edgeId] });
      if (data.awarded) {
        const sign = data.xpDelta >= 0 ? "+" : "";
        toast({
          title: "Задание",
          description: `${sign}${data.xpDelta} XP`,
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
        title: e instanceof EdgePresetVerificationError ? "Проверка задания" : "Ошибка",
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
        `Отправлено кодов: ${data.codesCount}. Смотрите личные сообщения от автора кампании.`;
      const action = (
        <ToastAction
          altText="Открыть чат с автором"
          onClick={() => setLocation(`/chat/${encodeURIComponent(data.chatId)}`)}
        >
          К чату
        </ToastAction>
      ) as ToastActionElement;
      toast({
        title: "Коды в ЛС",
        description: desc,
        duration: 10_000,
        action,
      });
    },
    onError: (e) => {
      toast({
        title: "Не удалось отправить коды",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });

  if (!presets.length) return null;

  const locked = Boolean(interactLocked);

  return (
    <section
      className={`${EDGE_CARD} mt-[var(--uix-space-4)] space-y-[var(--uix-space-3)]`}
      aria-label="Задания кампании"
    >
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className={EDGE_BLOCK_TITLE}>Задания</h3>
      </div>
      {locked ? (
        <p className={EDGE_BLOCK_SUB} role="status">
          Сейчас задания недоступны (кампания на паузе или завершена).
        </p>
      ) : (
        <p className={EDGE_BLOCK_SUB}>Выполните условие и нажмите «Получить XP» (один раз на задание).</p>
      )}

      <ul className="space-y-[var(--uix-space-2)]">
        {presets.map((p) => {
          const net = p.points - p.penalty;
          const busy = claimMut.isPending && claimMut.variables === p.key;
          const packBusy = invitePackMut.isPending && invitePackMut.variables === p.key;
          const hint = verifyHint(p);
          const isPingInvite = p.verify?.type === "ping_invited_users";
          return (
            <li
              key={p.key}
              className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-background/40 px-[var(--uix-space-3)] py-[var(--uix-space-3)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="uix-text-body font-medium text-foreground">{p.label}</p>
                <p className="uix-text-caption text-muted-foreground">
                  {net >= 0 ? `+${net}` : `${net}`} XP · срок {p.deadlineDays} дн. с входа в кампанию
                  {hint ? ` · ${hint}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {isPingInvite ? (
                  <TapScaleButton
                    type="button"
                    haptic
                    subtle
                    disabled={locked || packBusy}
                    className="min-h-[var(--uix-touch-min)] rounded-xl px-4"
                    aria-label={`Получить коды приглашения в личные сообщения: ${p.label}`}
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
                  subtle
                  disabled={locked || busy}
                  className="min-h-[var(--uix-touch-min)] rounded-xl px-4"
                  aria-label={`Получить XP за задание: ${p.label}`}
                  onClick={() => claimMut.mutate(p.key)}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  Получить XP
                </TapScaleButton>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
