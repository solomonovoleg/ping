import { useEffect, useRef, useState, useCallback } from "react";
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
  type PingokMemorySearchResponse,
  type PingokExecuteResponse,
  type PingokExecuteCandidate,
} from "./pingok-micro-api";
import { fetchFeed, type FeedPost } from "@/lib/posts";
import { PingokVoicePanel, type PingokVoiceVisualPhase } from "./PingokVoicePanel";
import { triggerTapFeedback, triggerSuccessFeedback, triggerErrorFeedback } from "@/lib/micro-feedback";
import { isVoiceNo, isVoiceYes, pickCandidateFromVoice } from "./voice-followup";

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
  | null;
const RECENT_COMMANDS_KEY = "pingok:recent-commands:v1";

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
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [pendingVoiceAction, setPendingVoiceAction] = useState<PendingVoiceAction>(null);
  const lastVisualPhaseRef = useRef<PingokVoiceVisualPhase | null>(null);

  const pushRecentCommand = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    setRecentCommands((prev) => {
      const next = [normalized, ...prev.filter((x) => x !== normalized)].slice(0, 3);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
        }
      } catch {
        /* ignore */
      }
      return next;
    });
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

    if (data.intent === "find") {
      setExecPhase("memory");
      try {
        const mem = await pingokMicroMemorySearch(commandText);
        setMemorySearch(mem);
      } catch (e) {
        setExecError(e instanceof Error ? e.message : "Ошибка поиска");
      }
      setExecPhase(null);
    } else if (data.intent === "show") {
      setExecPhase("posts");
      try {
        const posts = await fetchFeed(15, 0, { q: commandText });
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
        const ex = await pingokMicroExecute(commandText);
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
  }, [call, onClose]);

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
    [],
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
        } else {
          await startPendingCallTo(picked, pending.mode);
        }
        return true;
      }
      if (isVoiceNo(spoken)) {
        setPendingVoiceAction(null);
        setExecuteResult(null);
        setStage("result");
        setParseResult({
          intent: pending.kind === "pick_user" ? "message" : "call",
          commandText: spoken,
          reply: pending.kind === "pick_user" ? "Ок, отменил отправку. Назовите получателя заново." : "Ок, отменил звонок. Назовите контакт заново.",
          slots: {},
        });
        return true;
      }
      setStage("result");
      setParseResult({
        intent: pending.kind === "pick_user" ? "message" : "call",
        commandText: spoken,
        reply:
          pending.kind === "pick_user"
            ? "Не распознал адресата. Скажите имя или номер из списка."
            : "Не распознал контакт. Скажите имя или номер из списка.",
        slots: {},
      });
      return true;
    },
    [pendingVoiceAction, sendPendingMessageTo, startPendingCallTo],
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
        pushRecentCommand(effectiveCommand);
        await runParse(effectiveCommand);
      })();
    },
  });

  const startRef = useRef(start);
  const abortRef = useRef(abort);
  startRef.current = start;
  abortRef.current = abort;

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(RECENT_COMMANDS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return;
      setRecentCommands(
        arr
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .slice(0, 3),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) {
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
      return;
    }
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
    void startRef.current();
    return () => {
      abortRef.current();
    };
  }, [open, voiceMode]);

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
        executeResult.code === "pick_call_user");
    if (waitingForPick) return;
    const shouldAutoRearm =
      parseResult?.intent === "unknown" ||
      (executeResult &&
        !executeResult.ok &&
        executeResult.code !== "confirm_user" &&
        executeResult.code !== "pick_user" &&
        executeResult.code !== "confirm_call_user" &&
        executeResult.code !== "pick_call_user");
    if (!shouldAutoRearm) return;
    const t = window.setTimeout(() => {
      setStage("listening");
      void startRef.current();
    }, 850);
    return () => window.clearTimeout(t);
  }, [open, stage, pendingVoiceAction, executeResult, parseResult]);

  const handleClose = () => {
    triggerTapFeedback({ haptic: true, sound: false });
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

  const doneSubtitle =
    execError || phase === "error"
      ? "Попробуйте ещё раз"
      : memorySearch ||
          showPosts !== null ||
          (executeResult && !executeResult.ok && executeResult.candidates?.length)
        ? "Смотрите варианты ниже"
        : "Команда обработана";

  useEffect(() => {
    if (!open) return;
    const prev = lastVisualPhaseRef.current;
    if (prev !== visualPhase && visualPhase === "done") {
      if (execError || phase === "error") {
        triggerErrorFeedback();
      } else {
        triggerSuccessFeedback();
      }
    }
    lastVisualPhaseRef.current = visualPhase;
  }, [visualPhase, open, execError, phase]);

  const handleReplayCommand = (text: string) => {
    triggerTapFeedback({ haptic: true, sound: false });
    setTranscript(text);
    void runParse(text);
  };

  const micLabel =
    phase === "error"
      ? "Нет доступа к микрофону"
      : pendingVoiceAction?.kind === "confirm_user"
        ? "Ожидаю ответ: да или нет"
        : pendingVoiceAction?.kind === "confirm_call_user"
          ? "Подтвердите звонок: да или нет"
        : pendingVoiceAction?.kind === "pick_user"
          ? "Назовите получателя"
          : pendingVoiceAction?.kind === "pick_call_user"
            ? "Назовите контакт для звонка"
          : phase === "listening"
            ? "Микрофон активен"
            : "Микрофон готов";

  const handlePickCandidate = async (c: PingokExecuteCandidate) => {
    if (!executeResult || executeResult.ok) return;
    if (executeResult.code === "pick_user" || executeResult.code === "confirm_user") {
      const pending = executeResult.pendingMessage;
      if (!pending?.trim()) return;
      setPickBusyId(c.id);
      try {
        const ex = await pingokMicroSendDm(c.id, pending);
        setExecuteResult(ex);
        if (ex.ok) {
          setPendingVoiceAction(null);
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

  return (
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
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] leading-snug"
                    style={{ color: "rgba(255,255,255,.65)" }}
                  >
                    <span className="font-medium text-white/90">Ответ: </span>
                    {parseResult.reply}
                  </div>
                ) : null}

                {stage === "listening" ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-white/60">
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

                {stage === "listening" && recentCommands.length > 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                      Последние команды
                    </div>
                    <div className="space-y-1.5">
                      {recentCommands.map((c) => (
                        <TapScaleButton
                          key={c}
                          type="button"
                          haptic
                          subtle
                          className="w-full min-h-[var(--uix-touch-min)] rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-left text-[12px] text-white/80 hover:bg-white/10"
                          onClick={() => handleReplayCommand(c)}
                        >
                          {c}
                        </TapScaleButton>
                      ))}
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
                            className="mt-2 w-full rounded-xl border border-indigo-400/40 bg-indigo-500/15 py-2 text-left text-[13px] font-medium text-indigo-100"
                            onClick={() => openChat(memorySearch.payload.bestMatch!.chatId)}
                          >
                            Открыть чат: {memorySearch.payload.bestMatch.chatTitle}
                          </TapScaleButton>
                        ) : null}
                        {memorySearch.payload.alternatives?.length ? (
                          <ul className="mt-2 space-y-1.5">
                            {memorySearch.payload.alternatives.map((alt) => (
                              <li key={alt.messageId}>
                                <button
                                  type="button"
                                  className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[11px] text-white/50 transition-colors hover:bg-white/5"
                                  onClick={() => openChat(alt.chatId)}
                                >
                                  <span className="font-medium text-white/85">{alt.chatTitle}</span>
                                  <span className="mt-0.5 line-clamp-2 block">{alt.excerpt}</span>
                                </button>
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
                    <p className="mb-2 text-[12px] text-cyan-100/90">{executeResult.reply}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <TapScaleButton
                        type="button"
                        haptic
                        subtle
                        disabled={pickBusyId !== null}
                        className="min-h-[var(--uix-touch-min)] rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-2 py-2 text-[13px] font-medium text-cyan-100"
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
                        className="min-h-[var(--uix-touch-min)] rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[13px] font-medium text-white/80"
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
                (executeResult.code === "pick_user" || executeResult.code === "pick_call_user") &&
                executeResult.candidates?.length ? (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5">
                    <p className="mb-2 text-[12px] text-amber-100/90">{executeResult.reply}</p>
                    <ul className="space-y-1.5">
                      {executeResult.candidates.map((c) => {
                        const label = [c.displayName, c.surname].filter(Boolean).join(" ").trim() || "Пользователь";
                        return (
                          <li key={c.id}>
                            <TapScaleButton
                              type="button"
                              haptic
                              subtle
                              disabled={pickBusyId !== null}
                              className="w-full min-h-[var(--uix-touch-min)] rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-left text-[13px] font-medium text-white/90 transition-colors hover:bg-white/10 disabled:opacity-50"
                              onClick={() => void handlePickCandidate(c)}
                            >
                              {pickBusyId === c.id
                                ? executeResult.code === "pick_call_user"
                                  ? "Запускаю звонок…"
                                  : "Отправка…"
                                : label}
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
                      <ul className="space-y-1.5">
                        {showPosts.slice(0, 10).map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[12px] text-white/55 transition-colors hover:bg-white/5"
                              onClick={() => openPost(p)}
                            >
                              <span className="font-medium text-white/90">
                                {p.author.displayName ?? ""} {p.author.surname ?? ""}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block">{p.text || "Медиа"}</span>
                            </button>
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
                    className="w-full rounded-2xl border border-indigo-400/35 bg-indigo-500/15 py-2.5 text-sm font-medium text-indigo-100"
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
                    Ещё раз
                  </TapScaleButton>
                ) : null}
          </PingokVoicePanel>
        </>
      ) : null}
    </AnimatePresence>
  );
}
