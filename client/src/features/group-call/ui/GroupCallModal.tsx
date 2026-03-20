import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronUp,
  Circle,
  Heart,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  PictureInPicture2,
  Pin,
  RefreshCcw,
  Sparkles,
  Subtitles,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCallFeatureFlags } from "@/features/call/call-feature-flags";
import { getCallFeatureSupport } from "@/features/call/call-capabilities";
import {
  PULSE_CALL_BACKDROP_CLASS,
  pulseChatActiveGlowStyle,
  pulseDrawerHandleIdleStyle,
  pulseEndOrbFillStyle,
  pulseEndOrbHighlightStyle,
  pulseEndOrbOuterGlowStyle,
  pulseGhostPillStyle,
  pulseMediaOffGlowStyle,
  pulseToolbarDividerStyle,
} from "@/features/call/ui/pulse-call-spec";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { GroupCallMedia } from "@/lib/group-calls-api";
import { useGroupCallSession } from "../session/useGroupCallSession";
import { GroupParticipantTile } from "./GroupParticipantTile";
import { AddCallSegmentsToTrackModal } from "@/features/board/call-history/AddCallSegmentsToTrackModal";
import { GroupCommandPrompt } from "./GroupCommandPrompt";
import { LiveTranscriptSheet } from "./LiveTranscriptSheet";
import { groupCallAccentForUser } from "./group-call-palette";

type Props = {
  chatTitle: string;
  roomId: string;
  mediaType: GroupCallMedia;
  myUserId: string;
  myDisplayName: string;
  open: boolean;
  onClose: () => void;
};

/** Как в `group-call-spec/GroupCall.tsx` — 9 кнопок, сетка 3×3. */
const SECONDARY_BUTTONS = [
  { icon: RefreshCcw, label: "Поворот" },
  { icon: PictureInPicture2, label: "PiP" },
  { icon: ArrowUpDown, label: "Порядок" },
  { icon: MonitorUp, label: "Экран" },
  { icon: Circle, label: "Запись" },
  { icon: Heart, label: "Сердце" },
  { icon: Sparkles, label: "Beauty" },
  { icon: Subtitles, label: "Титры" },
  { icon: UserPlus, label: "Участник" },
] as const;

function formatCallClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ViewMode = "spotlight" | "grid";

