import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Newspaper } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { useCallContext } from "@/contexts/CallContext";
import type { PingokMicroParseResponse } from "../shared/command-types";
import { usePingokMicroStt } from "./usePingokMicroStt";
import { stripWakePhrase } from "./strip-wake";
import { API, apiFetch } from "@/lib/api-base";
import {
  pingokMicroMemorySearch,
  pingokMicroExecute,
  pingokMicroSendDm,
  pingokMicroStartCall,
  pingokMicroConfirmScheduleCall,
  type PingokMemorySearchResponse,
  type PingokExecuteResponse,
  type PingokExecuteCandidate,
} from "./pingok-micro-api";
import { fetchFeed, type FeedPost } from "@/lib/posts";
import { PingokVoicePanel, type PingokVoiceVisualPhase } from "./PingokVoicePanel";
import {
  triggerTapFeedback,
  triggerSuccessFeedback,
  triggerErrorFeedback,
  playPingokReadySound,
} from "@/lib/micro-feedback";
import { isVoiceNo, isVoiceYes, pickCandidateFromVoice } from "./voice-followup";
import { PingokSuccessFlight } from "@/features/pingok/PingokSuccessFlight";
import {
  pingokSuccessPayloadFromExecute,
  type PingokSuccessFlightPayload,
} from "@/features/pingok/pingok-success-flight-types";

type Props = {
  open: boolean;
  voiceMode: "record" | "stream";
  onClose: () => void;
};

type ExecPhase = null | "memory" | "posts";
type PendingVoiceAction =
  | { kind: "confirm_user"; candidate: PingokExecuteCandidate; pendingMessage: string }
  | { kind: "pick_user"; candidates: PingokExecuteCandidate[]; pendingMessage: string }
  | { kind: "confirm_call_user"; candidate: PingokExecuteCandidate; mode: "audio" | "video" }
  | { kind: "pick_call_user"; candidates: PingokExecuteCandidate[]; mode: "audio" | "video" }
  | {
      kind: "pick_schedule_call_user";
      candidates: PingokExecuteCandidate[];
      fireAtIso: string;
      reminderTitle: string;
    }
  | null;

