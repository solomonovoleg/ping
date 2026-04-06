import { useMemo, useState, type CSSProperties } from "react";
import { useToast } from "@/hooks/use-toast";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import {
  edgeTaskPresetDeadlineCaption,
  edgeTaskPresetVerifyHint,
  formatEdgeTaskPresetLabel,
} from "@/lib/edge-task-preset-label";
import {
  EdgePresetVerificationError,
  postEdgeParticipantTask,
  type EdgeParticipantState,
} from "@/lib/edge-participant";
import { edgeScoreTargetCaptionRu, effectiveEdgeTaskPresetScoreTarget } from "@/lib/edge-task-score-target";
import {
  EDGE_REWARD_READY_CHROME_DEFAULT,
  EDGE_REWARD_READY_STYLE,
  type EdgeRewardReadyChromeVariant,
} from "@/lib/edge-task-reward-ready";
import { EdgeTaskQuestSummaryStrip } from "@/features/edge-companion/components/EdgeTaskQuestSummaryStrip";
import { triggerSuccessFeedback } from "@/lib/micro-feedback";
import {
  hasObjectiveTaskVerify,
  needsEdgeVerify,
  needsPlatformVerify,
} from "@shared/edge-task-preset-config";
import { TEMPLATE_PAGE_PADDING_TOP } from "./template-layout";
import type { InteractiveTemplateNav } from "./interactive-template-nav";

const PT = TEMPLATE_PAGE_PADDING_TOP;

const sectionHeaderRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
  marginTop: 4,
  paddingLeft: 2,
};

const sectionKickerStyle: CSSProperties = {
  color: "rgba(180,195,220,0.5)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1.5,
};

function templateTaskWhereLabel(task: EdgeTaskPresetPublic): string | null {
  const v = task.verify;
  if (!v) return null;
  if (!hasObjectiveTaskVerify(v)) return "нет проверки";
  if (needsEdgeVerify(v)) return "игра";
  if (needsPlatformVerify(v)) return "приложение";
  return null;
}

function taskDenyRu(code: string | undefined): string {
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
      return "Условие задания ещё не выполнено.";
    case "leaderboard_frozen":
      return "Рейтинг на паузе — начисления временно остановлены.";
    case "honor_disabled":
      return "Задание без проверки отключено — нужен тип условия в конструкторе.";
    default:
      return "Сейчас награду выдать не удалось.";
  }
}