export function GroupCallModal({ chatTitle, roomId, mediaType, myUserId, myDisplayName, open, onClose }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [segmentsForSave, setSegmentsForSave] = useState<Array<{ id: string }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("spotlight");
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSecondary, setActiveSecondary] = useState<string | null>(null);
  const [cosmeticChatOpen, setCosmeticChatOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const supports = useMemo(() => getCallFeatureSupport(getCallFeatureFlags()), []);
  const session = useGroupCallSession({
    roomId,
    mediaType,
    myUserId,
    myDisplayName,
    open,
    onEnded: onClose,
  });

  useEffect(() => {
    setElapsedSec(0);
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setElapsedSec((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    session.participants.forEach((p) => m.set(p.userId, p.displayName));
    return m;
  }, [session.participants]);

  const displayCenter = pinnedUserId ?? session.centerUserId;
  const stripIds = useMemo(() => {
    const ids = session.participants.map((p) => p.userId).filter((id) => id !== displayCenter);
    return ids.sort();
  }, [session.participants, displayCenter]);

  const gridUserIds = useMemo(() => {
    return [...session.participants.map((p) => p.userId)].sort();
  }, [session.participants]);

  const sortedAllIds = useMemo(
    () => [...session.participants.map((p) => p.userId)].sort(),
    [session.participants],
  );

  const sortedPeerIds = useMemo(
    () => sortedAllIds.filter((id) => id !== myUserId),
    [sortedAllIds, myUserId],
  );

  /** UIX-GUIDELINES §5 — grid-cols-3, минимум 2 ряда; пустые ячейки внизу как в макете (5+1). */
  const gridRowCount = useMemo(() => {
    const n = gridUserIds.length;
    if (n === 0) return 2;
    return Math.max(2, Math.ceil(n / 3));
  }, [gridUserIds.length]);

  const gridSlots = useMemo(() => {
    const ids: (string | null)[] = [...gridUserIds];
    const total = gridRowCount * 3;
    while (ids.length < total) ids.push(null);
    return ids;
  }, [gridUserIds, gridRowCount]);

  const suggestedSegments = useMemo(() => {
    const ids = new Set(
      session.pendingSuggestions.flatMap((item) => {
        try {
          const payload = JSON.parse(item.payloadJson) as { segmentIds?: string[] };
          return payload.segmentIds ?? [];
        } catch {
          return item.segmentId ? [item.segmentId] : [];
        }
      }),
    );
    return session.transcriptSegments.filter((segment) => ids.has(segment.id));
  }, [session.pendingSuggestions, session.transcriptSegments]);

  const activeSuggestion = session.pendingSuggestions[0] ?? null;
  const isVideoCall = session.isVideo;

  /** Даунмикс −25% у всех, кроме текущего VAD-лидера; звук у всех остаётся слышимым. */
  const playbackVolumeForUid = (uid: string) => {
    if (uid === myUserId) return 1;
    const duck = session.activeSpeakerId;
    if (!duck || session.participants.length < 2) return 1;
    return uid === duck ? 1 : 0.75;
  };

  const secondaryVisualActive = (label: string) => {
    if (label === "Экран") return session.isScreenSharing;
    if (label === "Титры") return session.captionsEnabled;
    return activeSecondary === label;
  };

  const onSecondaryClick = (label: string) => {
    if (label === "Экран" && supports.screenShare && isVideoCall && session.phase === "active") {
      void session.toggleScreenShare();
      return;
    }
    if (label === "Титры" && session.canToggleTranscripts && session.phase === "active") {
      session.toggleCaptions();
      return;
    }
    setActiveSecondary((prev) => (prev === label ? null : label));
  };

  const renderTile = (uid: string, opts: { size: "lg" | "sm"; className?: string }) => {
    const stream = uid === myUserId ? session.localStream : session.getRemoteStream(uid);
    const nm = nameById.get(uid) ?? (uid === myUserId ? myDisplayName : "Участник");
    const accent = groupCallAccentForUser(uid, myUserId, sortedPeerIds);
    const showPoorConnection = sortedAllIds.indexOf(uid) === 2;
    return (
      <GroupParticipantTile
        userId={uid}
        displayName={nm}
        stream={stream}
        streamRenderKey={uid === myUserId ? session.localStreamRenderKey : 0}
        video={isVideoCall}
        isSpeaking={session.activeSpeakerId === uid}
        mutePlayback={uid === myUserId}
        playbackVolume={playbackVolumeForUid(uid)}
        isLocalTile={uid === myUserId}
        accent={accent}
        showPoorConnection={showPoorConnection}
        size={opts.size}
        className={opts.className}
      />
    );
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[500] flex h-full w-full select-none flex-col overflow-hidden text-white",
        PULSE_CALL_BACKDROP_CLASS,
      )}
      role="dialog"
      aria-modal
      aria-label={`Групповой звонок: ${chatTitle}`}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
      {/* LOGO — UIX §4 + бренд PING MOOT (иконка вместо «P» в квадрате) */}
      <div className="absolute left-[max(1.25rem,env(safe-area-inset-left,0px))] top-[max(1.25rem,env(safe-area-inset-top,0px))] z-20 flex cursor-default items-center gap-1.5 opacity-30 transition-opacity duration-300 hover:opacity-55">
        <img
          src="/F-PING.png?v=5"
          alt=""
          className="h-6 w-6 shrink-0 object-contain select-none"
          width={24}
          height={24}
          decoding="async"
        />
        <span className="text-[13px] font-semibold tracking-tight text-white">PING MOOT</span>
      </div>

      {/* TOP BAR — group-call-spec / GroupCall.tsx */}
      <div className="absolute left-1/2 top-[max(1.25rem,env(safe-area-inset-top,0px))] z-20 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.06] px-5 py-2 shadow-xl backdrop-blur-xl">
        <span className="truncate text-[13px] font-semibold text-white/90">{chatTitle}</span>
        <div className="h-5 w-px bg-white/10" />
        <Badge className="border-emerald-500/30 bg-emerald-500/20 px-2 text-[9px] font-bold uppercase tracking-widest text-emerald-300">
          {session.participants.length} чел.
        </Badge>
        <div className="h-5 w-px bg-white/10" />
        <span className="font-mono text-[11px] tabular-nums text-white/45">{formatCallClock(elapsedSec)}</span>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("spotlight")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] transition-all duration-200",
              viewMode === "spotlight" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70",
            )}
            aria-label="Режим докладчика"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] transition-all duration-200",
              viewMode === "grid" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70",
            )}
            aria-label="Сетка"
          >
            <LayoutGrid className="h-3 w-3" />
          </button>
        </div>
      </div>

      {session.error && (
        <div className="relative z-10 mx-4 mb-2 mt-16 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-center text-sm">
          {session.error}
        </div>
      )}

      <GroupCommandPrompt
        suggestion={activeSuggestion}
        previewSegments={suggestedSegments}
        onAccept={async () => {
          if (!activeSuggestion) return;
          const payloadSegments =
            suggestedSegments.length > 0
              ? suggestedSegments.map((segment) => ({ id: segment.id }))
              : activeSuggestion.segmentId
                ? [{ id: activeSuggestion.segmentId }]
                : [];
          setSegmentsForSave(payloadSegments);
          await session.resolveSuggestion(activeSuggestion.callId, activeSuggestion.id, "accepted");
          setSaveOpen(true);
        }}
        onDismiss={() => activeSuggestion && session.resolveSuggestion(activeSuggestion.callId, activeSuggestion.id, "dismissed")}
      />

      {/* VIDEO AREA — UIX §7: p-4 pt-20 pb-4 */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 pb-4 pt-20">
        {viewMode === "spotlight" ? (
          <div className="flex h-full min-h-0 w-full flex-col gap-3 md:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:min-h-[200px]">
              {renderTile(displayCenter, { size: "lg", className: "min-h-0 flex-1" })}
            </div>
            <div className="flex w-full shrink-0 flex-row gap-2 overflow-x-auto overflow-y-hidden md:w-44 md:flex-col md:gap-2.5 md:overflow-y-auto md:overflow-x-hidden">
              {stripIds.map((uid) => (
                <button
                  key={uid}
                  type="button"
                  onClick={() => setPinnedUserId(uid)}
                  className="group relative w-[104px] shrink-0 md:w-full"
                >
                  {renderTile(uid, { size: "sm", className: "w-full" })}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                    <Pin className="h-4 w-4 text-white" aria-hidden />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="grid h-full min-h-0 grid-cols-3 gap-3"
            style={{ gridTemplateRows: `repeat(${gridRowCount}, minmax(0, 1fr))` }}
          >
            {gridSlots.map((uid, idx) =>
              uid ? (
                <div key={uid} className="min-h-0">
                  {renderTile(uid, { size: "sm", className: "h-full min-h-[120px] w-full" })}
                </div>
              ) : (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[120px] rounded-2xl border border-white/[0.04] bg-white/[0.02] opacity-30"
                  aria-hidden
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Низ экрана — как в макете: pb-7, drawer w-[420px] */}
      <div className="relative z-30 flex shrink-0 flex-col items-center pb-[max(1.75rem,env(safe-area-inset-bottom,0px))]">
        <div
          className={cn(
            "w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            isDrawerOpen ? "mb-3 max-h-80 opacity-100" : "mb-0 max-h-0 opacity-0",
          )}
        >
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.06] px-5 pb-5 pt-4 shadow-[0_-8px_48px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="mb-5 flex justify-center">
              <div className="h-[3px] w-10 rounded-full bg-white/15" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SECONDARY_BUTTONS.map(({ icon: Icon, label }) => {
                const isActive = secondaryVisualActive(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onSecondaryClick(label)}
                    className={cn(
                      "group flex h-11 w-full items-center gap-2.5 rounded-2xl px-3.5 transition-all duration-200 active:scale-[0.96]",
                      isActive
                        ? "border border-indigo-400/30 bg-indigo-500/22 shadow-[0_0_14px_rgba(99,102,241,0.18)]"
                        : "border border-white/[0.06] bg-white/[0.05] hover:border-white/[0.11] hover:bg-white/[0.09]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-indigo-300" : "text-white/50 group-hover:text-white/75",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-[12px] font-medium transition-colors",
                        isActive ? "text-indigo-200" : "text-white/55 group-hover:text-white/80",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDrawerOpen((v) => !v)}
          className="group/handle mb-5 flex h-7 w-10 items-center justify-center rounded-full transition-all duration-500"
          style={{
            ...pulseDrawerHandleIdleStyle,
            ...(isDrawerOpen ? { background: "rgba(255,255,255,0.08)" } : {}),
          }}
          aria-expanded={isDrawerOpen}
          aria-label={isDrawerOpen ? "Свернуть панель" : "Дополнительные действия"}
        >
          <ChevronUp
            className={cn(
              "h-3 w-3 transition-all duration-500",
              isDrawerOpen ? "rotate-180 text-white/55" : "text-white/22 group-hover/handle:text-white/50",
            )}
          />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full px-1.5 py-1.5" style={pulseGhostPillStyle}>
            <TapScaleButton
              type="button"
              aria-label={session.isMuted ? "Включить микрофон" : "Выключить микрофон"}
              onClick={() => session.setMuted(!session.isMuted)}
              className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  session.isMuted
                    ? "bg-red-500/10 group-hover/b:bg-red-500/[0.17]"
                    : "bg-transparent group-hover/b:bg-white/[0.07]",
                )}
              />
              {session.isMuted ? (
                <MicOff className="relative z-10 h-[19px] w-[19px] text-red-400" />
              ) : (
                <Mic className="relative z-10 h-[19px] w-[19px] text-white/55 transition-colors group-hover/b:text-white/90" />
              )}
              {session.isMuted ? (
                <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseMediaOffGlowStyle} />
              ) : null}
            </TapScaleButton>

            <div className="h-4 w-px shrink-0" style={pulseToolbarDividerStyle} aria-hidden />

            <TapScaleButton
              type="button"
              aria-label={
                session.isScreenSharing
                  ? "Идёт демонстрация экрана"
                  : session.isCameraOff
                    ? "Включить камеру"
                    : "Выключить камеру"
              }
              disabled={!isVideoCall || session.phase !== "active" || session.isScreenSharing}
              onClick={() => session.setCameraOff(!session.isCameraOff)}
              className={cn(
                "group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90",
                (!isVideoCall || session.phase !== "active") && "pointer-events-none opacity-45",
                session.isScreenSharing && "pointer-events-none opacity-90",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  isVideoCall && session.phase === "active" && !session.isScreenSharing && session.isCameraOff
                    ? "bg-red-500/10 group-hover/b:bg-red-500/[0.17]"
                    : isVideoCall && session.phase === "active"
                      ? "bg-transparent group-hover/b:bg-white/[0.07]"
                      : "bg-white/[0.04]",
                )}
              />
              {isVideoCall && session.phase === "active" && !session.isScreenSharing && session.isCameraOff ? (
                <>
                  <VideoOff className="relative z-10 h-[19px] w-[19px] text-red-400" />
                  <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseMediaOffGlowStyle} />
                </>
              ) : isVideoCall ? (
                <Video className="relative z-10 h-[19px] w-[19px] text-white/55 transition-colors group-hover/b:text-white/90" />
              ) : (
                <VideoOff className="relative z-10 h-[19px] w-[19px] text-white/35" />
              )}
            </TapScaleButton>

            <div className="h-4 w-px shrink-0" style={pulseToolbarDividerStyle} aria-hidden />

            <TapScaleButton
              type="button"
              aria-label={cosmeticChatOpen ? "Свернуть" : "Сообщения"}
              onClick={() => setCosmeticChatOpen((v) => !v)}
              className="group/b relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-90"
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-full transition-all duration-300",
                  cosmeticChatOpen
                    ? "bg-indigo-500/20 group-hover/b:bg-indigo-500/[0.28]"
                    : "bg-transparent group-hover/b:bg-white/[0.07]",
                )}
              />
              {cosmeticChatOpen ? (
                <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseChatActiveGlowStyle} />
              ) : null}
              <div className="relative z-10">
                <MessageSquare
                  className={cn(
                    "h-[19px] w-[19px] transition-colors",
                    cosmeticChatOpen ? "text-indigo-300" : "text-white/55 group-hover/b:text-white/90",
                  )}
                />
                {!cosmeticChatOpen ? (
                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
                ) : null}
              </div>
            </TapScaleButton>
          </div>

          <TapScaleButton
            type="button"
            aria-label="Завершить для всех у себя"
            onClick={session.hangup}
            className="relative flex h-14 w-14 min-h-[var(--uix-touch-min)] shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-300 active:scale-90"
            haptic
          >
            <div className="absolute inset-0 rounded-full" style={pulseEndOrbFillStyle} />
            <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full" style={pulseEndOrbHighlightStyle} />
            <div className="pointer-events-none absolute inset-0 rounded-full" style={pulseEndOrbOuterGlowStyle} />
            <PhoneOff className="relative z-10 h-[19px] w-[19px] text-white" strokeWidth={2} />
          </TapScaleButton>
        </div>
      </div>

      <LiveTranscriptSheet segments={session.transcriptSegments} enabled={session.captionsEnabled} />

      </div>

      <AddCallSegmentsToTrackModal
        isOpen={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setSegmentsForSave([]);
        }}
        segments={segmentsForSave}
      />
    </div>
  );
}