export function PingokMicroOverlay({ open, voiceMode, onClose }: Props) {
  const reduced = usePrefersReducedMotion();
  const [, setLocation] = useLocation();
  const call = useCallContext();
  const [stage, setStage] = useState<"listening" | "processing" | "result">("listening");
  const [execPhase, setExecPhase] = useState<ExecPhase>(null);
  const [transcript, setTranscript] = useState("");
  const [parseResult, setParseResult] = useState<PingokMicroParseResponse | null>(null);
  const [memorySearch, setMemorySearch] = useState<PingokMemorySearchResponse | null>(null);
  const [showPosts, setShowPosts] = useState<FeedPost[] | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<PingokExecuteResponse | null>(null);
  const [pickBusyId, setPickBusyId] = useState<string | null>(null);
  const [pendingVoiceAction, setPendingVoiceAction] = useState<PendingVoiceAction>(null);
  const [successFlight, setSuccessFlight] = useState<PingokSuccessFlightPayload | null>(null);
  const lastVisualPhaseRef = useRef<PingokVoiceVisualPhase | null>(null);
  const overlaySessionOpenRef = useRef(false);

  const launchSuccessFlight = useCallback((ex: PingokExecuteResponse, opts?: { messageBody?: string }) => {
    if (!ex.ok) return;
    const p = pingokSuccessPayloadFromExecute(ex, opts);
    if (p) setSuccessFlight(p);
  }, []);

  const runParse = useCallback(async (commandText: string) => {
    setStage("processing");
    setExecPhase(null);
    setParseResult(null);
    setMemorySearch(null);
    setShowPosts(null);
    setExecError(null);
    setExecuteResult(null);
    setPickBusyId(null);
    setPendingVoiceAction(null);

    const standalone = import.meta.env.VITE_PINGOK_MICRO_URL?.replace(/\/$/, "");
    let data: PingokMicroParseResponse;
    try {
      let r = await apiFetch(`${API}/pingok-micro/v1/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commandText }),
        suppressSessionExpireOn401: true,
      });
      if (!r.ok && standalone) {
        r = await fetch(`${standalone}/v1/parse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: commandText }),
        });
      }
      if (!r.ok) {
        throw new Error(String(r.status));
      }
      data = (await r.json()) as PingokMicroParseResponse;
      setParseResult(data);
    } catch {
      setParseResult({
        intent: "unknown",
        commandText,
        reply: standalone
          ? "Не удалось разобрать команду (основной API и отдельный процесс недоступны)."
          : "Не удалось разобрать команду. Запустите основной сервер (`npm run dev`) или задайте VITE_PINGOK_MICRO_URL.",
        slots: {},
      });
      setStage("result");
      return;
    }

    const normalizedCommand = data.commandText.trim() || commandText;

    if (data.intent === "find") {
      setExecPhase("memory");
      try {
        const mem = await pingokMicroMemorySearch(normalizedCommand);
        setMemorySearch(mem);
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка поиска");
      }
      setExecPhase(null);
    } else if (data.intent === "show") {
      setExecPhase("posts");
      try {
        const posts = await fetchFeed(15, 0, { q: normalizedCommand });
        setShowPosts(posts);
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Не удалось загрузить посты");
      }
      setExecPhase(null);
    } else if (
      data.intent === "remind" ||
      data.intent === "plan" ||
      data.intent === "task" ||
      data.intent === "call" ||
      data.intent === "message"
    ) {
      try {
        const ex = await pingokMicroExecute(normalizedCommand);
        setExecuteResult(ex);
        if (ex.ok) {
          if (ex.chatId && ex.targetUserId && ex.callMode) {
            await call.startCall(
              ex.targetUserId,
              ex.targetDisplayName ?? null,
              ex.chatId,
              ex.callMode === "video",
              null,
              { kind: "dm" },
            );
            onClose();
          } else {
            launchSuccessFlight(ex);
          }
          setParseResult((prev) =>
            prev ? { ...prev, reply: ex.reply } : { ...data, reply: ex.reply },
          );
        } else {
          if (
            ex.code === "confirm_user" &&
            Array.isArray(ex.candidates) &&
            ex.candidates.length === 1 &&
            ex.pendingMessage?.trim()
          ) {
            setPendingVoiceAction({
              kind: "confirm_user",
              candidate: ex.candidates[0],
              pendingMessage: ex.pendingMessage.trim(),
            });
          } else if (
            ex.code === "pick_user" &&
            Array.isArray(ex.candidates) &&
            ex.candidates.length > 1 &&
            ex.pendingMessage?.trim()
          ) {
            setPendingVoiceAction({
              kind: "pick_user",
              candidates: ex.candidates,
              pendingMessage: ex.pendingMessage.trim(),
            });
          } else if (
            ex.code === "confirm_call_user" &&
            Array.isArray(ex.candidates) &&
            ex.candidates.length === 1
          ) {
            setPendingVoiceAction({
              kind: "confirm_call_user",
              candidate: ex.candidates[0],
              mode: ex.pendingCallMode === "video" ? "video" : "audio",
            });
          } else if (
            ex.code === "pick_call_user" &&
            Array.isArray(ex.candidates) &&
            ex.candidates.length > 1
          ) {
            setPendingVoiceAction({
              kind: "pick_call_user",
              candidates: ex.candidates,
              mode: ex.pendingCallMode === "video" ? "video" : "audio",
            });
          } else if (
            ex.code === "pick_schedule_call_peer" &&
            Array.isArray(ex.candidates) &&
            ex.candidates.length > 1 &&
            ex.pendingScheduleFireAt &&
            ex.pendingScheduleReminderTitle?.trim()
          ) {
            setPendingVoiceAction({
              kind: "pick_schedule_call_user",
              candidates: ex.candidates,
              fireAtIso: ex.pendingScheduleFireAt,
              reminderTitle: ex.pendingScheduleReminderTitle.trim(),
            });
          }
          setParseResult((prev) =>
            prev ? { ...prev, reply: ex.reply } : { ...data, reply: ex.reply },
          );
        }
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка исполнения");
      }
    }

    setStage("result");
  }, [call, launchSuccessFlight, onClose]);

  const sendPendingMessageTo = useCallback(
    async (candidate: PingokExecuteCandidate, pendingMessage: string) => {
      if (!pendingMessage.trim()) return;
      setStage("processing");
      setPickBusyId(candidate.id);
      try {
        const ex = await pingokMicroSendDm(candidate.id, pendingMessage);
        setExecuteResult(ex);
        if (ex.ok) {
          setPendingVoiceAction(null);
          triggerSuccessFeedback();
          launchSuccessFlight(ex, { messageBody: pendingMessage.trim() });
          setParseResult({
            intent: "message",
            commandText: pendingMessage,
            reply: ex.reply,
            slots: {},
          });
        } else {
          setParseResult({
            intent: "message",
            commandText: pendingMessage,
            reply: ex.reply,
            slots: {},
          });
        }
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка отправки");
      } finally {
        setPickBusyId(null);
        setStage("result");
      }
    },
    [launchSuccessFlight],
  );

  const startPendingCallTo = useCallback(
    async (candidate: PingokExecuteCandidate, mode: "audio" | "video") => {
      setStage("processing");
      setPickBusyId(candidate.id);
      try {
        const ex = await pingokMicroStartCall(candidate.id, mode);
        setExecuteResult(ex);
        if (ex.ok && ex.chatId && ex.targetUserId) {
          await call.startCall(
            ex.targetUserId,
            ex.targetDisplayName ?? ([candidate.displayName, candidate.surname].filter(Boolean).join(" ").trim() || null),
            ex.chatId,
            mode === "video",
            null,
            { kind: "dm" },
          );
          setPendingVoiceAction(null);
          setParseResult({
            intent: "call",
            commandText: "",
            reply: ex.reply,
            slots: {},
          });
          onClose();
          return;
        }
        setParseResult({
          intent: "call",
          commandText: "",
          reply: ex.reply,
          slots: {},
        });
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка запуска звонка");
      } finally {
        setPickBusyId(null);
        setStage("result");
      }
    },
    [call, onClose],
  );

  const confirmScheduleToPeer = useCallback(
    async (candidate: PingokExecuteCandidate, fireAtIso: string, reminderTitle: string) => {
      setStage("processing");
      setPickBusyId(candidate.id);
      try {
        const ex = await pingokMicroConfirmScheduleCall(candidate.id, fireAtIso, reminderTitle);
        setExecuteResult(ex);
        if (ex.ok) {
          setPendingVoiceAction(null);
          triggerSuccessFeedback();
          launchSuccessFlight(ex);
          setParseResult({
            intent: "call",
            commandText: "",
            reply: ex.reply,
            slots: {},
          });
        } else {
          setParseResult({
            intent: "call",
            commandText: "",
            reply: ex.reply,
            slots: {},
          });
        }
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Не удалось запланировать звонок");
      } finally {
        setPickBusyId(null);
        setStage("result");
      }
    },
    [launchSuccessFlight],
  );

  const handleVoiceFollowup = useCallback(
    async (spokenRaw: string): Promise<boolean> => {
      const pending = pendingVoiceAction;
      if (!pending) return false;
      const spoken = spokenRaw.trim();
      if (!spoken) return true;

      if (pending.kind === "confirm_user") {
        const direct = pickCandidateFromVoice(spoken, [pending.candidate]);
        if (isVoiceYes(spoken) || direct?.id === pending.candidate.id) {
          await sendPendingMessageTo(pending.candidate, pending.pendingMessage);
          return true;
        }
        if (isVoiceNo(spoken)) {
          setPendingVoiceAction(null);
          setExecuteResult(null);
          setStage("result");
          setParseResult({
            intent: "message",
            commandText: spoken,
            reply: "Ок, отменил отправку. Скажите имя получателя заново.",
            slots: {},
          });
          return true;
        }
        setStage("result");
        setParseResult({
          intent: "message",
          commandText: spoken,
          reply: "Скажите «да» или «нет». Можно также назвать имя получателя.",
          slots: {},
        });
        return true;
      }

      if (pending.kind === "confirm_call_user") {
        const direct = pickCandidateFromVoice(spoken, [pending.candidate]);
        if (isVoiceYes(spoken) || direct?.id === pending.candidate.id) {
          await startPendingCallTo(pending.candidate, pending.mode);
          return true;
        }
        if (isVoiceNo(spoken)) {
          setPendingVoiceAction(null);
          setExecuteResult(null);
          setStage("result");
          setParseResult({
            intent: "call",
            commandText: spoken,
            reply: "Ок, отменил звонок. Назовите контакт заново.",
            slots: {},
          });
          return true;
        }
        setStage("result");
        setParseResult({
          intent: "call",
          commandText: spoken,
          reply: "Скажите «да» или «нет». Можно также назвать имя контакта.",
          slots: {},
        });
        return true;
      }

      const picked = pickCandidateFromVoice(spoken, pending.candidates);
      if (picked) {
        if (pending.kind === "pick_user") {
          await sendPendingMessageTo(picked, pending.pendingMessage);
        } else if (pending.kind === "pick_schedule_call_user") {
          await confirmScheduleToPeer(picked, pending.fireAtIso, pending.reminderTitle);
        } else {
          await startPendingCallTo(picked, pending.mode);
        }
        return true;
      }
      if (isVoiceNo(spoken)) {
        setPendingVoiceAction(null);
        setExecuteResult(null);
        setStage("result");
        const isMsg = pending.kind === "pick_user";
        const isSched = pending.kind === "pick_schedule_call_user";
        setParseResult({
          intent: isMsg ? "message" : "call",
          commandText: spoken,
          reply: isMsg
            ? "Ок, отменил отправку. Назовите получателя заново."
            : isSched
              ? "Ок, отменил планирование. Скажите команду заново."
              : "Ок, отменил звонок. Назовите контакт заново.",
          slots: {},
        });
        return true;
      }
      setStage("result");
      const isMsg2 = pending.kind === "pick_user";
      const isSched2 = pending.kind === "pick_schedule_call_user";
      setParseResult({
        intent: isMsg2 ? "message" : "call",
        commandText: spoken,
        reply: isMsg2
          ? "Не распознал адресата. Скажите имя или номер из списка."
          : isSched2
            ? "Не распознал контакт. Скажите имя из списка для плана звонка."
            : "Не распознал контакт. Скажите имя или номер из списка.",
        slots: {},
      });
      return true;
    },
    [pendingVoiceAction, sendPendingMessageTo, startPendingCallTo, confirmScheduleToPeer],
  );

  const { phase, liveLine, start, abort, submitStream } = usePingokMicroStt({
    stream: voiceMode === "stream",
    onFinal: (text) => {
      void (async () => {
        setTranscript(text);
        if (!text.trim()) {
          setStage("result");
          setParseResult(null);
          return;
        }
        if (await handleVoiceFollowup(text)) return;
        const { commandText, hadWake } = stripWakePhrase(text);
        const effectiveCommand = (hadWake ? commandText : text).trim();
        if (!effectiveCommand) {
          setStage("result");
          setParseResult({
            intent: "unknown",
            commandText: "",
            reply: "Скажите команду целиком, например: «Напиши Илоне привет» или «Напомни завтра в 9».",
            slots: {},
          });
          return;
        }
        await runParse(effectiveCommand);
      })();
    },
  });

  const startRef = useRef(start);
  const abortRef = useRef(abort);
  startRef.current = start;
  abortRef.current = abort;

  useEffect(() => {
    if (!open) {
      overlaySessionOpenRef.current = false;
      abortRef.current();
      setStage("listening");
      setExecPhase(null);
      setTranscript("");
      setParseResult(null);
      setMemorySearch(null);
      setShowPosts(null);
      setExecError(null);
      setExecuteResult(null);
      setPickBusyId(null);
      setPendingVoiceAction(null);
      setSuccessFlight(null);
      return;
    }
    const freshSession = !overlaySessionOpenRef.current;
    overlaySessionOpenRef.current = true;
    if (freshSession) {
      setStage("listening");
      setExecPhase(null);
      setTranscript("");
      setParseResult(null);
      setMemorySearch(null);
      setShowPosts(null);
      setExecError(null);
      setExecuteResult(null);
      setPickBusyId(null);
      setPendingVoiceAction(null);
      setSuccessFlight(null);
      window.setTimeout(() => {
        if (overlaySessionOpenRef.current && !reduced) playPingokReadySound();
      }, 140);
    }
    void startRef.current();
    return () => {
      abortRef.current();
    };
  }, [open, voiceMode, reduced]);

  useEffect(() => {
    if (!open || !pendingVoiceAction) return;
    const t = window.setTimeout(() => {
      setStage("listening");
      void startRef.current();
    }, 140);
    return () => window.clearTimeout(t);
  }, [open, pendingVoiceAction]);

  useEffect(() => {
    if (!open || stage !== "result") return;
    if (pendingVoiceAction) return;
    const waitingForPick =
      executeResult &&
      !executeResult.ok &&
      (executeResult.code === "confirm_user" ||
        executeResult.code === "pick_user" ||
        executeResult.code === "confirm_call_user" ||
        executeResult.code === "pick_call_user" ||
        executeResult.code === "pick_schedule_call_peer");
    if (waitingForPick) return;
    const shouldAutoRearm =
      parseResult?.intent === "unknown" ||
      (executeResult &&
        !executeResult.ok &&
        executeResult.code !== "confirm_user" &&
        executeResult.code !== "pick_user" &&
        executeResult.code !== "confirm_call_user" &&
        executeResult.code !== "pick_call_user" &&
        executeResult.code !== "pick_schedule_call_peer");
    if (!shouldAutoRearm) return;
    const t = window.setTimeout(() => {
      setStage("listening");
      void startRef.current();
    }, 850);
    return () => window.clearTimeout(t);
  }, [open, stage, pendingVoiceAction, executeResult, parseResult]);

  const handleClose = () => {
    triggerTapFeedback({ haptic: true, sound: true });
    setSuccessFlight(null);
    abort();
    onClose();
  };

  const openChat = (chatId: string) => {
    setLocation(`/chat/${encodeURIComponent(chatId)}`);
    onClose();
  };

  const openPost = (post: FeedPost) => {
    setLocation(`/profile/${post.author.publicId}/post/${encodeURIComponent(post.id)}`);
    onClose();
  };

  const visualPhase: PingokVoiceVisualPhase =
    phase === "listening" ? "listening" : stage === "processing" ? "recognized" : "done";
  const processingLabel =
    stage === "processing"
      ? execPhase === "memory"
        ? "Ищу в сообщениях…"
        : execPhase === "posts"
          ? "Подбираю посты…"
          : parseResult?.intent === "message"
            ? "Отправляю сообщение…"
            : parseResult?.intent === "task"
              ? "Сохраняю задачу…"
              : parseResult?.intent === "call"
                ? "Планирую звонок…"
              : parseResult?.intent === "remind" || parseResult?.intent === "plan"
                ? "Ставлю напоминание…"
                : "Обрабатываю…"
      : null;

  const recognizedText = transcript || liveLine || "…";

  const doneTitle = execError
    ? execError
    : phase === "error"
      ? "Распознавание недоступно"
      : executeResult && executeResult.ok
        ? executeResult.reply.split(/[.!?]\s/)[0]?.trim() || executeResult.reply
        : parseResult?.reply?.split(/[.!?]\s/)[0]?.trim() || "Готово";

  const needsUserPickOrConfirm =
    !!executeResult &&
    !executeResult.ok &&
    !!executeResult.candidates?.length &&
    (executeResult.code === "pick_user" ||
      executeResult.code === "pick_call_user" ||
      executeResult.code === "pick_schedule_call_peer" ||
      executeResult.code === "confirm_user" ||
      executeResult.code === "confirm_call_user");

  const doneSubtitle =
    execError || phase === "error"
      ? "Скажите ещё раз или закройте панель"
      : needsUserPickOrConfirm
        ? "Выберите ниже или ответьте голосом"
        : memorySearch || showPosts !== null
          ? "Откройте нужное касанием"
          : "Можно закрыть или нажать «Новая команда»";

  useEffect(() => {
    if (!open) return;
    const prev = lastVisualPhaseRef.current;
    if (prev !== visualPhase && visualPhase === "done") {
      if (execError || phase === "error") {
        triggerErrorFeedback();
      } else if (executeResult?.ok) {
        triggerSuccessFeedback();
      } else if (needsUserPickOrConfirm) {
        if (!reduced) playPingokReadySound();
        else triggerTapFeedback({ haptic: true, sound: false });
      } else {
        triggerTapFeedback({ haptic: true, sound: !reduced });
      }
    }
    lastVisualPhaseRef.current = visualPhase;
  }, [visualPhase, open, execError, phase, executeResult, needsUserPickOrConfirm, reduced]);

  const micLabel =
    phase === "error"
      ? "Разрешите микрофон в настройках браузера"
      : pendingVoiceAction?.kind === "confirm_user"
        ? "Скажите «да» или «нет»"
        : pendingVoiceAction?.kind === "confirm_call_user"
          ? "«Да» — звоним, «нет» — отмена"
        : pendingVoiceAction?.kind === "pick_user"
          ? "Имя или «первый» / «второй»"
          : pendingVoiceAction?.kind === "pick_call_user"
            ? "Контакт или номер из списка"
          : pendingVoiceAction?.kind === "pick_schedule_call_user"
            ? "Кому звонок — имя из списка"
          : phase === "listening"
            ? "Слушаю"
            : "Готов";

  const handlePickCandidate = async (c: PingokExecuteCandidate) => {
    if (!executeResult || executeResult.ok) return;
    if (executeResult.code === "pick_schedule_call_peer") {
      const fire = executeResult.pendingScheduleFireAt;
      const title = executeResult.pendingScheduleReminderTitle?.trim();
      if (!fire || !title) return;
      await confirmScheduleToPeer(c, fire, title);
      return;
    }
    if (executeResult.code === "pick_user" || executeResult.code === "confirm_user") {
      const pending = executeResult.pendingMessage;
      if (!pending?.trim()) return;
      setPickBusyId(c.id);
      try {
        const ex = await pingokMicroSendDm(c.id, pending);
        setExecuteResult(ex);
        if (ex.ok) {
          setPendingVoiceAction(null);
          triggerSuccessFeedback();
          launchSuccessFlight(ex, { messageBody: pending.trim() });
          setParseResult((prev) =>
            prev ? { ...prev, reply: ex.reply } : { intent: "message", commandText: "", reply: ex.reply, slots: {} },
          );
        }
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка отправки");
      } finally {
        setPickBusyId(null);
      }
      return;
    }
    const mode = executeResult.pendingCallMode === "video" ? "video" : "audio";
    await startPendingCallTo(c, mode);
  };

  const overlayNode =
    typeof document !== "undefined" ? (
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="pingok-scrim"
              type="button"
              aria-label="Закрыть голосовое управление"
              className="fixed inset-0 z-[105] bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }}
              onClick={handleClose}
            />
            <PingokVoicePanel
              key="pingok-voice"
              visualPhase={visualPhase}
              recognizedText={recognizedText}
              doneTitle={doneTitle}
              doneSubtitle={doneSubtitle}
              processingLabel={processingLabel}
              streamMode={voiceMode === "stream"}
              reducedMotion={reduced}
              onClose={handleClose}
              onSubmitStream={() => submitStream()}
            >
                {parseResult ? (
                  <div
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] leading-snug text-white/88"
                    role="status"
                  >
                    {parseResult.reply}
                  </div>
                ) : null}

                {stage === "listening" ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 min-h-[var(--uix-touch-min)] flex items-center">
                    <div className="inline-flex items-center gap-2 text-[12px] text-white/65">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            phase === "listening"
                              ? "rgba(16,185,129,.95)"
                              : phase === "error"
                                ? "rgba(239,68,68,.95)"
                                : "rgba(148,163,184,.9)",
                        }}
                      />
                      {micLabel}
                    </div>
                  </div>
                ) : null}

                {memorySearch ? (
                  <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-200/90">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      Сообщения
                    </div>
                    {memorySearch.matched ? (
                      <>
                        <p className="text-[13px] leading-snug text-white/90">{memorySearch.summary}</p>
                        {memorySearch.payload.bestMatch ? (
                          <TapScaleButton
                            type="button"
                            haptic
                            className="mt-2 w-full min-h-[var(--uix-touch-min)] rounded-xl border border-indigo-400/40 bg-indigo-500/15 py-2.5 text-left text-[13px] font-semibold text-indigo-100"
                            onClick={() => openChat(memorySearch.payload.bestMatch!.chatId)}
                          >
                            Открыть: {memorySearch.payload.bestMatch.chatTitle}
                          </TapScaleButton>
                        ) : null}
                        {memorySearch.payload.alternatives?.length ? (
                          <ul className="mt-2 space-y-2">
                            {memorySearch.payload.alternatives.map((alt) => (
                              <li key={alt.messageId}>
                                <TapScaleButton
                                  type="button"
                                  haptic
                                  subtle
                                  className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left text-[12px] text-white/55 transition-colors hover:bg-white/8"
                                  onClick={() => openChat(alt.chatId)}
                                >
                                  <span className="font-semibold text-white/88">{alt.chatTitle}</span>
                                  <span className="mt-0.5 line-clamp-2 block text-[11px]">{alt.excerpt}</span>
                                </TapScaleButton>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[13px] text-white/55">{memorySearch.hint}</p>
                    )}
                  </div>
                ) : null}

                {executeResult &&
                !executeResult.ok &&
                (executeResult.code === "confirm_user" || executeResult.code === "confirm_call_user") &&
                executeResult.candidates?.[0] &&
                (executeResult.code === "confirm_call_user" || executeResult.pendingMessage) ? (
                  <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2.5">
                    <p className="mb-1 text-[13px] leading-snug text-cyan-50/95">{executeResult.reply}</p>
                    <p className="mb-3 text-[11px] text-cyan-200/55">Голосом: «да» / «нет» · или кнопки</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TapScaleButton
                        type="button"
                        haptic
                        subtle
                        disabled={pickBusyId !== null}
                        className="min-h-[var(--uix-touch-min)] rounded-xl border border-cyan-300/30 bg-cyan-500/15 px-2 py-2.5 text-[13px] font-semibold text-cyan-100"
                        onClick={() =>
                          void handlePickCandidate(executeResult.candidates![0]!)
                        }
                      >
                        {executeResult.code === "confirm_call_user"
                          ? executeResult.pendingCallMode === "video"
                            ? "Да, видеозвонок"
                            : "Да, позвонить"
                          : "Да, отправить"}
                      </TapScaleButton>
                      <TapScaleButton
                        type="button"
                        haptic
                        subtle
                        className="min-h-[var(--uix-touch-min)] rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 text-[13px] font-semibold text-white/85"
                        onClick={() => {
                          setPendingVoiceAction(null);
                          setExecuteResult(null);
                          setParseResult((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  reply:
                                    executeResult.code === "confirm_call_user"
                                      ? "Ок, отменил звонок. Назовите контакт заново."
                                      : "Ок, отменил отправку. Скажите имя получателя заново.",
                                }
                              : {
                                  intent: executeResult.code === "confirm_call_user" ? "call" : "message",
                                  commandText: "",
                                  reply:
                                    executeResult.code === "confirm_call_user"
                                      ? "Ок, отменил звонок. Назовите контакт заново."
                                      : "Ок, отменил отправку. Скажите имя получателя заново.",
                                  slots: {},
                                },
                          );
                        }}
                      >
                        Нет
                      </TapScaleButton>
                    </div>
                  </div>
                ) : null}

                {executeResult &&
                !executeResult.ok &&
                (executeResult.code === "pick_user" ||
                  executeResult.code === "pick_call_user" ||
                  executeResult.code === "pick_schedule_call_peer") &&
                executeResult.candidates?.length ? (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5">
                    <p className="mb-1 text-[13px] leading-snug text-amber-50/95">{executeResult.reply}</p>
                    <p className="mb-2.5 text-[11px] text-amber-200/55">
                      Касание или голос: «первый», «второй»… или имя
                    </p>
                    <ul className="space-y-2">
                      {executeResult.candidates.map((c, idx) => {
                        const label = [c.displayName, c.surname].filter(Boolean).join(" ").trim() || "Пользователь";
                        const busyLabel =
                          executeResult.code === "pick_schedule_call_peer"
                            ? "Планирую…"
                            : executeResult.code === "pick_call_user"
                              ? "Запускаю звонок…"
                              : "Отправка…";
                        return (
                          <li key={c.id}>
                            <TapScaleButton
                              type="button"
                              haptic
                              subtle
                              disabled={pickBusyId !== null}
                              className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-left text-[13px] font-semibold text-white/92 transition-colors hover:bg-white/10 disabled:opacity-50"
                              onClick={() => void handlePickCandidate(c)}
                              aria-label={`${idx + 1}: ${label}`}
                            >
                              <span className="mr-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white/70">
                                {idx + 1}
                              </span>
                              {pickBusyId === c.id ? busyLabel : label}
                            </TapScaleButton>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {showPosts !== null ? (
                  <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-200/90">
                      <Newspaper className="h-3.5 w-3.5" aria-hidden />
                      Посты
                    </div>
                    {showPosts.length === 0 ? (
                      <p className="text-[13px] text-white/55">По запросу ничего не нашлось.</p>
                    ) : (
                      <ul className="space-y-2">
                        {showPosts.slice(0, 10).map((p) => (
                          <li key={p.id}>
                            <TapScaleButton
                              type="button"
                              haptic
                              subtle
                              className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left text-[12px] text-white/55 transition-colors hover:bg-white/8"
                              onClick={() => openPost(p)}
                            >
                              <span className="font-semibold text-white/90">
                                {p.author.displayName ?? ""} {p.author.surname ?? ""}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-[11px]">{p.text || "Медиа"}</span>
                            </TapScaleButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}

                {stage === "result" ? (
                  <TapScaleButton
                    type="button"
                    haptic
                    className="w-full min-h-[var(--uix-touch-min)] rounded-2xl border border-indigo-400/35 bg-indigo-500/15 py-3 text-sm font-semibold text-indigo-100"
                    onClick={() => {
                      setStage("listening");
                      setExecPhase(null);
                      setTranscript("");
                      setParseResult(null);
                      setMemorySearch(null);
                      setShowPosts(null);
                      setExecError(null);
                      setExecuteResult(null);
                      setPickBusyId(null);
                      setPendingVoiceAction(null);
                      void start();
                    }}
                  >
                    Новая команда
                  </TapScaleButton>
                ) : null}
            </PingokVoicePanel>
          </>
        ) : null}
      </AnimatePresence>
    ) : null;

  return (
    <>
      <PingokSuccessFlight
        payload={successFlight}
        reducedMotion={reduced}
        onComplete={() => setSuccessFlight(null)}
      />
      {overlayNode ? createPortal(overlayNode, document.body) : null}
    </>
  );
}
