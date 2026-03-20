import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  PhoneOff,
  Phone,
  Mic,
  MicOff,
  RefreshCw,
  MonitorUp,
  Video,
  VideoOff,
  Pause,
  Play,
  ChevronUp,
  PictureInPicture2,
  MessageSquare,
  Send,
  X,
  Subtitles,
  UserPlus,
  RefreshCcw,
  Circle,
  FlipHorizontal2,
  List,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CallState,
  CallDirection,
  IncomingCallInfo,
  CallNetworkQualityLevel,
  CallFeatureSupport,
  CallReactionEvent,
  CallCaptionEvent,
  CallMessageListContext,
} from "@/features/call/call-types";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PULSE_CALL_BACKDROP_CLASS,
  pulseCaptionsActiveGlowStyle,
  pulseDrawerHandleIdleStyle,
  pulseEndOrbFillStyle,
  pulseEndOrbHighlightStyle,
  pulseEndOrbOuterGlowStyle,
  pulseGhostPillStyle,
  pulseGhostPillStyleMobile,
  pulseMediaOffGlowStyle,
  pulseToolbarDividerStyle,
} from "@/features/call/ui/pulse-call-spec";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  DURATION_EMPHASIS_MS,
  DURATION_FAST_MS,
  DURATION_NORMAL_MS,
  DURATION_NORMAL_S,
  EASING_OUT,
  EASING_OUT_BEZIER,
  EASING_OUT_EXPO,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { playHeartFountainSound } from "@/lib/send-sound";
import { getMessages, sendMessage } from "@/lib/chat";
import type { ChatMessagePayload } from "@/lib/realtime-socket-transport";
import { parseMessageDate } from "@/features/chat/utils/format";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

type Props = {
  /** DM/чат с собеседником — для отправки текста из панели «в звонке» в обычный чат. */
  chatId?: string | null;
  subscribeChat?: (chatId: string, onMessage: (msg: ChatMessagePayload) => void) => () => void;
  /** Папка группы при исходящем звонке из чата — совпадает с `useChatMessages.currentFolderId`. */
  callMessageContext?: CallMessageListContext;
  state: CallState;
  direction: CallDirection;
  isVideo: boolean;
  isMuted: boolean;
  onSetMuted: (m: boolean) => void;
  onEndCall: () => void;
  onAccept: () => void;
  onReject: () => void;
  incoming: IncomingCallInfo | null;
  error: string | null;
  statusText: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  networkQuality: CallNetworkQualityLevel;
  supports: CallFeatureSupport;
  isScreenShareActive: boolean;
  isCameraEnabled: boolean;
  localRecordingState: "idle" | "recording" | "paused" | "stopping" | "error";
  localRecordingElapsedMs: number;
  captionsEnabled: boolean;
  localReactions: CallReactionEvent[];
  remoteReactions: CallReactionEvent[];
  captions: CallCaptionEvent[];
  onSwitchCamera: () => Promise<void>;
  onToggleCameraEnabled: () => void;
  onToggleScreenShare: () => Promise<void>;
  onToggleRecording: () => Promise<void>;
  onToggleRecordingPause: () => Promise<void>;
  onToggleCaptions: () => void;
  onRetry?: () => void;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  otherUserId: string | null;
};

const STATE_LABELS: Partial<Record<CallState, string>> = {
  outgoing_ringing: "Вызов...",
  incoming_ringing: "Входящий звонок",
  accepting: "Подключение...",
  connecting: "Подключение...",
  reconnecting: "Восстановление соединения...",
  ended: "Звонок завершён",
  rejected: "Отклонено",
  missed: "Не ответили",
  busy: "Абонент занят",
  failed: "Соединение не установлено",
};

const ACTIVE_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "outgoing_ringing", "accepting", "connecting", "connected", "reconnecting",
]);

const SHOW_MODAL_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "outgoing_ringing", "incoming_ringing", "accepting", "connecting",
  "connected", "reconnecting", "failed", "ended", "rejected", "missed", "busy",
]);

/** Согласовано с `use-mobile` (768): на узком экране сразу PiP, без кадра «пополам». */
function initialCallVideoLayoutMode(): "split" | "pip" {
  if (typeof window === "undefined") return "split";
  return window.innerWidth < 768 ? "pip" : "split";
}
const PIP_DOUBLE_TAP_MS = 280;
const STAGE_SWIPE_TOGGLE_PX = 92;

/** Базовые кнопки мобильного drawer; запись добавляется в `pulseSecondaryRows`. */
const PULSE_MOBILE_SECONDARY_BASE = [
  { icon: Subtitles, label: "Титры" as const },
  { icon: FlipHorizontal2, label: "Смена камеры" as const },
] as const;

/** Десктоп: титры в основной панели; в drawer — «Чат» и прочие действия. */
const PULSE_SECONDARY_CORE = [
  { icon: RefreshCcw, label: "Поворот" },
  { icon: PictureInPicture2, label: "PiP" },
  { icon: MonitorUp, label: "Экран" },
  { icon: Circle, label: "Запись" },
  { icon: MessageSquare, label: "Чат" },
] as const;

type CallChatLine = { id: string; from: "local" | "remote"; text: string; time: string; at: number };