export function InteractiveTemplateTasksPage({
  edgeId,
  presets,
  interactLocked,
  leaderboardPrimaryEnabled = true,
  leaderboardSecondaryEnabled = true,
  onParticipantState,
  participantState,
  nav,
  taskRewardReadyChrome = EDGE_REWARD_READY_CHROME_DEFAULT,
}: {
  edgeId: string;
  presets: EdgeTaskPresetPublic[];
  interactLocked: boolean;
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  onParticipantState: (s: EdgeParticipantState) => void;
  participantState?: EdgeParticipantState;
  nav: InteractiveTemplateNav;
  /** Для светлого полноэкранного шаблона — `light` (сейчас шелл тёмный → `dark`). */
  taskRewardReadyChrome?: EdgeRewardReadyChromeVariant;
}) {
  const rr = EDGE_REWARD_READY_STYLE[taskRewardReadyChrome];
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { primaryPresets, secondaryPresets } = useMemo(() => {
    const primary: EdgeTaskPresetPublic[] = [];
    const secondary: EdgeTaskPresetPublic[] = [];
    for (const p of presets) {
      if (effectiveEdgeTaskPresetScoreTarget(p) === "primary") primary.push(p);
      else secondary.push(p);
    }
    return { primaryPresets: primary, secondaryPresets: secondary };
  }, [presets]);

  const primaryList = leaderboardPrimaryEnabled ? primaryPresets : [];
  const secondaryList = leaderboardSecondaryEnabled ? secondaryPresets : [];
  const visiblePresets = useMemo(() => [...primaryList, ...secondaryList], [primaryList, secondaryList]);
  const showBothLeaderboards = leaderboardPrimaryEnabled && leaderboardSecondaryEnabled;

  const totalXP = visiblePresets.reduce((s, p) => s + p.points, 0);
  const totalTasks = visiblePresets.length;
  const doneTasks = useMemo(() => {
    return visiblePresets.filter((p) =>
      Boolean(participantState?.taskProgress?.find((t) => t.taskKey === p.key)?.claimed),
    ).length;
  }, [visiblePresets, participantState?.taskProgress]);

  const runTask = async (p: EdgeTaskPresetPublic) => {
    if (interactLocked) {
      toast({ title: "Недоступно", description: "Кампания на паузе или завершена.", variant: "destructive" });
      return;
    }
    setBusyKey(p.key);
    try {
      const res = await postEdgeParticipantTask(edgeId, p.key);
      const board = edgeScoreTargetCaptionRu(effectiveEdgeTaskPresetScoreTarget(p));
      if (res.awarded) {
        triggerSuccessFeedback();
        onParticipantState(res.state);
        toast({
          title: "Готово",
          description:
            res.xpDelta === 0
              ? `Засчитано в «${board}».`
              : `+${res.xpDelta} XP зачислено в «${board}».`,
        });
      } else {
        toast({
          title: "Задание",
          description: taskDenyRu(res.denyReason),
          variant: res.denyReason === "already_claimed" ? "default" : "destructive",
        });
      }
    } catch (e) {
      if (e instanceof EdgePresetVerificationError) {
        toast({ title: "Условие не выполнено", description: e.message, variant: "destructive" });
      } else {
        toast({
          title: "Ошибка",
          description: e instanceof Error ? e.message : "Не удалось выполнить",
          variant: "destructive",
        });
      }
    } finally {
      setBusyKey(null);
      setExpanded(null);
    }
  };

  const renderTaskCard = (task: EdgeTaskPresetPublic) => {
    const isOpen = expanded === task.key;
    const line = participantState?.taskProgress?.find((t) => t.taskKey === task.key);
    const isDone = Boolean(line?.claimed);
    const blockEdge = Boolean(line && line.tracking === "edge" && !line.satisfied);
    const blockHonor = task.verify?.type === "honor";
    const progressPct =
      line && line.ratio !== null && !isDone ? Math.min(100, Math.round(line.ratio * 100)) : null;
    const board = edgeScoreTargetCaptionRu(effectiveEdgeTaskPresetScoreTarget(task));
    const taskTitle = formatEdgeTaskPresetLabel(task.label, task.verify);
    const verifyHint = edgeTaskPresetVerifyHint(task.verify);
    const deadlineLine = edgeTaskPresetDeadlineCaption(task.deadlineDays);
    const whereLabel = templateTaskWhereLabel(task);
    const edgeRewardReady =
      !isDone && line?.tracking === "edge" && Boolean(line?.satisfied);
    return (
      <div
        key={task.key}
        style={{
          background: isDone ? "rgba(16,185,129,0.06)" : isOpen ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)",
          ...(edgeRewardReady
            ? rr.chrome
            : {
                border: `1px solid ${isDone ? "rgba(16,185,129,0.2)" : isOpen ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)"}`,
              }),
          borderRadius: 14,
          marginBottom: 8,
          overflow: "hidden",
          transition: "all 0.25s ease",
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExpanded(isOpen ? null : task.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setExpanded(isOpen ? null : task.key);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              flexShrink: 0,
              background: isDone ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            {isDone ? "✓" : "○"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: isDone ? "rgba(180,195,220,0.5)" : "#f1f5f9",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: isDone ? "line-through" : "none",
              }}
            >
              {taskTitle}
              {whereLabel ? (
                <span style={{ fontWeight: 600, opacity: 0.75, marginLeft: 6, fontSize: 10 }}>
                  · {whereLabel}
                </span>
              ) : null}
              {edgeRewardReady ? (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: rr.accent }} aria-label="Награда готова">
                  ✨ Готово
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 10, color: "rgba(180,195,220,0.45)", marginTop: 3 }}>{board}</div>
          </div>
          <div
            style={{
              background: isDone ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.15)",
              color: isDone ? "#34d399" : "#c4b5fd",
              borderRadius: 8,
              padding: "3px 8px",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            +
            {isDone && line?.xpAwardedIfClaimed != null ? line.xpAwardedIfClaimed : task.points - task.penalty} XP
          </div>
          {!isDone && (
            <div
              style={{
                color: "rgba(180,195,220,0.3)",
                fontSize: 16,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
                flexShrink: 0,
              }}
            >
              ⌄
            </div>
          )}
        </div>

        {isOpen && !isDone && (
          <div
            style={{
              padding: "0 14px 14px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                color: "rgba(196,181,253,0.78)",
                fontSize: 12,
                lineHeight: 1.55,
                margin: "0 0 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {verifyHint ? <p style={{ margin: 0 }}>{verifyHint}</p> : null}
              {deadlineLine ? <p style={{ margin: 0, color: "rgba(180,195,220,0.55)" }}>{deadlineLine}</p> : null}
              {task.verify?.type === "honor" ? (
                <p style={{ margin: 0, color: "rgba(248,113,113,0.95)", fontSize: 11 }}>
                  Награда заблокирована: сервер не может проверить это задание. Нужен тип условия в конструкторе кампании.
                </p>
              ) : null}
              {line?.tracking === "platform" ? (
                <p style={{ margin: 0, color: "rgba(180,195,220,0.55)", fontSize: 11 }}>
                  Условие проверится в приложении при нажатии кнопки.
                </p>
              ) : null}
              {!verifyHint && !deadlineLine ? (
                <p style={{ margin: 0, color: "rgba(180,195,220,0.55)" }}>
                  Когда условие выполнено в приложении, нажмите «Получить награду».
                </p>
              ) : null}
              {progressPct !== null ? (
                <div style={{ marginTop: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "rgba(180,195,220,0.6)",
                      marginBottom: 4,
                    }}
                  >
                    <span>Прогресс</span>
                    <span>
                      {line?.current ?? 0} / {line?.target ?? "—"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progressPct}%`,
                        background: "linear-gradient(90deg,#7c3aed,#a78bfa)",
                        borderRadius: 4,
                        transition: "width 0.35s ease",
                      }}
                    />
                  </div>
                </div>
              ) : null}
              {blockEdge ? (
                <p style={{ margin: 0, color: "rgba(251,191,36,0.9)", fontSize: 11 }}>
                  Сначала выполните условие в игре — кнопка разблокируется.
                </p>
              ) : null}
              {edgeRewardReady ? (
                <p style={{ margin: 0, color: rr.accent, fontSize: 12, fontWeight: 700 }} role="status">
                  ✨ Условие в игре выполнено — нажмите «Получить награду».
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busyKey === task.key || blockEdge || blockHonor}
              onClick={(e) => {
                e.stopPropagation();
                void runTask(task);
              }}
              style={{
                background: "linear-gradient(135deg,#7c3aed,#6366f1)",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                cursor: busyKey === task.key || blockEdge || blockHonor ? "not-allowed" : "pointer",
                width: "100%",
                opacity: busyKey === task.key ? 0.7 : blockEdge || blockHonor ? 0.45 : 1,
              }}
            >
              {busyKey === task.key ? "…" : "Получить награду"}
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!presets.length) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100%",
          background: "#060b18",
          fontFamily: "'Inter',-apple-system,sans-serif",
          padding: PT + 24,
          color: "rgba(180,195,220,0.55)",
          textAlign: "center",
        }}
      >
        Заданий в кампании пока нет.
        <button
          type="button"
          onClick={() => nav.goToCharacter()}
          style={{
            display: "block",
            margin: "20px auto 0",
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            border: "none",
            borderRadius: 14,
            padding: "12px 24px",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🎮 К игре
        </button>
      </div>
    );
  }

  if (!visiblePresets.length) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100%",
          background: "#060b18",
          fontFamily: "'Inter',-apple-system,sans-serif",
          padding: PT + 24,
          color: "rgba(180,195,220,0.55)",
          textAlign: "center",
        }}
      >
        В кампании есть задания, но ни одно не относится к включённым сейчас рейтингам.
        <button
          type="button"
          onClick={() => nav.goToCharacter()}
          style={{
            display: "block",
            margin: "20px auto 0",
            background: "linear-gradient(135deg,#7c3aed,#6366f1)",
            border: "none",
            borderRadius: 14,
            padding: "12px 24px",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🎮 К игре
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#060b18",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter',-apple-system,sans-serif",
      }}
    >
      <div style={{ flexShrink: 0, padding: `${PT + 12}px 20px 14px` }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", marginBottom: 4 }}>✅ Задания</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 5, height: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${totalTasks ? (doneTasks / totalTasks) * 100 : 0}%`,
                background: "linear-gradient(90deg,#7c3aed,#a78bfa)",
                borderRadius: 5,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span style={{ color: "rgba(196,181,253,0.7)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            {doneTasks}/{totalTasks}
          </span>
        </div>
        <div
          style={{
            background: "rgba(124,58,237,0.12)",
            borderRadius: 12,
            padding: "8px 14px",
            border: "1px solid rgba(124,58,237,0.25)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "#c4b5fd", fontSize: 13, fontWeight: 700 }}>⭐ до {totalXP} XP в заданиях</span>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 10, color: "rgba(180,195,220,0.42)", lineHeight: 1.45 }}>
          Дневные счётчики заданий сбрасываются в полночь UTC.
        </p>
        {participantState?.taskQuestSummary && participantState.taskQuestSummary.presetTotal > 0 ? (
          <div style={{ marginTop: 10 }}>
            <EdgeTaskQuestSummaryStrip variant="onDarkCanvas" summary={participantState.taskQuestSummary} />
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          {leaderboardPrimaryEnabled ? (
            <div>
              {showBothLeaderboards ? (
                <div style={sectionHeaderRowStyle}>
                  <span style={{ fontSize: 16 }} aria-hidden>
                    🏆
                  </span>
                  <span style={sectionKickerStyle}>Основной рейтинг</span>
                </div>
              ) : null}
              {primaryList.length ? (
                primaryList.map(renderTaskCard)
              ) : showBothLeaderboards ? (
                <p
                  style={{
                    color: "rgba(180,195,220,0.45)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: "12px 8px",
                  }}
                >
                  Нет заданий для основного рейтинга.
                </p>
              ) : null}
            </div>
          ) : null}

          {leaderboardSecondaryEnabled ? (
            <div>
              {showBothLeaderboards ? (
                <div style={{ ...sectionHeaderRowStyle, marginTop: 18 }}>
                  <span style={{ fontSize: 16 }} aria-hidden>
                    ⚡
                  </span>
                  <span style={sectionKickerStyle}>Дополнительный рейтинг</span>
                </div>
              ) : !leaderboardPrimaryEnabled ? (
                <div style={sectionHeaderRowStyle}>
                  <span style={{ fontSize: 16 }} aria-hidden>
                    ⚡
                  </span>
                  <span style={sectionKickerStyle}>Активность</span>
                </div>
              ) : null}
              {secondaryList.length ? (
                secondaryList.map(renderTaskCard)
              ) : showBothLeaderboards ? (
                <p
                  style={{
                    color: "rgba(180,195,220,0.45)",
                    fontSize: 13,
                    textAlign: "center",
                    padding: "12px 8px",
                  }}
                >
                  Нет заданий для дополнительного рейтинга.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