/** Как `useChatMessages`: в группе показываем только сообщения текущей папки. */
function shouldShowChatMessageInCallPanel(ctx: CallMessageListContext, msgFolderId: string | null | undefined): boolean {
  if (ctx.kind !== "group") return true;
  const fid = ctx.folderId;
  const mf = msgFolderId ?? null;
  const inOtherFolder = (fid != null && mf !== fid) || (fid == null && mf != null);
  return !inOtherFolder;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function formatChatClock(d: Date): string {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function CallModal({
  chatId = null,
  subscribeChat,
  callMessageContext = { kind: "unknown" },
  state,
  direction,
  isVideo,
  isMuted,
  onSetMuted,
  onEndCall,
  onAccept,
  onReject,
  incoming,
  error,
  statusText,
  localStream,
  remoteStream,
  connectionState,
  networkQuality,
  supports,
  isScreenShareActive,
  isCameraEnabled,
  localRecordingState,
  localRecordingElapsedMs,
  captionsEnabled,
  localReactions,
  remoteReactions,
  captions,
  onSwitchCamera,
  onToggleCameraEnabled,
  onToggleScreenShare,
  onToggleRecording,
  onToggleRecordingPause,
  onToggleCaptions,
  onRetry,
  otherDisplayName,
  otherAvatarUrl,
  otherUserId,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStageRef = useRef<HTMLDivElement>(null);
  const pipCardRef = useRef<HTMLDivElement>(null);
  const [remoteNeedsTapToPlay, setRemoteNeedsTapToPlay] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localVideoRotation, setLocalVideoRotation] = useState(0);
  /** Зеркало и поворот превью локальной камеры. */
  const localVideoTransformStyle = useMemo(
    (): CSSProperties => ({ transform: `scaleX(-1) rotate(${localVideoRotation}deg)` }),
    [localVideoRotation],
  );
  /** В режиме «пополам»: кто сверху — исходящий поток (локальный у звонящего) или наоборот. */
  const [preferCallerOnTop, setPreferCallerOnTop] = useState(true);
  /** Видео: два равных кадра или картинка-в-картинке (как в FaceTime). */
  const [videoLayoutMode, setVideoLayoutMode] = useState<"split" | "pip">(initialCallVideoLayoutMode);
  /** Кто на весь экран в режиме PiP. */
  const [pipPrimary, setPipPrimary] = useState<"local" | "remote">(direction === "outgoing" ? "local" : "remote");
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const pipDragMetaRef = useRef<{ pointerId: number; startX: number; startY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);
  const pipTapMetaRef = useRef<{ at: number; x: number; y: number } | null>(null);
  const stageSwipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [pulseDrawerOpen, setPulseDrawerOpen] = useState(false);
  const [pulseSecondaryActive, setPulseSecondaryActive] = useState<string | null>(null);
  const [callChatOpen, setCallChatOpen] = useState(false);
  const callChatOpenRef = useRef(false);
  callChatOpenRef.current = callChatOpen;
  const [remoteChatUnread, setRemoteChatUnread] = useState(false);
  const [callChatDraft, setCallChatDraft] = useState("");
  const [callChatMessages, setCallChatMessages] = useState<CallChatLine[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const linkedChat = !!(chatId && subscribeChat);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const callMessageContextRef = useRef(callMessageContext);
  callMessageContextRef.current = callMessageContext;
  const [videoHd, setVideoHd] = useState(false);
  const [floatEmojis, setFloatEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);

  const pulseSecondaryRows = useMemo(() => {
    if (isMobile) {
      type MobileRow = (typeof PULSE_MOBILE_SECONDARY_BASE)[number] | { icon: typeof Circle; label: "Запись" };
      const rows: MobileRow[] = [...PULSE_MOBILE_SECONDARY_BASE];
      rows.push({ icon: Circle, label: "Запись" });
      return rows;
    }
    const last =
      supports.cameraFlip && isVideo
        ? { icon: FlipHorizontal2, label: "Камера" as const }
        : { icon: UserPlus, label: "Участник" as const };
    return [...PULSE_SECONDARY_CORE, last];
  }, [isMobile, supports.cameraFlip, isVideo]);

  useEffect(() => {
    if (callChatOpen) setRemoteChatUnread(false);
  }, [callChatOpen]);

  /** Мобильный 1:1 — только PiP (как в макете), без режима «пополам». */
  useEffect(() => {
    if (!isMobile || !isVideo) return;
    if (!ACTIVE_STATES.has(state)) return;
    setVideoLayoutMode("pip");
  }, [isMobile, isVideo, state]);

  const pushFloatingEmoji = useCallback(
    (emoji: string) => {
      if (reducedMotion) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const x = 8 + Math.random() * 18;
      setFloatEmojis((p) => [...p, { id, emoji, x }]);
      window.setTimeout(() => {
        setFloatEmojis((p) => p.filter((e) => e.id !== id));
      }, 3200);
    },
    [reducedMotion],
  );

  const isVideoConnected = isVideo && state === "connected";

  // Call duration timer
  useEffect(() => {
    if (state === "connected" || state === "reconnecting") {
      if (!timerRef.current) {
        setCallDuration(0);
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (state === "idle") setCallDuration(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    el.srcObject = localStream;
    return () => { el.srcObject = null; };
  }, [localStream, state, videoLayoutMode, pipPrimary]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    const tryPlay = async () => {
      try {
        await el.play();
        setRemoteNeedsTapToPlay(false);
      } catch {
        setRemoteNeedsTapToPlay(true);
      }
    };
    tryPlay();
    return () => {
      el.srcObject = null;
      setRemoteNeedsTapToPlay(false);
    };
  }, [remoteStream, state, videoLayoutMode, pipPrimary]);

  useEffect(() => {
    if (state === "outgoing_ringing" || state === "incoming_ringing" || state === "accepting" || state === "connecting") {
      setPipPrimary(direction === "outgoing" ? "local" : "remote");
    }
  }, [state, direction]);

  useEffect(() => {
    if (!isVideoConnected || videoLayoutMode !== "pip") return;
    /** Как VideoCallCaptions: PiP справа сверху (right-7, top-20). */
    const placePipTopRight = () => {
      const stage = callStageRef.current;
      const pip = pipCardRef.current;
      if (!stage || !pip) return;
      const stageRect = stage.getBoundingClientRect();
      const pipRect = pip.getBoundingClientRect();
      const margin = 8;
      const insetRight = 28;
      const insetTop = isMobile ? 104 : 80;
      const x = Math.max(margin, stageRect.width - pipRect.width - insetRight);
      const y = Math.max(margin, insetTop);
      setPipPosition({ x, y });
    };
    const id = window.requestAnimationFrame(placePipTopRight);
    window.addEventListener("resize", placePipTopRight);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", placePipTopRight);
    };
  }, [isVideoConnected, videoLayoutMode, pipPrimary, isMobile]);

  // Must run on every render — hooks cannot follow a conditional return (React #310).
  const reactionStream = [...localReactions, ...remoteReactions].slice(-8);
  const heartBursts = reactionStream.filter((r) => r.kind === "heart").slice(-4);
  const prevHeartBurstCountRef = useRef(heartBursts.length);
  useEffect(() => {
    const prev = prevHeartBurstCountRef.current;
    if (heartBursts.length > prev) {
      playHeartFountainSound();
    }
    prevHeartBurstCountRef.current = heartBursts.length;
  }, [heartBursts.length]);

  const hdOkStreakRef = useRef(0);
  useEffect(() => {
    const active = isVideo && state === "connected";
    if (!active) {
      hdOkStreakRef.current = 0;
      setVideoHd(false);
      return;
    }
    const track = remoteStream?.getVideoTracks()[0] ?? localStream?.getVideoTracks()[0];
    if (!track) {
      hdOkStreakRef.current = 0;
      setVideoHd(false);
      return;
    }
    hdOkStreakRef.current = 0;
    const onResize = () => {
      hdOkStreakRef.current = 0;
    };
    try {
      track.addEventListener("resize", onResize);
    } catch {
      /* ignore */
    }
    const tick = () => {
      try {
        const s = track.getSettings?.() ?? {};
        const w = Number(s.width) || 0;
        const h = Number(s.height) || 0;
        const ok = w >= 1280 || h >= 720;
        if (ok) hdOkStreakRef.current = Math.min(3, hdOkStreakRef.current + 1);
        else hdOkStreakRef.current = 0;
        setVideoHd(hdOkStreakRef.current >= 2);
      } catch {
        hdOkStreakRef.current = 0;
        setVideoHd(false);
      }
    };
    tick();
    const iv = window.setInterval(tick, 1600);
    return () => {
      clearInterval(iv);
      try {
        track.removeEventListener("resize", onResize);
      } catch {
        /* ignore */
      }
    };
  }, [isVideo, state, remoteStream, localStream]);

  useEffect(() => {
    if (!linkedChat || !chatId || !callChatOpen || !user?.id) return;
    let cancelled = false;
    const gmOpts: { limit: number; folderId?: string } = { limit: 50 };
    if (callMessageContext.kind === "group" && callMessageContext.folderId) {
      gmOpts.folderId = callMessageContext.folderId;
    }
    getMessages(chatId, gmOpts)
      .then((msgs) => {
        if (cancelled) return;
        const textMsgs = msgs.filter((m) => m.type === "text" && m.content.trim());
        const mapped: CallChatLine[] = textMsgs.map((m) => ({
          id: m.id,
          from: m.senderId === user.id ? "local" : "remote",
          text: m.content,
          time: formatChatClock(parseMessageDate(m.createdAt)),
          at: parseMessageDate(m.createdAt).getTime(),
        }));
        mapped.sort((a, b) => a.at - b.at);
        setCallChatMessages((prev) => {
          const byId = new Map<string, CallChatLine>();
          for (const m of mapped) byId.set(m.id, m);
          for (const p of prev) byId.set(p.id, p);
          return Array.from(byId.values()).sort((a, b) => a.at - b.at);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [linkedChat, chatId, callChatOpen, user?.id, callMessageContext]);

  useEffect(() => {
    if (!linkedChat || !chatId || !subscribeChat) return;
    if (!ACTIVE_STATES.has(state)) return;
    const unsub = subscribeChat(chatId, (message) => {
      if (message.chatId !== chatId) return;
      if (message.type !== "text" || !message.content.trim()) return;
      if (!shouldShowChatMessageInCallPanel(callMessageContextRef.current, message.folderId)) return;
      const myId = userIdRef.current;
      const fromRemote = message.senderId !== myId;
      setCallChatMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        const from = fromRemote ? "remote" : "local";
        const line: CallChatLine = {
          id: message.id,
          from,
          text: message.content,
          time: formatChatClock(parseMessageDate(message.createdAt)),
          at: parseMessageDate(message.createdAt).getTime(),
        };
        return [...prev, line].sort((a, b) => a.at - b.at);
      });
      if (fromRemote && !callChatOpenRef.current) setRemoteChatUnread(true);
    });
    return unsub;
  }, [linkedChat, chatId, state, subscribeChat]);

  // useCallback до любого return null — иначе React #310 (разное число хуков idle vs звонок).
  const clampPip = useCallback((x: number, y: number) => {
    const stage = callStageRef.current;
    const pip = pipCardRef.current;
    if (!stage || !pip) return { x, y };
    const stageRect = stage.getBoundingClientRect();
    const pipRect = pip.getBoundingClientRect();
    const margin = 8;
    const maxX = Math.max(margin, stageRect.width - pipRect.width - margin);
    const maxY = Math.max(margin, stageRect.height - pipRect.height - margin);
    return { x: Math.max(margin, Math.min(maxX, x)), y: Math.max(margin, Math.min(maxY, y)) };
  }, []);

  const swapPipPrimary = useCallback(() => {
    setPipPrimary((prev) => (prev === "local" ? "remote" : "local"));
  }, []);

  if (!SHOW_MODAL_STATES.has(state) && !incoming) return null;

  const label = STATE_LABELS[state] ?? "";
  const poorConnection = state === "connected" && (connectionState === "disconnected" || connectionState === "failed");
  const isTerminal = state === "ended" || state === "rejected" || state === "missed" || state === "busy" || state === "failed";
  const showActiveControls = ACTIVE_STATES.has(state);
  /** Входящий на ответ / отклонение — в т.ч. после обрыва WS до принятия. */
  const showIncomingAnswerUi =
    incoming != null && (state === "incoming_ringing" || state === "reconnecting");
  const showVideo = isVideo && state === "connected";
  /** Короткая очередь: старые строки уходят с exit-анимацией. */
  const captionsForStrip = captions.slice(-5);
  const showCaptionStrip =
    supports.captionsRelay && captionsEnabled && captionsForStrip.length > 0;
  const callerStreamIsLocal = direction === "outgoing";
  const localOnTop = preferCallerOnTop ? callerStreamIsLocal : !callerStreamIsLocal;
  const recordSecs = Math.floor(localRecordingElapsedMs / 1000);
  const recordingProgressPercent = Math.min(100, ((localRecordingElapsedMs % 60000) / 60000) * 100);

  const hasCallUtilities =
    showActiveControls &&
        (isMobile
      ? isVideo
      : (supports.cameraFlip && isVideo) ||
        isVideo ||
        supports.screenShare ||
        supports.localRecording ||
        supports.captionsRelay);

  const showPulseTopBar = !error && showActiveControls && !isTerminal;
  const pulseStageDecor = isVideo && showActiveControls && !isTerminal;

  const secondaryDisabled = (lb: string): boolean => {
    if (lb === "Титры") return !supports.captionsRelay;
    if (lb === "Поворот") return !isVideo;
    if (lb === "Камера" || lb === "Смена камеры") return !supports.cameraFlip || !isVideo;
    if (lb === "PiP") return !isVideo;
    if (lb === "Экран") return !supports.screenShare;
    if (lb === "Запись") return !supports.localRecording;
    if (lb === "Чат") return false;
    return false;
  };

  const secondaryVisualActive = (lb: string) => {
    if (lb === "Титры") {
      return captionsEnabled;
    }
    if (lb === "Экран") return isScreenShareActive;
    if (lb === "Чат") return callChatOpen;
    if (lb === "Запись") return localRecordingState !== "idle";
    if (lb === "PiP") return videoLayoutMode === "pip";
    return pulseSecondaryActive === lb;
  };

  const sendCallChatLine = async () => {
    const t = callChatDraft.trim();
    if (!t) return;
    if (linkedChat && chatId) {
      setCallChatDraft("");
      try {
        const payload: { content: string; folderId?: string } = { content: t };
        if (callMessageContext.kind === "group" && callMessageContext.folderId) {
          payload.folderId = callMessageContext.folderId;
        }
        const msg = await sendMessage(chatId, payload);
        setCallChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const line: CallChatLine = {
            id: msg.id,
            from: "local",
            text: msg.content,
            time: formatChatClock(parseMessageDate(msg.createdAt)),
            at: parseMessageDate(msg.createdAt).getTime(),
          };
          return [...prev, line].sort((a, b) => a.at - b.at);
        });
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : "Не удалось отправить",
          variant: "destructive",
        });
        setCallChatDraft(t);
      }
      return;
    }
    const time = formatChatClock(new Date());
    const at = Date.now();
    setCallChatMessages((prev) => [
      ...prev,
      { id: `local-${at}-${Math.random().toString(36).slice(2, 8)}`, from: "local", text: t, time, at },
    ]);
    setCallChatDraft("");
  };

  /** Сообщения, реакции и ввод — общий блок для нижнего листа (моб.) и боковой панели (десктоп). */
  const renderCallChatBody = () => (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-4">
        {callChatMessages.length === 0 ? (
          <p className="text-center text-[11px] leading-relaxed text-white/35">
            {linkedChat
              ? "Текст уходит в этот чат — собеседник увидит сообщения, как обычно в переписке."
              : "Заметки во время звонка — только на этом устройстве, без отправки в чат."}
          </p>
        ) : (
          <>
            <div className="my-1 text-center text-[11px] text-white/30">
              {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </div>
            {callChatMessages.map((m) =>
              m.from === "local" ? (
                <div key={m.id} className="flex flex-row-reverse items-start gap-2.5">
                  <UserAvatar displayName="Вы" seed="local-call-chat" size={28} className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="flex flex-col items-end">
                    <div className="mb-1 flex flex-row-reverse items-baseline gap-2">
                      <span className="text-[12px] font-medium text-white/80">Вы</span>
                      <span className="text-[10px] text-white/30">{m.time}</span>
                    </div>
                    <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-3 py-2 text-[13px] text-white">{m.text}</div>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <UserAvatar
                    avatarUrl={otherAvatarUrl}
                    displayName={otherDisplayName}
                    seed={otherUserId ?? undefined}
                    size={28}
                    className="h-7 w-7 shrink-0 rounded-full"
                  />
                  <div>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-[12px] font-medium text-white/80">{otherDisplayName}</span>
                      <span className="text-[10px] text-white/30">{m.time}</span>
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-white/[0.05] bg-white/[0.06] px-3 py-2 text-[13px] text-white/75">
                      {m.text}
                    </div>
                  </div>
                </div>
              ),
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.05] bg-black/20 px-2 py-1.5 sm:p-3">
        {["❤️", "👍", "🎉", "😂", "🔥"].map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="text-lg leading-none transition-transform duration-150 hover:scale-125"
            onClick={() => {
              pushFloatingEmoji(emoji);
              if (linkedChat && chatId) {
                const emojiPayload: { content: string; folderId?: string } = { content: emoji };
                if (callMessageContext.kind === "group" && callMessageContext.folderId) {
                  emojiPayload.folderId = callMessageContext.folderId;
                }
                void sendMessage(chatId, emojiPayload).catch((e) => {
                  toast({
                    title: e instanceof Error ? e.message : "Не удалось отправить",
                    variant: "destructive",
                  });
                });
                return;
              }
              const time = formatChatClock(new Date());
              const at = Date.now();
              setCallChatMessages((prev) => [
                ...prev,
                { id: `local-${at}-${emoji}`, from: "local", text: emoji, time, at },
              ]);
            }}
            aria-label={`Вставить ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/[0.05] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:p-4 sm:pb-4">
        <div className="relative flex items-center">
          <Input
            value={callChatDraft}
            onChange={(e) => setCallChatDraft(e.target.value)}
            placeholder="Написать..."
            className="rounded-full border-white/[0.08] bg-white/[0.05] pr-10 text-[13px] text-white placeholder:text-white/30 focus-visible:ring-indigo-500/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendCallChatLine();
              }
            }}
          />
          <button
            type="button"
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-full text-indigo-400 transition-colors hover:bg-indigo-500/20 hover:text-indigo-300"
            onClick={() => void sendCallChatLine()}
            aria-label="Отправить"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  const callChatNavHeader = (compact: boolean) => (
    <div
      className={cn(
        "flex shrink-0 items-center border-b border-white/[0.05]",
        compact ? "gap-1 px-2 py-1.5" : "gap-2 px-4 py-3",
      )}
    >
      <TapScaleButton
        type="button"
        onClick={() => {
          setCallChatOpen(false);
          setLocation("/");
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/85 transition-colors hover:bg-white/[0.14]"
        aria-label="К списку чатов"
        haptic
      >
        <List className="h-4 w-4" />
      </TapScaleButton>
      {linkedChat && chatId ? (
        <TapScaleButton
          type="button"
          onClick={() => {
            setCallChatOpen(false);
            setLocation(`/chat/${encodeURIComponent(chatId)}`);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/85 transition-colors hover:bg-white/[0.14]"
          aria-label="Открыть полный чат"
          haptic
        >
          <ExternalLink className="h-4 w-4" />
        </TapScaleButton>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-white/90">
        {linkedChat ? "Чат" : "Заметки при звонке"}
      </span>
      <button
        type="button"
        onClick={() => setCallChatOpen(false)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Закрыть чат"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const onPulseSecondaryClick = (lb: string) => {
    if (secondaryDisabled(lb)) return;
    if (lb === "Титры") {
      onToggleCaptions();
      return;
    }
    if (lb === "Поворот") {
      setLocalVideoRotation((p) => (p + 90) % 360);
      return;
    }
    if (lb === "Камера" || lb === "Смена камеры") {
      void onSwitchCamera();
      return;
    }
    if (lb === "PiP") {
      setVideoLayoutMode((m) => (m === "split" ? "pip" : "split"));
      return;
    }
    if (lb === "Экран") {
      void onToggleScreenShare();
      return;
    }
    if (lb === "Запись") {
      void onToggleRecording();
      return;
    }
    if (lb === "Чат") {
      setCallChatOpen((v) => !v);
      return;
    }
    setPulseSecondaryActive((p) => (p === lb ? null : lb));
  };

  return (
    <div className={cn("fixed inset-0 z-[200] flex flex-row overflow-hidden text-white", PULSE_CALL_BACKDROP_CLASS)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col select-none">
      {/* Тот же знак, что в нижней навигации (`AppLayout`), плюс словесная метка */}
      <div
        className={cn(
          "absolute left-5 top-[max(1.25rem,env(safe-area-inset-top,0px))] z-10 flex cursor-default items-center gap-2 transition-opacity duration-300",
          isMobile ? "opacity-55 hover:opacity-80" : "opacity-85 hover:opacity-100",
        )}
      >
        <img
          src="/F-PING.png?v=5"
          alt=""
          className="h-8 w-8 shrink-0 object-contain select-none"
          width={32}
          height={32}
          decoding="async"
        />
        <span className="text-[13px] font-semibold tracking-tight text-white">PING MOOT</span>
      </div>
      <TapScaleButton
        type="button"
        onClick={onEndCall}
        className="absolute right-4 top-[max(0.85rem,env(safe-area-inset-top,0px))] z-[60] flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/85 shadow-lg backdrop-blur-md transition-colors hover:border-white/25 hover:bg-black/50 hover:text-white"
        aria-label={isTerminal ? "Закрыть" : "Закрыть звонок"}
        haptic
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </TapScaleButton>
      {/* Status banners */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-destructive/90 text-sm max-w-[90%] text-center z-10">
          {error}
        </div>
      )}
      {statusText && !error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-white/20 text-sm max-w-[90%] text-center z-10">
          {statusText}
        </div>
      )}
      {poorConnection && !error && !statusText && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-amber-600/90 text-sm z-10">
          {connectionState === "disconnected" ? "Плохое соединение. Восстановление…" : "Соединение прервано"}
        </div>
      )}
      {/* Пока нет видеопотока — только центральный блок (имя/аватар), без дубля сверху */}
      {showPulseTopBar && showVideo && isMobile ? (
        <div
          className="pointer-events-none absolute left-1/2 z-20 flex max-w-[min(calc(100vw-2rem),320px)] -translate-x-1/2 flex-col items-center gap-0.5 px-4 text-center"
          style={{ top: "calc(2.85rem + env(safe-area-inset-top, 0px))" }}
          aria-label={otherDisplayName ? `Звонок: ${otherDisplayName}` : "Звонок"}
        >
          <span className="font-mono text-[12px] leading-none tabular-nums text-white/40">
            {state === "connected" || state === "reconnecting" ? formatDuration(callDuration) : label || "—"}
          </span>
          <span className="flex items-center gap-1 text-[10px] leading-none text-white/30">
            <span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-emerald-400/55" aria-hidden />
            <span>
              {state === "connected" || state === "reconnecting" ? "Зашифровано" : "Соединение…"}
              {isVideo && showVideo && videoHd ? " · HD" : ""}
            </span>
          </span>
        </div>
      ) : null}
      {showPulseTopBar && showVideo && !isMobile ? (
        <div className="absolute left-1/2 top-5 z-20 flex max-w-[min(calc(100vw-2.5rem),680px)] -translate-x-1/2 flex-nowrap items-center gap-3 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.06] px-5 py-2 shadow-xl backdrop-blur-xl">
          <span className="min-w-0 max-w-[min(36vw,220px)] shrink truncate text-[13px] font-semibold tracking-wide text-white/90">
            {otherDisplayName || "Звонок"}
          </span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-white/55">
            {state === "connected" || state === "reconnecting" ? formatDuration(callDuration) : label || "—"}
          </span>
          {isVideo && showVideo && videoHd ? (
            <>
              <div className="h-5 w-px shrink-0 bg-white/10" aria-hidden />
              <Badge className="shrink-0 border-sky-500/35 bg-sky-500/18 px-2 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                HD
              </Badge>
            </>
          ) : null}
          <div className="h-5 w-px shrink-0 bg-white/10" aria-hidden />
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/50">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
            {state === "connected" || state === "reconnecting" ? "Зашифровано" : "Соединение…"}
          </span>
        </div>
      ) : null}
      {!showPulseTopBar &&
        ((showVideo || (showActiveControls && supports.networkQuality && networkQuality !== "unknown")) && !error) && (
          <div className="absolute left-1/2 top-14 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-2">
            {showVideo && (
              <div className="whitespace-nowrap rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums">
                {formatDuration(callDuration)}
              </div>
            )}
            {showActiveControls && supports.networkQuality && networkQuality !== "unknown" && (
              <div className="whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs">
                Связь: {networkQuality === "good" ? "хорошая" : networkQuality === "medium" ? "средняя" : "плохая"}
              </div>
            )}
          </div>
        )}

      {/* Видео на весь столбец (без чёрной полосы над панелью); кнопки — оверлей снизу */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* Main content area */}
      <div
        ref={callStageRef}
        className="absolute inset-0 z-[1] flex min-h-0 min-w-0 items-center justify-center overflow-hidden"
        onPointerDown={(e) => {
          if (!showVideo) return;
          if ((e.target as HTMLElement).closest("button,input,textarea,[role='button']")) return;
          stageSwipeRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = stageSwipeRef.current;
          stageSwipeRef.current = null;
          if (!s || s.pointerId !== e.pointerId || !showVideo || isMobile) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) >= STAGE_SWIPE_TOGGLE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
            setVideoLayoutMode((prev) => (prev === "split" ? "pip" : "split"));
          }
        }}
      >
        {showVideo ? (
          <div className="pointer-events-none absolute inset-0 z-0 bg-black" aria-hidden />
        ) : pulseStageDecor ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                background:
                  "radial-gradient(ellipse 60% 80% at 50% 35%, rgba(80,70,180,0.18) 0%, rgba(8,8,16,0.97) 80%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 z-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 48% 38%, rgba(255,255,255,0.06) 0%, transparent 55%)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
              <div
                className="h-72 w-52 rounded-full opacity-20"
                style={{
                  background: "radial-gradient(ellipse, rgba(160,140,255,0.35) 0%, transparent 70%)",
                  filter: "blur(32px)",
                }}
              />
            </div>
          </>
        ) : null}
        <style>
          {`@keyframes call-heart-fan {
            0% { transform: translate(0, 0) scale(0.55) rotate(0deg); opacity: 0; }
            15% { opacity: var(--heart-opacity, 0.72); }
            100% { transform: translate(var(--tx, 0px), var(--ty, -110px)) scale(var(--heart-scale, 1.15)) rotate(var(--heart-rot, 0deg)); opacity: 0; }
          }
          @keyframes call-emoji-float {
            0% { transform: translateY(0) scale(0.6); opacity: 0; }
            12% { transform: translateY(-30px) scale(1.15); opacity: 1; }
            60% { transform: translateY(-120px) scale(0.95) translateX(8px); opacity: 0.75; }
            100% { transform: translateY(-220px) scale(0.7) translateX(-6px); opacity: 0; }
          }`}
        </style>
        {showVideo && !isMobile && videoLayoutMode === "split" && (
          <div className="absolute inset-0 z-[1] flex flex-col bg-black">
            <div className={cn("relative z-[1] flex-1 border-b border-white/10 bg-black", localOnTop ? "order-1" : "order-2")}>
              <div className="absolute inset-0 overflow-hidden bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full bg-black object-cover"
                  style={localVideoTransformStyle}
                />
              </div>
              <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/55 text-xs">Вы</div>
            </div>
            <div className={cn("relative z-[1] flex-1 bg-black", localOnTop ? "order-2" : "order-1")}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-full w-full bg-black object-cover"
              />
              <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/55 text-xs">
                {otherDisplayName || "Абонент"}
              </div>
            </div>
          </div>
        )}
        {showVideo && videoLayoutMode === "pip" && (
          <div className="absolute inset-0 z-[1] bg-black">
            <div className="absolute inset-0 z-[1] bg-black">
              {pipPrimary === "local" ? (
                <div className="absolute inset-0 overflow-hidden bg-black">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full min-h-full min-w-full bg-black object-cover"
                    style={localVideoTransformStyle}
                  />
                </div>
              ) : (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full min-h-full min-w-full bg-black object-cover"
                />
              )}
              {!(isMobile && showVideo) ? (
                <div className="absolute top-3 left-3 rounded-full bg-black/55 px-2 py-1 text-xs">
                  {pipPrimary === "local" ? "Вы" : (otherDisplayName || "Абонент")}
                </div>
              ) : null}
            </div>
            <div
              ref={pipCardRef}
              className={cn(
                "absolute z-20 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl touch-none",
                isMobile
                  ? "aspect-[9/16] w-[min(7.25rem,32vw)] max-h-[min(42vh,20rem)] max-w-[92vw]"
                  : "h-28 w-44 max-w-[92vw] cursor-move active:cursor-grabbing",
              )}
              style={{ left: pipPosition.x, top: pipPosition.y }}
              aria-label="Миниатюра: перетащите пальцем. Двойной тап — поменять с основным видео."
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.button !== 0 && e.pointerType === "mouse") return;
                const target = e.currentTarget;
                pipDragMetaRef.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  startLeft: pipPosition.x,
                  startTop: pipPosition.y,
                  moved: false,
                };
                try {
                  target.setPointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
              }}
              onPointerMove={(e) => {
                const meta = pipDragMetaRef.current;
                if (!meta || meta.pointerId !== e.pointerId) return;
                e.stopPropagation();
                const dx = e.clientX - meta.startX;
                const dy = e.clientY - meta.startY;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) meta.moved = true;
                const next = clampPip(meta.startLeft + dx, meta.startTop + dy);
                setPipPosition(next);
              }}
              onPointerUp={(e) => {
                const meta = pipDragMetaRef.current;
                pipDragMetaRef.current = null;
                if (!meta || meta.pointerId !== e.pointerId) return;
                e.stopPropagation();
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
                if (meta.moved) return;
                const now = Date.now();
                const prev = pipTapMetaRef.current;
                const isDoubleTap =
                  !!prev &&
                  now - prev.at <= PIP_DOUBLE_TAP_MS &&
                  Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < (isMobile ? 36 : 28);
                if (isDoubleTap) {
                  pipTapMetaRef.current = null;
                  swapPipPrimary();
                } else {
                  pipTapMetaRef.current = { at: now, x: e.clientX, y: e.clientY };
                }
              }}
              onPointerCancel={(e) => {
                const meta = pipDragMetaRef.current;
                pipDragMetaRef.current = null;
                if (meta?.pointerId === e.pointerId) {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }
              }}
            >
              {pipPrimary === "local" ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  className="h-full w-full bg-black object-cover"
                />
              ) : (
                <div className="absolute inset-0 overflow-hidden bg-black">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full bg-black object-cover"
                    style={localVideoTransformStyle}
                  />
                </div>
              )}
              {pipPrimary !== "local" && !isMuted ? (
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-indigo-500/50 shadow-[0_0_18px_rgba(99,102,241,0.35)]" />
              ) : null}
              {pipPrimary !== "local" && isMuted ? (
                <div className="absolute bottom-1.5 left-2 rounded bg-black/60 p-0.5 backdrop-blur-md" aria-hidden>
                  <MicOff className="h-2.5 w-2.5 text-red-400" />
                </div>
              ) : null}
              <div className="absolute right-2 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/60 backdrop-blur-sm">
                {pipPrimary === "local" ? (otherDisplayName || "Абонент") : "Вы"}
              </div>
            </div>
          </div>
        )}
        {heartBursts.map((burst, burstIndex) => {
          const baseLeft = burst.from === "local" ? 58 : 42;
          const fanOffsets = [-32, -18, -7, 7, 18, 32];
          const heights = [84, 102, 118, 118, 102, 84];
          return fanOffsets.map((offset, i) => {
            const particleStyle = {
              left: `${baseLeft + (burstIndex - 1.5) * 4}%`,
              bottom: "15%",
              animation: `call-heart-fan ${reducedMotion ? DURATION_NORMAL_MS : DURATION_EMPHASIS_MS}ms ${EASING_OUT_EXPO} forwards`,
              animationDelay: `${i * 28}ms`,
              "--tx": `${offset}px`,
              "--ty": `${-heights[i]}px`,
              "--heart-rot": `${offset * 0.7}deg`,
              "--heart-scale": `${1 + Math.abs(offset) / 140}`,
              "--heart-opacity": "0.75",
            } as CSSProperties;
            return (
              <div
                key={`${burst.id}-${i}`}
                className="absolute pointer-events-none select-none text-[22px] text-pink-300/80 drop-shadow-[0_0_10px_rgba(244,114,182,0.45)]"
                style={particleStyle}
                aria-hidden
              >
                ❤️
              </div>
            );
          });
        })}
        <div
          className="pointer-events-none absolute bottom-36 left-8 z-[15] h-64 w-28 overflow-hidden max-[380px]:bottom-48 max-[380px]:left-4"
          aria-hidden
        >
          {floatEmojis.map((f) => (
            <div
              key={f.id}
              className="absolute text-3xl"
              style={{
                left: `${f.x}%`,
                bottom: 0,
                animation: reducedMotion ? "none" : `call-emoji-float 3200ms ${EASING_OUT} forwards`,
              }}
            >
              {f.emoji}
            </div>
          ))}
        </div>
        {/* Avatar + name + status (for non-video or non-connected states) */}
        {showVideo && pulseStageDecor && showCaptionStrip && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[12] h-[min(42vh,280px)]"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.22) 65%, transparent 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 z-[14] flex max-h-[min(38vh,220px)] flex-col gap-0.5 overflow-hidden px-4 sm:px-6"
              style={{ bottom: isMobile ? "5.25rem" : "6.75rem" }}
            >
              <div className="relative mx-auto w-full max-w-[min(100%,720px)] rounded-xl bg-black/35 px-3 py-2 backdrop-blur-sm sm:px-3.5 sm:py-1.5">
                <div className="flex flex-col gap-1.5" role="status" aria-live="polite" aria-relevant="additions">
                  <AnimatePresence initial={false} mode="popLayout">
                    {captionsForStrip.map((c, i) => {
                      const isLocal = c.from === "local";
                      const speaker = isLocal ? "Вы" : otherDisplayName || "Собеседник";
                      const chipBg = isLocal ? "#5b21b6" : "#312e81";
                      const chipBorder = isLocal ? "#4c1d95" : "#1e1b4b";
                      const isLatest = i === captionsForStrip.length - 1;
                      return (
                        <motion.div
                          key={c.id}
                          layout={!reducedMotion}
                          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                          animate={{
                            opacity: isLatest ? 1 : 0.48,
                            y: 0,
                          }}
                          exit={
                            reducedMotion
                              ? { opacity: 0, transition: { duration: DURATION_NORMAL_S } }
                              : { opacity: 0, y: -8, transition: { duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER } }
                          }
                          transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
                          className="flex items-start gap-1.5 sm:gap-2"
                        >
                          <span
                            className="mt-px shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none text-white sm:text-[11px]"
                            style={{
                              backgroundColor: chipBg,
                              border: `1px solid ${chipBorder}`,
                            }}
                          >
                            {speaker}
                          </span>
                          <p
                            className="min-w-0 flex-1 text-[13px] font-medium leading-tight tracking-wide text-white sm:text-[14px] sm:leading-snug"
                            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.6)" }}
                          >
                            {c.text}
                          </p>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                {(captionsEnabled && supports.captionsRelay && !supports.captionsLocalSTT) ||
                !captionsForStrip.some((c) => c.from === "remote") ? (
                  <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-2 text-center text-[10px] leading-snug">
                    {captionsEnabled && supports.captionsRelay && !supports.captionsLocalSTT && (
                      <p className="text-amber-200/55">
                        Здесь нет встроенного распознавания речи — вашу речь собеседник в титрах не увидит. Его строки приходят с его устройства
                        (нужен браузер с Web Speech API, напр. Chrome или Safari).
                      </p>
                    )}
                    {!captionsForStrip.some((c) => c.from === "remote") && (
                      <p className="text-white/42">
                        Строки собеседника приходят по сети, если у него титры включены и браузер умеет распознавание. Если видите только «Вы»
                        — часто микрофон ловит голос из динамика; наушники обычно помогают.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <UserAvatar
              avatarUrl={otherAvatarUrl}
              displayName={otherDisplayName}
              seed={otherUserId ?? undefined}
              size={96}
              className="w-24 h-24 rounded-full shadow-xl border-2 border-white/20"
            />
            <p className="text-xl font-semibold text-center mt-2">{otherDisplayName}</p>

            {/* State label or timer */}
            {state === "connected" && (
              <p className="text-base text-white/70 tabular-nums">{formatDuration(callDuration)}</p>
            )}
            {state === "reconnecting" && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-amber-400">{label}</p>
                <p className="text-base text-white/70 tabular-nums">{formatDuration(callDuration)}</p>
              </div>
            )}
            {state !== "connected" && state !== "reconnecting" && label && (
              <p className="text-sm text-white/60">{label}</p>
            )}
          </div>
        )}
      </div>

      {/* Градиенты поверх кадра (панель теперь оверлей — низ не «съедает» видео). */}
      {showVideo && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-[8] h-[32%] bg-gradient-to-b to-transparent",
              isMobile ? "from-black/28 via-black/8" : "from-black/45 via-black/12",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[42%] bg-gradient-to-t to-transparent",
              isMobile ? "from-black/45 via-black/14" : "from-black/70 via-black/25",
            )}
          />
        </>
      )}

      {/* Controls — оверлей, видео тянется под низ окна */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-50 px-4 pb-[max(28px,calc(env(safe-area-inset-bottom,0px)+16px))] pt-2">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex w-full max-w-[100vw] flex-col items-center",
            isMobile ? "gap-1.5" : "gap-3",
          )}
        >
        {showActiveControls && localRecordingState !== "idle" && (
          <div className="w-full max-w-[200px] shrink-0 px-0">
            <div
              className="flex items-center gap-2 rounded-full border border-white/18 bg-black/45 px-2 py-1 backdrop-blur-md"
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  localRecordingState === "recording" && "animate-pulse bg-red-500/90",
                  localRecordingState === "paused" && "bg-amber-400/90",
                  (localRecordingState === "stopping" || localRecordingState === "error") && "bg-white/40",
                )}
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-1.5 text-[10px] leading-none text-white/88">
                  <span className="truncate">
                    {localRecordingState === "paused"
                      ? "Пауза"
                      : localRecordingState === "stopping"
                        ? "Сохранение…"
                        : localRecordingState === "error"
                          ? "Ошибка записи"
                          : "Запись звонка"}
                  </span>
                  <span className="shrink-0 tabular-nums text-white/70">{formatDuration(recordSecs)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400/70 via-fuchsia-400/65 to-violet-400/70 transition-[width]"
                    style={{
                      width: `${recordingProgressPercent}%`,
                      transitionDuration: `${DURATION_NORMAL_MS}ms`,
                      transitionTimingFunction: EASING_OUT,
                    }}
                  />
                </div>
              </div>
              {(localRecordingState === "recording" || localRecordingState === "paused") && (
                <TapScaleButton
                  type="button"
                  onClick={() => { void onToggleRecordingPause(); }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/12 text-white/90 transition-colors hover:bg-white/20"
                  aria-label={localRecordingState === "paused" ? "Продолжить запись" : "Пауза записи"}
                  haptic
                >
                  {localRecordingState === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                </TapScaleButton>
              )}
            </div>
          </div>
        )}
        {state === "connected" && remoteNeedsTapToPlay && (
          <TapScaleButton
            type="button"
            onClick={async () => {
              const el = remoteVideoRef.current;
              if (!el) return;
              try { await el.play(); setRemoteNeedsTapToPlay(false); } catch { setRemoteNeedsTapToPlay(true); }
            }}
            className="px-4 py-2 rounded-xl bg-primary/90 text-primary-foreground text-sm font-medium"
            aria-label="Включить звук собеседника"
          >
            Включить звук
          </TapScaleButton>
        )}

        <div className={cn("flex flex-col items-center", isMobile ? "gap-1" : "gap-4")}>
          {showIncomingAnswerUi && (
            <div className="flex flex-col items-center gap-2">
              {state === "reconnecting" && (
                <p className="max-w-[min(100%,20rem)] text-center text-[12px] leading-snug text-white/60">
                  Связь восстанавливается — можете ответить или отклонить.
                </p>
              )}
              <div className="flex items-end justify-center gap-7 sm:gap-9">
                <TapScaleButton
                  type="button"
                  onClick={onReject}
                  className="min-h-[var(--uix-touch-min)] rounded-full bg-red-600 p-4 transition-colors hover:bg-red-500"
                  aria-label="Отклонить"
                  haptic
                >
                  <PhoneOff className="h-8 w-8" />
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={onAccept}
                  className="min-h-[var(--uix-touch-min)] rounded-full bg-green-600 p-4 transition-colors hover:bg-green-500"
                  aria-label="Принять"
                  haptic
                >
                  <Phone className="h-8 w-8" />
                </TapScaleButton>
              </div>
            </div>
          )}

          {hasCallUtilities && (
            <>
              <div
                className={cn(
                  "w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  pulseDrawerOpen
                    ? cn("max-h-80 opacity-100", isMobile ? "mb-1" : "mb-3")
                    : "mb-0 max-h-0 opacity-0",
                )}
              >
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.06] px-5 pb-5 pt-4 shadow-[0_-8px_48px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
                  <div className="mb-5 flex justify-center">
                    <div className="h-[3px] w-10 rounded-full bg-white/15" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {pulseSecondaryRows.map(({ icon: Icon, label: secLabel }) => {
                      const dis = secondaryDisabled(secLabel);
                      const isActive = secondaryVisualActive(secLabel);
                      const accent = secLabel === "Запись";
                      const captionsRow = secLabel === "Титры";
                      return (
                        <button
                          key={secLabel}
                          type="button"
                          disabled={dis}
                          onClick={() => onPulseSecondaryClick(secLabel)}
                          className={cn(
                            "group flex h-11 w-full items-center gap-2.5 rounded-2xl px-3.5 transition-all duration-200 active:scale-[0.96]",
                            dis && "pointer-events-none opacity-40",
                            isActive
                              ? captionsRow
                                ? "border border-amber-400/35 bg-amber-500/15 shadow-[0_0_14px_rgba(245,158,11,0.18)]"
                                : "border border-indigo-400/30 bg-indigo-500/22 shadow-[0_0_14px_rgba(99,102,241,0.18)]"
                              : "border border-white/[0.06] bg-white/[0.05] hover:border-white/[0.11] hover:bg-white/[0.09]",
                          )}
                          aria-label={secLabel}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              isActive
                                ? captionsRow
                                  ? "text-amber-300"
                                  : "text-indigo-300"
                                : accent
                                  ? "text-rose-300/80"
                                  : "text-white/50 group-hover:text-white/75",
                            )}
                          />
                          <span
                            className={cn(
                              "truncate text-[12px] font-medium transition-colors",
                              isActive
                                ? captionsRow
                                  ? "text-amber-200"
                                  : "text-indigo-200"
                                : "text-white/55 group-hover:text-white/80",
                            )}
                          >
                            {secLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPulseDrawerOpen((v) => !v)}
                className={cn(
                  "group/handle flex h-7 w-10 items-center justify-center rounded-full transition-all duration-500",
                  isMobile ? "mb-[5px]" : "mb-5",
                )}
                style={{
                  ...pulseDrawerHandleIdleStyle,
                  ...(isMobile
                    ? {
                        background: pulseDrawerOpen ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }
                    : pulseDrawerOpen
                      ? { background: "rgba(255,255,255,0.08)" }
                      : {}),
                }}
                aria-expanded={pulseDrawerOpen}
                aria-label={pulseDrawerOpen ? "Свернуть панель" : "Дополнительные действия"}
              >
                <ChevronUp
                  className={cn(
                    "h-3 w-3 transition-all duration-500",
                    pulseDrawerOpen
                      ? "rotate-180 text-white/80"
                      : isMobile
                        ? "text-white/75 group-hover/handle:text-white/90"
                        : "text-white/22 group-hover/handle:text-white/50",
                  )}
                />
              </button>
            </>
          )}

          {showActiveControls && (
              <div
                className="flex items-center rounded-full px-1.5 py-1.5"
                style={isMobile ? pulseGhostPillStyleMobile : pulseGhostPillStyle}
              >
                <TapScaleButton
                  type="button"
                  onClick={() => onSetMuted(!isMuted)}
                  className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
                  aria-label={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                >
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full transition-all duration-300",
                      isMuted
                        ? "bg-red-500/10 group-hover/b:bg-red-500/[0.17]"
                        : isMobile
                          ? "bg-white/[0.06] group-hover/b:bg-white/[0.12]"
                          : "bg-transparent group-hover/b:bg-white/[0.07]",
                    )}
                  />
                  {isMuted ? (
                    <MicOff className="relative z-10 h-[19px] w-[19px] text-red-400" />
                  ) : (
                    <Mic
                      className={cn(
                        "relative z-10 h-[19px] w-[19px] transition-colors",
                        isMobile ? "text-white/92 group-hover/b:text-white" : "text-white/55 group-hover/b:text-white/90",
                      )}
                    />
                  )}
                  {isMuted ? (
                    <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseMediaOffGlowStyle} />
                  ) : null}
                </TapScaleButton>
                <div className="h-4 w-px shrink-0" style={pulseToolbarDividerStyle} aria-hidden />
                {isVideo ? (
                  <TapScaleButton
                    type="button"
                    onClick={onToggleCameraEnabled}
                    className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
                    aria-label={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full transition-all duration-300",
                        isCameraEnabled
                          ? isMobile
                            ? "bg-white/[0.06] group-hover/b:bg-white/[0.12]"
                            : "bg-transparent group-hover/b:bg-white/[0.07]"
                          : "bg-red-500/10 group-hover/b:bg-red-500/[0.17]",
                      )}
                    />
                    {isCameraEnabled ? (
                      <Video
                        className={cn(
                          "relative z-10 h-[19px] w-[19px] transition-colors",
                          isMobile ? "text-white/92 group-hover/b:text-white" : "text-white/55 group-hover/b:text-white/90",
                        )}
                      />
                    ) : (
                      <VideoOff className="relative z-10 h-[19px] w-[19px] text-red-400" />
                    )}
                    {!isCameraEnabled ? (
                      <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseMediaOffGlowStyle} />
                    ) : null}
                  </TapScaleButton>
                ) : (
                  <div
                    className="relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full opacity-45"
                    aria-hidden
                  >
                    <div className="absolute inset-0 rounded-full bg-white/[0.04]" />
                    <VideoOff className="relative z-10 h-[19px] w-[19px] text-white/35" />
                  </div>
                )}
                <div className="h-4 w-px shrink-0" style={pulseToolbarDividerStyle} aria-hidden />
                {isMobile ? (
                  <TapScaleButton
                    type="button"
                    onClick={() => setCallChatOpen((v) => !v)}
                    className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
                    aria-label={callChatOpen ? "Закрыть чат" : "Чат во время звонка"}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full transition-all duration-300",
                        callChatOpen
                          ? "bg-indigo-500/18 group-hover/b:bg-indigo-500/[0.26]"
                          : isMobile
                            ? "bg-white/[0.06] group-hover/b:bg-white/[0.12]"
                            : "bg-transparent group-hover/b:bg-white/[0.07]",
                      )}
                    />
                    <MessageSquare
                      className={cn(
                        "relative z-10 h-[19px] w-[19px] transition-colors",
                        callChatOpen
                          ? "text-indigo-300"
                          : isMobile
                            ? "text-white/92 group-hover/b:text-white"
                            : "text-white/55 group-hover/b:text-white/90",
                      )}
                    />
                    {remoteChatUnread && !callChatOpen && linkedChat ? (
                      <span
                        className="absolute right-2 top-2 z-20 h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.7)]"
                        aria-hidden
                      />
                    ) : null}
                  </TapScaleButton>
                ) : (
                  <TapScaleButton
                    type="button"
                    onClick={() => onToggleCaptions()}
                    className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
                    aria-label={captionsEnabled ? "Выключить титры" : "Включить титры"}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 rounded-full transition-all duration-300",
                        captionsEnabled
                          ? "bg-amber-500/18 group-hover/b:bg-amber-500/[0.26]"
                          : "bg-transparent group-hover/b:bg-white/[0.07]",
                      )}
                    />
                    {captionsEnabled ? (
                      <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseCaptionsActiveGlowStyle} />
                    ) : null}
                    <Subtitles
                      className={cn(
                        "relative z-10 h-[19px] w-[19px] transition-colors",
                        captionsEnabled ? "text-amber-300" : "text-white/55 group-hover/b:text-white/90",
                      )}
                    />
                  </TapScaleButton>
                )}
                <div className="h-4 w-px shrink-0" style={pulseToolbarDividerStyle} aria-hidden />
                <TapScaleButton
                  type="button"
                  onClick={onEndCall}
                  className="group/end relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300 active:scale-90"
                  aria-label="Завершить"
                  haptic
                >
                  <div className="absolute inset-0 rounded-full" style={pulseEndOrbFillStyle} />
                  <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full" style={pulseEndOrbHighlightStyle} />
                  <div className="pointer-events-none absolute inset-0 rounded-full opacity-90 transition-opacity group-hover/end:opacity-100" style={pulseEndOrbOuterGlowStyle} />
                  <PhoneOff className="relative z-10 h-[19px] w-[19px] text-white" strokeWidth={2} />
                </TapScaleButton>
              </div>
          )}

          {state === "failed" && (
            <div className="flex items-end justify-center gap-7 sm:gap-9">
              <TapScaleButton
                type="button"
                onClick={onRetry}
                className="min-h-[var(--uix-touch-min)] rounded-full bg-green-600 p-4 transition-colors hover:bg-green-500"
                aria-label="Позвонить снова"
                haptic
              >
                <RefreshCw className="h-8 w-8" />
              </TapScaleButton>
              <TapScaleButton
                type="button"
                onClick={onEndCall}
                className="min-h-[var(--uix-touch-min)] rounded-full bg-red-600 p-4 transition-colors hover:bg-red-500"
                aria-label="Закрыть"
                haptic
              >
                <PhoneOff className="h-8 w-8" />
              </TapScaleButton>
            </div>
          )}

          {isTerminal && state !== "failed" && (
            <TapScaleButton
              type="button"
              onClick={onEndCall}
              className="min-h-[var(--uix-touch-min)] rounded-full border border-white/20 bg-white/20 p-4 backdrop-blur-xl transition-colors hover:bg-white/30"
              aria-label="Закрыть звонок"
              haptic
            >
              <PhoneOff className="h-8 w-8" />
            </TapScaleButton>
          )}
        </div>
        </div>
      </div>
      </div>
      </div>

      <AnimatePresence>
        {callChatOpen && showActiveControls && !isTerminal && isMobile ? (
          <>
            <motion.button
              key="call-chat-backdrop"
              type="button"
              aria-label="Закрыть чат"
              className="fixed inset-0 z-[205] cursor-default bg-black/50"
              initial={{ opacity: reducedMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: reducedMotion ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : DURATION_FAST_MS / 1000, ease: EASING_OUT_BEZIER }}
              onClick={() => setCallChatOpen(false)}
            />
            <motion.aside
              key="call-chat-bottom-sheet"
              role="dialog"
              aria-modal
              aria-label="Чат во время звонка"
              className="fixed inset-x-0 bottom-0 z-[210] flex h-[30vh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/[0.08] bg-[#0e0e18] shadow-[0_-16px_48px_rgba(0,0,0,0.55)] select-text"
              initial={reducedMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: reducedMotion ? 0 : DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }}
            >
              {callChatNavHeader(true)}
              {renderCallChatBody()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {callChatOpen && showActiveControls && !isTerminal && !isMobile ? (
        <aside
          className="flex h-full w-[min(100vw,18rem)] shrink-0 select-text flex-col border-l border-white/[0.05] bg-[#0e0e18] sm:w-72"
          aria-label="Чат во время звонка"
        >
          {callChatNavHeader(false)}
          {renderCallChatBody()}
        </aside>
      ) : null}
    </div>
  );
}
