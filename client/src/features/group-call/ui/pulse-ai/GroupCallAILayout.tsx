/**
 * PULSE AI групповой звонок — адаптация `pulse-ai-call-template/VideoCallAI.tsx`
 * под PING MOOT: реальные WebRTC-потоки, сессия, логотип бренда.
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Brain,
  Captions,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Grid,
  Hand,
  Heart,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  MonitorUp,
  Moon,
  MoreHorizontal,
  PhoneOff,
  PictureInPicture2,
  RefreshCcw,
  Sparkles,
  Subtitles,
  Sun,
  UserPlus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/lib/motion";
import { playGroupHandRaiseSound } from "@/lib/micro-feedback";
import { darkTh, lightTh, ThCtx, type Th } from "./group-call-ai-theme"

type Mood = "speaking" | "engaged" | "calm" | "distracted"
type ViewMode = "grid" | "spotlight" | "screenshare"

const MOOD_LABEL: Record<Mood, { label: string; color: string }> = {
  speaking: { label: "Говорит", color: "#818cf8" },
  engaged: { label: "Вовлечён", color: "#34d399" },
  calm: { label: "Слушает", color: "#60a5fa" },
  distracted: { label: "Отвлечён", color: "#f87171" },
}

const ACTIONS = [
  { owner: "МО", text: "Подготовить макеты к пятнице" },
  { owner: "АП", text: "Написать PRD до конца недели" },
  { owner: "ДК", text: "Ревью API контрактов" },
]

const REACTION_CHOICES = [
  ["👍", "Лайк"],
  ["❤️", "Сердце"],
  ["😂", "Смех"],
  ["🎉", "Праздник"],
  ["👏", "Аплодисменты"],
  ["🔥", "Огонь"],
  ["✨", "Звёзды"],
  ["🙏", "Спасибо"],
] as const

/** Как в макете PARTICIPANTS — talk % и engagement % для до 4 участников (не self) */
const TALK_PRESET = [38, 24, 19, 12] as const
const ENGAGEMENT_PRESET = [91, 78, 65, 44] as const
const GROUP_ENGAGEMENT_MOCK_PCT = 76
const REMOTE_MOOD_BY_INDEX: Mood[] = ["engaged", "calm", "distracted", "engaged"]

function sortParticipantsForGrid(
  list: Array<{ userId: string; displayName: string }>,
  hostUserId: string | null,
): Array<{ userId: string; displayName: string }> {
  return [...list].sort((a, b) => {
    if (hostUserId) {
      const ah = a.userId === hostUserId ? 0 : 1
      const bh = b.userId === hostUserId ? 0 : 1
      if (ah !== bh) return ah - bh
    }
    return a.userId.localeCompare(b.userId)
  })
}

function participantCountLabelRu(n: number): string {
  if (n === 0) return "нет участников"
  if (n === 1) return "1 участник"
  const m10 = n % 10
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 14) return `${n} участников`
  if (m10 === 1) return `${n} участник`
  if (m10 >= 2 && m10 <= 4) return `${n} участника`
  return `${n} участников`
}

function initialsFrom(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 2) return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase()
  return (p[0] ?? name).slice(0, 2).toUpperCase() || "?"
}

export type GroupCallAILayoutSession = {
  phase: string
  error: string | null
  participants: Array<{ userId: string; displayName: string }>
  /** Кто создал комнату — первая плитка в сетке. */
  hostUserId: string | null
  centerUserId: string
  activeSpeakerId: string | null
  isVideo: boolean
  isMuted: boolean
  setMuted: (m: boolean) => void
  isCameraOff: boolean
  setCameraOff: (off: boolean) => void
  getRemoteStream: (userId: string) => MediaStream | null
  localStream: MediaStream | null
  localStreamRenderKey: number
  transcriptSegments: Array<{
    id: string
    speakerUserId: string
    speakerDisplayName: string
    textNormalized: string
    createdAt: string
  }>
  captionsEnabled: boolean
  toggleCaptions: () => void
  canToggleTranscripts: boolean
  isScreenSharing: boolean
  toggleScreenShare: () => Promise<void>
  hangup: () => void
  handRaisedUserIds: string[]
  setHandRaised: (raised: boolean) => void
  sendGroupReaction: (emoji: string, label: string) => void
}

type LayoutP = {
  userId: string
  name: string
  init: string
  mood: Mood
  talk: number
  engagement: number
  color: string
  mic: boolean
  video: boolean
  isSelf: boolean
  stream: MediaStream | null
  streamRenderKey: number
}

/** Локальное превью — как зеркало; демонстрация экрана не зеркалим (текст читабелен). */
function isDisplayCaptureVideoTrack(t: MediaStreamTrack): boolean {
  if (t.kind !== "video") return false
  try {
    const s = t.getSettings() as { displaySurface?: string }
    if (s.displaySurface) return true
  } catch {
    /* ignore */
  }
  const l = (t.label ?? "").toLowerCase()
  return l.includes("screen") || l.includes("display") || l.includes("monitor") || l.includes("window")
}

/** Пока roster пуст (например сразу после реконнекта WS), не даём Tile получить p=undefined. */
function buildFallbackSelfLayoutP(args: {
  myUserId: string
  myDisplayName: string
  session: GroupCallAILayoutSession
}): LayoutP {
  const { myUserId, myDisplayName, session } = args
  const name = (myDisplayName || "Вы").trim() || "Вы"
  const stream = session.localStream
  const vt = stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled)
  const videoShowing = Boolean(session.isVideo && vt && !session.isCameraOff)
  return {
    userId: myUserId,
    name,
    init: initialsFrom(name),
    mood: "calm",
    talk: 7,
    engagement: 72,
    color: "#a78bfa",
    mic: !session.isMuted,
    video: videoShowing,
    isSelf: true,
    stream,
    streamRenderKey: session.localStreamRenderKey,
  }
}

function SpeakingBars({ color, active }: { color: string; active: boolean }) {
  const th = useContext(ThCtx)
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 12 }}>
      {[0.5, 1, 0.7, 1.2, 0.6].map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            borderRadius: 2,
            background: active ? color : th.isDark ? "rgba(255,255,255,0.18)" : "rgba(30,30,70,0.2)",
            height: `${h * (active ? 10 : 3)}px`,
            animation: active ? `barPop 0.85s ease-in-out ${i * 0.11}s infinite alternate` : "none",
            transition: "height 0.3s, background 0.3s",
          }}
        />
      ))}
    </div>
  )
}

function CaptionsOverlayAI({
  lines,
  listening,
}: {
  lines: Array<{ name: string; color: string; text: string; isActive: boolean }>
  /** Субтитры включены, но строк ещё нет — показываем, что режим активен. */
  listening?: boolean
}) {
  const th = useContext(ThCtx)
  const visible = lines.length
  if (visible === 0 && !listening) return null

  return (
    <div
      className="absolute left-1/2 z-40 flex -translate-x-1/2 flex-col gap-0.5"
      style={{
        bottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 680,
        width: "calc(100% - 200px)",
      }}
    >
      <div
        className="mb-1 flex items-center gap-1.5 self-center rounded-full px-2.5 py-1"
        style={{
          background: th.captionBadgeBg,
          backdropFilter: "blur(10px)",
          border: `1px solid ${th.cardBorder}`,
        }}
      >
        <Captions style={{ width: 10, height: 10, color: th.captionBadgeText }} />
        <span style={{ fontSize: 9, color: th.captionBadgeText, fontWeight: 500 }}>Субтитры</span>
        <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
      </div>

      {listening && visible === 0 ? (
        <div
          className="rounded-2xl px-4 py-2.5 text-center"
          style={{
            background: th.captionBg(true),
            backdropFilter: "blur(18px)",
            border: th.captionBorder(false),
          }}
        >
          <span className="text-[12px] leading-snug" style={{ color: th.captionText(false), fontWeight: 400 }}>
            Здесь — титры созвона из группового чата, не в переписке. Говорите в микрофон. Пусто долго — ASR на
            сервере (Vosk) или браузер без распознавания речи.
          </span>
        </div>
      ) : null}

      {lines.map((line, i) => (
        <div
          key={`${i}-${line.name}-${line.text.slice(0, 24)}`}
          className="flex items-baseline gap-2 rounded-2xl px-4 py-2.5 transition-all duration-500"
          style={{
            background: th.captionBg(line.isActive),
            backdropFilter: "blur(18px)",
            border: th.captionBorder(line.isActive),
            opacity: line.isActive ? 1 : 0.45 - (visible - 1 - i) * 0.12,
            transform: `scale(${line.isActive ? 1 : 0.97 - (visible - 1 - i) * 0.02})`,
            animation: line.isActive ? "captionFade 0.35s ease" : "none",
          }}
        >
          <span
            className="shrink-0 text-[11px] font-bold"
            style={{ color: line.color, textShadow: th.isDark ? `0 0 8px ${line.color}60` : "none" }}
          >
            {line.name}:
          </span>
          <span
            className="text-[13px] leading-snug"
            style={{ color: th.captionText(line.isActive), fontWeight: line.isActive ? 400 : 300 }}
          >
            {line.text}
            {line.isActive ? (
              <span
                className="ml-0.5 inline-block h-3.5 w-0.5 align-middle rounded-full"
                style={{
                  background: line.color,
                  animation: "captionCursor 0.9s ease-in-out infinite alternate",
                  opacity: 0.8,
                }}
              />
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}

function Tile({
  p,
  variant,
  onClick,
  active,
  isVideoCall,
  mutePlayback,
  playbackVolume,
  showHandRaised = false,
}: {
  p: LayoutP
  variant: "card" | "strip" | "mini"
  onClick?: () => void
  active?: boolean
  isVideoCall: boolean
  mutePlayback: boolean
  playbackVolume: number
  showHandRaised?: boolean
}) {
  const th = useContext(ThCtx)
  const reducedMotion = usePrefersReducedMotion()
  const vRef = useRef<HTMLVideoElement>(null)
  const aRef = useRef<HTMLAudioElement>(null)
  const isSpeaking = p.mood === "speaking"
  const highlighted = active ?? isSpeaking
  const avatarSize = variant === "card" ? 56 : variant === "strip" ? 40 : 28
  const fontSize = variant === "card" ? 18 : variant === "strip" ? 13 : 10

  const showVideo = Boolean(
    isVideoCall &&
      p.video &&
      p.stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled),
  )

  const activeVideoTrack =
    p.stream?.getVideoTracks().find((t) => t.readyState === "live" && t.enabled) ?? null
  const mirrorSelfPreview =
    p.isSelf && showVideo && !!activeVideoTrack && !isDisplayCaptureVideoTrack(activeVideoTrack)

  const vol = mutePlayback ? 0 : Math.min(1, Math.max(0, playbackVolume))

  const ringRoundClass = variant === "card" ? "rounded-2xl" : variant === "strip" ? "rounded-xl" : "rounded-lg"

  useEffect(() => {
    const el = vRef.current
    if (!el) return
    const next = showVideo && p.stream ? p.stream : null
    if (el.srcObject !== next) {
      el.srcObject = next
      if (showVideo && next) void el.play().catch(() => {})
    }
  }, [p.stream, showVideo, p.streamRenderKey])

  useEffect(() => {
    const el = vRef.current
    if (!el || !showVideo) return
    el.volume = vol
    el.muted = mutePlayback || vol <= 0
  }, [showVideo, vol, mutePlayback])

  useEffect(() => {
    const el = aRef.current
    if (!el || !p.stream || showVideo) return
    const at = p.stream.getAudioTracks()[0]
    if (!at) {
      el.srcObject = null
      return
    }
    const next = new MediaStream([at])
    if (el.srcObject !== next) {
      el.srcObject = next
      void el.play().catch(() => {})
    }
  }, [p.stream, showVideo])

  useEffect(() => {
    const el = aRef.current
    if (!el || !p.stream || showVideo) return
    el.volume = vol
    el.muted = mutePlayback || vol <= 0
  }, [p.stream, showVideo, vol, mutePlayback])

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        "relative flex items-center justify-center overflow-hidden transition-[border-color,box-shadow] duration-200",
        variant === "card" ? "h-full min-h-0 w-full rounded-2xl" : "",
        variant === "strip" ? "aspect-video w-full cursor-pointer rounded-xl" : "",
        variant === "mini" ? "cursor-pointer rounded-lg" : "",
        onClick ? "cursor-pointer hover:brightness-105" : "",
        showHandRaised && !reducedMotion && "animate-group-call-hand-contour",
      )}
      style={{
        background: th.tileBg(p.color, showVideo || p.video),
        border: showHandRaised
          ? "2px solid rgba(251, 191, 36, 0.82)"
          : th.tileBorder(highlighted, p.color),
        boxShadow: showHandRaised
          ? reducedMotion
            ? "0 0 0 1px rgba(251,191,36,0.4), 0 0 26px rgba(251,191,36,0.38)"
            : undefined
          : th.tileGlow(highlighted, p.color),
      }}
      title={showHandRaised ? "Рука поднята" : undefined}
    >
      <div
        className={cn(
          "relative z-[6] flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden",
          ringRoundClass,
        )}
      >
        {!showVideo && p.stream?.getAudioTracks()[0] ? (
          <audio
            ref={aRef}
            playsInline
            className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
            muted={mutePlayback || vol <= 0}
            aria-hidden
          />
        ) : null}

        <div
          className="pointer-events-none absolute"
          style={{
            width: avatarSize * 2.2,
            height: avatarSize * 2.5,
            background: `radial-gradient(ellipse,${p.color}12 0%,transparent 68%)`,
            filter: "blur(18px)",
            top: "5%",
          }}
        />

        {showVideo ? (
          <video
            ref={vRef}
            autoPlay
            playsInline
            muted={mutePlayback || vol <= 0}
            className="absolute inset-0 z-[5] h-full w-full object-cover [transform:translateZ(0)]"
            style={mirrorSelfPreview ? { transform: "scaleX(-1) translateZ(0)" } : undefined}
          />
        ) : (
          <div
            className="relative z-10 flex items-center justify-center rounded-full font-bold"
            style={{
              width: avatarSize,
              height: avatarSize,
              fontSize,
              background: `${p.color}22`,
              border: `2px solid ${p.color}30`,
              color: p.color,
              boxShadow: highlighted ? `0 0 0 1.5px ${p.color}80, 0 0 6px ${p.color}28` : "none",
            }}
          >
            {p.init}
          </div>
        )}

        <div
          className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full px-2 py-1"
          style={{ background: th.namePill, backdropFilter: "blur(8px)" }}
        >
          {!p.mic ? <MicOff style={{ width: 8, height: 8, color: "#f87171" }} /> : null}
          <span
            style={{ fontSize: 8, color: th.namePillText, fontWeight: 500, whiteSpace: "nowrap" }}
          >
            {variant === "mini" ? p.init : p.name.split(" ")[0]}
          </span>
          {isSpeaking ? <SpeakingBars color={p.color} active /> : null}
        </div>

        {!p.isSelf && variant !== "mini" ? (
          <div
            className="absolute right-1.5 top-1.5 z-10 rounded-full px-1 py-0.5"
            style={{
              background: `${MOOD_LABEL[p.mood].color}18`,
              color: MOOD_LABEL[p.mood].color,
              fontSize: 7,
              fontWeight: 600,
              border: `1px solid ${MOOD_LABEL[p.mood].color}28`,
            }}
          >
            {MOOD_LABEL[p.mood].label}
          </div>
        ) : null}

        {highlighted && !showVideo ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ animation: "speakRing 2s ease-in-out infinite" }}
          />
        ) : null}
      </div>
    </div>
  )
}

function RoundControlBtn({
  th,
  onClick,
  disabled,
  red,
  active,
  activeColor,
  glow,
  badge,
  ariaLabel,
  className,
  children,
}: {
  th: Th
  onClick?: () => void
  disabled?: boolean
  red?: boolean
  active?: boolean
  activeColor?: string
  glow?: string
  badge?: boolean
  ariaLabel?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled === true}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "group/b relative flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:pointer-events-none disabled:opacity-40",
        "max-md:h-11 max-md:w-11 max-md:min-h-[44px] max-md:min-w-[44px]",
        className,
      )}
    >
      <div
        className={cn("absolute inset-0 rounded-full transition-all", red ? "bg-red-500/10" : active ? "" : "bg-transparent")}
        style={{
          ...(glow ? { boxShadow: `0 0 14px ${glow}` } : {}),
          ...(active && activeColor
            ? {
                background: `${activeColor}22`,
                boxShadow: `0 0 14px ${activeColor}55`,
                border: `1px solid ${activeColor}44`,
              }
            : {}),
        }}
      />
      <div
        className="relative z-10 transition-colors"
        style={{ color: red ? undefined : active && activeColor ? activeColor : th.controlsBtnText }}
      >
        {children}
      </div>
      {badge ? (
        <div
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-400"
          style={{ boxShadow: "0 0 5px rgba(99,102,241,0.8)" }}
        />
      ) : null}
      {!red && glow ? (
        <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 16px ${glow}` }} />
      ) : null}
    </button>
  )
}

function CtrlSep({ th, className }: { th: Th; className?: string }) {
  return <div className={cn("mx-0.5 h-3.5 w-px shrink-0", className)} style={{ background: th.controlsDivider }} />
}

function ScreenShareContent() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: "#0f1117" }}>
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-2"
        style={{ background: "#1a1d27", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex gap-1">
          {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
            <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div
          className="mx-3 flex h-5 flex-1 items-center rounded px-2 text-[9px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)" }}
        >
          figma.com / PULSE-App-v3
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className="flex w-40 shrink-0 flex-col gap-0.5 px-2 py-3"
          style={{ background: "#13151f", borderRight: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="mb-1 px-1 text-[8px] font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>
            СЛОИ
          </div>
          {["Frame / Chat Dark", "Group / Bottom Nav"].map((l, i) => (
            <div
              key={l}
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[8px]"
              style={{
                color: i === 1 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                background: i === 1 ? "rgba(99,102,241,0.15)" : "transparent",
              }}
            >
              <span className="truncate">{l}</span>
            </div>
          ))}
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ background: "#1c1f2e" }}>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="relative z-10 overflow-hidden rounded-[28px] shadow-2xl"
            style={{ width: 168, height: 340, background: "#080810", border: "2px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex h-8 items-center gap-2 px-4" style={{ background: "#10101a" }}>
              <div className="h-2 w-2 rounded-full" style={{ background: "#818cf8" }} />
            </div>
          </div>
        </div>
      </div>
      <div
        className="absolute left-1/2 top-12 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          background: "rgba(239,68,68,0.15)",
          border: "1.5px solid rgba(239,68,68,0.45)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        <span className="text-[10px] font-semibold text-red-300">Демонстрация экрана</span>
      </div>
    </div>
  )
}

function formatTranscriptClock(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return "—"
  }
}

function AIPanel({
  peers,
  transcriptSegments,
  captionsEnabled,
  canToggleTranscripts,
  onClose,
}: {
  peers: LayoutP[]
  transcriptSegments: GroupCallAILayoutSession["transcriptSegments"]
  captionsEnabled: boolean
  canToggleTranscripts: boolean
  onClose: () => void
}) {
  const th = useContext(ThCtx)
  const [activeTab, setActiveTab] = useState<"analytics" | "topics" | "actions">("analytics")
  const groupEngagementPct = GROUP_ENGAGEMENT_MOCK_PCT
  const orderedPeers = useMemo(
    () => [...peers].sort((a, b) => Number(b.isSelf) - Number(a.isSelf)),
    [peers],
  )
  const topicRows = useMemo(() => {
    const list = [...transcriptSegments].filter((s) => s.textNormalized?.trim())
    return list.slice(-24).reverse()
  }, [transcriptSegments])

  return (
    <div
      className="flex h-full shrink-0 flex-col overflow-hidden"
      style={{
        width: 280,
        background: th.panelBg,
        backdropFilter: "blur(24px)",
        borderLeft: `1px solid ${th.panelBorder}`,
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4">
        <div
          className="flex h-5 w-5 items-center justify-center rounded-lg"
          style={{ background: "rgba(139,92,246,0.22)", boxShadow: "0 0 10px rgba(139,92,246,0.3)" }}
        >
          <Brain style={{ width: 11, height: 11, color: "#c4b5fd" }} />
        </div>
        <span className="text-[12px] font-semibold" style={{ color: th.text }}>
          AI-анализ
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px]"
            style={{
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
          >
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            LIVE
          </div>
          <button type="button" className="transition-opacity hover:opacity-70" onClick={onClose} aria-label="Свернуть панель">
            <ChevronRight style={{ width: 14, height: 14, color: th.textFaint }} />
          </button>
        </div>
      </div>

      <div className="mb-3 flex shrink-0 gap-1 px-3">
        {(["analytics", "topics", "actions"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="flex-1 rounded-xl py-1.5 text-[9px] font-semibold transition-all duration-200"
            style={
              activeTab === tab
                ? th.tabActive
                : { background: "transparent", ...th.tabInactive, border: "1px solid transparent" }
            }
          >
            {tab === "analytics" ? "Участники" : tab === "topics" ? "Темы" : "Задачи"}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-4" style={{ scrollbarWidth: "none" }}>
        {activeTab === "analytics" ? (
          <>
            <div className="rounded-xl border px-3 py-3" style={{ background: th.cardBg, borderColor: th.cardBorder }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px]" style={{ color: th.textMuted }}>
                  Вовлечённость группы
                </span>
                <span className="text-[12px] font-bold" style={{ color: "#34d399" }}>
                  {groupEngagementPct}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full" style={{ background: th.trackBg }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${groupEngagementPct}%`,
                    background: "linear-gradient(to right,#6366f1,#34d399)",
                    boxShadow: "0 0 6px rgba(52,211,153,0.4)",
                  }}
                />
              </div>
              <p className="mt-2 text-[8px] leading-snug" style={{ color: th.textFaint }}>
                Процент вовлечённости группы и доля речи по участникам — демо из макета. В реальном времени обновляется
                только метка «Говорит» (кто сейчас в эфире по микрофону).
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: th.cardBorder }}>
              {orderedPeers.map((p, i, arr) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-2.5 px-3 py-2.5 transition-colors"
                    style={{
                      borderBottom: i < arr.length - 1 ? `1px solid ${th.rowBorder}` : "none",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = th.rowHover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold"
                      style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}30` }}
                    >
                      {p.init}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1">
                        <span className="truncate text-[10px] font-medium" style={{ color: th.text }}>
                          {p.isSelf ? "Вы" : p.name.split(" ")[0]}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-1 py-0.5 text-[7px]"
                          style={{
                            background: `${MOOD_LABEL[p.mood].color}18`,
                            color: MOOD_LABEL[p.mood].color,
                          }}
                        >
                          {MOOD_LABEL[p.mood].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: th.trackBg }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${p.talk * 2.5}%`, background: p.color, opacity: 0.65 }}
                          />
                        </div>
                        <span className="tabular-nums text-[8px]" style={{ color: th.textFaint }}>
                          {p.talk}%
                        </span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-semibold"
                      style={{
                        color: p.engagement >= 70 ? "#34d399" : p.engagement >= 50 ? "#f59e0b" : "#f87171",
                      }}
                    >
                      {p.engagement}%
                    </span>
                  </div>
                ))}
            </div>
          </>
        ) : null}

        {activeTab === "topics" ? (
          <>
            {topicRows.length === 0 ? (
              <div className="rounded-xl border px-3 py-4 text-center" style={{ background: th.cardBg, borderColor: th.cardBorder }}>
                <p className="text-[10px] leading-relaxed" style={{ color: th.textMuted }}>
                  {!canToggleTranscripts
                    ? "Для этой комнаты распознавание речи недоступно — список тем из разговора не заполняется."
                    : !captionsEnabled
                      ? "Включите субтитры в панели звонка: тогда сюда попадут распознанные фрагменты речи (по спикеру и времени)."
                      : "Пока нет распознанных фраз. Заговорите — фрагменты появятся здесь. Отдельное AI-резюме по темам — в планах."}
                </p>
              </div>
            ) : (
              <>
                <p className="px-0.5 text-[8px] leading-relaxed" style={{ color: th.textFaint }}>
                  Ниже — последние фразы из субтитров (не сгруппированные темы). Автоматическое резюме диалога по темам —
                  позже.
                </p>
                <div className="overflow-hidden rounded-xl border" style={{ borderColor: th.cardBorder }}>
                  {topicRows.map((seg, i, arr) => {
                    const name = (seg.speakerDisplayName.trim().split(/\s+/)[0] ?? seg.speakerDisplayName).slice(0, 20)
                    return (
                      <div
                        key={seg.id}
                        className="px-3 py-2.5 transition-colors"
                        style={{
                          borderBottom: i < arr.length - 1 ? `1px solid ${th.rowBorder}` : "none",
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = th.rowHover
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent"
                        }}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className="shrink-0 tabular-nums text-[8px]" style={{ color: th.textFaint }}>
                            {formatTranscriptClock(seg.createdAt)}
                          </span>
                          <span className="truncate text-[10px] font-semibold" style={{ color: th.text }}>
                            {name}
                          </span>
                        </div>
                        <p className="text-[9px] leading-snug" style={{ color: th.textMuted }}>
                          {seg.textNormalized.trim()}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        ) : null}

        {activeTab === "actions" ? (
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: th.cardBorder }}>
            {ACTIONS.map((a, i, arr) => {
              const owner = peers.find((p) => p.init === a.owner)
              return (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 transition-colors"
                  style={{
                    borderBottom: i < arr.length - 1 ? `1px solid ${th.rowBorder}` : "none",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = th.rowHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  <div
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
                    style={{ background: `${owner?.color ?? "#818cf8"}22`, color: owner?.color ?? "#818cf8" }}
                  >
                    {a.owner}
                  </div>
                  <span className="text-[10px] leading-snug" style={{ color: th.textMuted }}>
                    {a.text}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type GroupCallAILayoutProps = {
  chatId?: string
  chatTitle: string
  myUserId: string
  myDisplayName: string
  elapsedSec: number
  session: GroupCallAILayoutSession
  supportsScreenShare: boolean
  commandPrompt?: React.ReactNode
}

export function GroupCallAILayout({
  chatId,
  chatTitle,
  myUserId,
  myDisplayName,
  elapsedSec,
  session,
  supportsScreenShare,
  commandPrompt,
}: GroupCallAILayoutProps) {
  const [isMicOn, setIsMicOn] = useState(!session.isMuted)
  const [isVideoOn, setIsVideoOn] = useState(!session.isCameraOff)
  const [isAIOpen, setIsAIOpen] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [uiVisible, setUiVisible] = useState(true)
  const [spotlightUserId, setSpotlightUserId] = useState(myUserId)
  const [isDark, setIsDark] = useState(true)
  const [flipGridOrder, setFlipGridOrder] = useState(false)
  const isMobile = useIsMobile()
  /** На телефоне — сетка с квадратными плитками; режим «Экран» оставляем (демонстрация). */
  const effectiveViewMode: ViewMode = isMobile && viewMode !== "screenshare" ? "grid" : viewMode

  useEffect(() => {
    setIsMicOn(!session.isMuted)
  }, [session.isMuted])

  useEffect(() => {
    setIsVideoOn(!session.isCameraOff)
  }, [session.isCameraOff])

  /** Звук, когда руку поднимает другой участник (своя рука — звук в onClick кнопки). */
  const prevHandsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (session.phase !== "active") {
      prevHandsRef.current = new Set()
      return
    }
    const next = new Set(session.handRaisedUserIds)
    for (const id of next) {
      if (id !== myUserId && !prevHandsRef.current.has(id)) {
        playGroupHandRaiseSound()
        break
      }
    }
    prevHandsRef.current = next
  }, [session.handRaisedUserIds, session.phase, myUserId])

  const th: Th = isDark ? darkTh : lightTh

  const colorByUserId = useMemo(() => {
    const PEER_COLORS = ["#818cf8", "#34d399", "#f472b6", "#fb923c"] as const
    const m = new Map<string, string>()
    let idx = 0
    const sorted = [...session.participants].sort((a, b) => a.userId.localeCompare(b.userId))
    for (const rp of sorted) {
      m.set(rp.userId, rp.userId === myUserId ? "#a78bfa" : PEER_COLORS[idx++ % PEER_COLORS.length]!)
    }
    return m
  }, [session.participants, myUserId])

  const layoutPeers: LayoutP[] = useMemo(() => {
    const sorted = sortParticipantsForGrid(session.participants, session.hostUserId)
    const nonSelfSorted = sorted.filter((p) => p.userId !== myUserId)
    return sorted.map((rp) => {
      const isSelf = rp.userId === myUserId
      const stream = isSelf ? session.localStream : session.getRemoteStream(rp.userId)
      const at = stream?.getAudioTracks()[0]
      const mic = isSelf ? !session.isMuted : at ? at.enabled : true
      const vt = stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled)
      const videoShowing = Boolean(session.isVideo && vt && (isSelf ? !session.isCameraOff : true))
      const remoteIdx = isSelf ? -1 : nonSelfSorted.findIndex((x) => x.userId === rp.userId)
      const talk = isSelf ? 7 : TALK_PRESET[Math.max(0, remoteIdx) % TALK_PRESET.length]!
      const engagement = isSelf ? 72 : ENGAGEMENT_PRESET[Math.max(0, remoteIdx) % ENGAGEMENT_PRESET.length]!
      let mood: Mood = isSelf ? "calm" : REMOTE_MOOD_BY_INDEX[Math.max(0, remoteIdx) % REMOTE_MOOD_BY_INDEX.length]!
      if (session.activeSpeakerId === rp.userId) mood = "speaking"
      else if (!mic) mood = "calm"

      return {
        userId: rp.userId,
        name: isSelf ? myDisplayName || rp.displayName : rp.displayName,
        init: initialsFrom(isSelf ? myDisplayName || rp.displayName : rp.displayName),
        mood,
        talk,
        engagement,
        color: colorByUserId.get(rp.userId) ?? "#818cf8",
        mic,
        video: videoShowing,
        isSelf,
        stream,
        streamRenderKey: isSelf ? session.localStreamRenderKey : 0,
      }
    })
  }, [
    session.participants,
    session.hostUserId,
    session.localStream,
    session.getRemoteStream,
    session.isMuted,
    session.isCameraOff,
    session.isVideo,
    session.activeSpeakerId,
    session.localStreamRenderKey,
    myUserId,
    myDisplayName,
    colorByUserId,
  ])

  /** Все участники, включая себя — иначе звонящий не видит своё превью в сетке. */
  const gridParticipants = useMemo(() => {
    const list = flipGridOrder ? [...layoutPeers].reverse() : layoutPeers
    return list
  }, [layoutPeers, flipGridOrder])

  /** Десктоп: крупные плитки 16:9, ~6 на экран (2×3), прокрутка если больше; 2–4 участника — 2 колонки с добивкой пустыми ячейками. */
  const desktopGridCols = useMemo(() => {
    const n = gridParticipants.length
    if (isMobile) return null
    if (n <= 1) return 1
    if (n <= 4) return 2
    return 3
  }, [gridParticipants.length, isMobile])

  const desktopEmptySlotCount = useMemo(() => {
    if (isMobile || desktopGridCols == null) return 0
    const n = gridParticipants.length
    if (n === 0) return 0
    const slots = desktopGridCols * Math.ceil(n / desktopGridCols)
    return slots - n
  }, [isMobile, desktopGridCols, gridParticipants.length])

  /** Ячеек в сетке (участники + пустые добивки) — для явных row/column tracks на десктопе */
  const desktopGridSlotCount = useMemo(() => {
    if (isMobile || desktopGridCols == null) return 0
    const n = gridParticipants.length
    if (n === 0) return 0
    return desktopGridCols * Math.ceil(n / desktopGridCols)
  }, [isMobile, desktopGridCols, gridParticipants.length])

  const desktopGridRowCount = useMemo(() => {
    if (desktopGridCols == null || desktopGridSlotCount === 0) return 0
    return Math.ceil(desktopGridSlotCount / desktopGridCols)
  }, [desktopGridCols, desktopGridSlotCount])

  /**
   * Пока строк немного — делим высоту поровну (ровная 2×2 / 2×3 без «дыр»).
   * Много строк — прежняя схема: min-высота от aspect-video + вертикальный скролл.
   */
  const DESKTOP_GRID_FR_ROW_MAX = 4
  const desktopGridFillViewport =
    !isMobile &&
    gridParticipants.length > 1 &&
    desktopGridCols != null &&
    desktopGridRowCount > 0 &&
    desktopGridRowCount <= DESKTOP_GRID_FR_ROW_MAX
  const self = useMemo(() => {
    const found = layoutPeers.find((p) => p.isSelf) ?? layoutPeers[0]
    if (found) return found
    return buildFallbackSelfLayoutP({ myUserId, myDisplayName, session })
  }, [layoutPeers, myUserId, myDisplayName, session])

  const spotlightP = useMemo(() => {
    const bySpot = layoutPeers.find((p) => p.userId === spotlightUserId)
    if (bySpot) return bySpot
    const first = layoutPeers[0]
    if (first) return first
    return buildFallbackSelfLayoutP({ myUserId, myDisplayName, session })
  }, [layoutPeers, spotlightUserId, myUserId, myDisplayName, session])
  const sidePartic = useMemo(
    () => layoutPeers.filter((p) => p.userId !== spotlightUserId),
    [layoutPeers, spotlightUserId],
  )

  const playbackVolumeForUid = useCallback(
    (uid: string) => {
      if (uid === myUserId) return 1
      const duck = session.activeSpeakerId
      if (!duck || session.participants.length < 2) return 1
      return uid === duck ? 1 : 0.75
    },
    [myUserId, session.activeSpeakerId, session.participants.length],
  )

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  const wakeChromeIfHidden = useCallback(() => {
    setUiVisible((shown) => {
      if (!shown) return true
      return shown
    })
  }, [])

  /** Только реальные сегменты с сервера/распознавания — без демо-текста из макета. */
  const overlayCaptionLines = useMemo(() => {
    if (!session.captionsEnabled) return []
    const segs = session.transcriptSegments.filter((s) => s.textNormalized.trim().length > 0)
    if (segs.length === 0) return []
    const last = segs.slice(-4)
    return last.map((s, i, arr) => ({
      name: (s.speakerDisplayName.trim().split(/\s+/)[0] ?? s.speakerDisplayName).slice(0, 24),
      color: colorByUserId.get(s.speakerUserId) ?? "#818cf8",
      text: s.textNormalized.trim(),
      isActive: i === arr.length - 1,
    }))
  }, [session.captionsEnabled, session.transcriptSegments, colorByUserId])

  const captionsEffective = session.captionsEnabled
  const showRealScreen = session.isScreenSharing && effectiveViewMode === "screenshare"
  const screenVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = screenVideoRef.current
    if (!el || !showRealScreen || !session.localStream) return
    el.srcObject = session.localStream
    void el.play().catch(() => {})
  }, [showRealScreen, session.localStream, session.localStreamRenderKey])

  const onToggleMic = () => {
    const next = !isMicOn
    setIsMicOn(next)
    session.setMuted(!next)
  }

  const onToggleVideo = () => {
    if (!session.isVideo || session.phase !== "active" || session.isScreenSharing) return
    const next = !isVideoOn
    setIsVideoOn(next)
    session.setCameraOff(!next)
  }

  const VIEW_MODES = [
    { mode: "grid" as ViewMode, icon: <Grid style={{ width: 13, height: 13 }} />, label: "Сетка" },
    { mode: "spotlight" as ViewMode, icon: <Maximize2 style={{ width: 13, height: 13 }} />, label: "Спикер" },
    { mode: "screenshare" as ViewMode, icon: <Monitor style={{ width: 13, height: 13 }} />, label: "Экран" },
  ]

  const openChatInNewTab = useCallback(() => {
    if (!chatId?.trim()) {
      toast({ title: "Чат недоступен", description: "Для этого звонка не указан чат." })
      return
    }
    const url = `${window.location.origin}/chat/${encodeURIComponent(chatId.trim())}`
    window.open(url, "_blank", "noopener,noreferrer")
  }, [chatId])

  const cycleSpotlightPeer = useCallback(() => {
    const ids = layoutPeers.map((p) => p.userId)
    if (ids.length === 0) return
    const i = Math.max(0, ids.indexOf(spotlightUserId))
    setSpotlightUserId(ids[(i + 1) % ids.length]!)
    setViewMode("spotlight")
    toast({ title: "Фокус", description: "Переключили крупную плитку на следующего участника." })
  }, [layoutPeers, spotlightUserId])

  const myHandRaised = session.handRaisedUserIds.includes(myUserId)

  const sendReaction = useCallback(
    (emoji: string, label: string) => {
      if (session.phase !== "active") return
      session.sendGroupReaction(emoji, label)
    },
    [session],
  )

  return (
    <ThCtx.Provider value={th}>
      <div
        className="relative flex h-full min-h-0 w-full overflow-hidden transition-colors duration-500 select-none"
        style={{
          background: th.bg,
          color: th.text,
          fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        }}
        onMouseMove={wakeChromeIfHidden}
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 transition-all duration-500"
            style={{ background: th.ambient }}
          />

          <div
            className={cn(
              "relative z-20 flex items-center gap-2.5 px-4 pb-2 pt-3.5 transition-all duration-500",
              uiVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0",
            )}
          >
            <div className="flex shrink-0 items-center gap-2">
              <img
                src="/F-PING.png?v=5"
                alt=""
                className="h-8 w-8 shrink-0 object-contain select-none"
                width={32}
                height={32}
                decoding="async"
                draggable={false}
              />
              <span
                className="hidden text-[11px] font-semibold tracking-tight min-[400px]:inline"
                style={{ color: th.topBarText }}
              >
                PING MOOT
              </span>
            </div>

            <div
              className="flex flex-1 items-center gap-2.5 rounded-full px-3.5 py-1.5"
              style={{
                background: th.topBarPill,
                border: `1px solid ${th.topBarPillBorder}`,
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Users style={{ width: 11, height: 11, color: th.topBarText }} />
                <span style={{ fontSize: 10, color: th.topBarText, fontWeight: 500 }}>{chatTitle}</span>
              </div>
              <div className="h-3 w-px" style={{ background: th.topBarDivider }} />
              <div className="flex items-center gap-1" style={{ fontSize: 9, color: th.topBarTextFaint }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {participantCountLabelRu(session.participants.length)}
              </div>
              <div className="h-3 w-px" style={{ background: th.topBarDivider }} />
              <div className="flex items-center gap-1" style={{ fontSize: 9, color: "#a78bfa" }}>
                <Brain style={{ width: 9, height: 9 }} />
                AI активен
              </div>
              <div className="ml-auto font-mono tabular-nums" style={{ fontSize: 10, color: th.topBarTextFaint }}>
                {fmt(elapsedSec)}
              </div>
            </div>

            <div
              className="hidden items-center gap-0.5 rounded-xl p-0.5 md:flex"
              style={{ background: th.topBarPill, border: `1px solid ${th.topBarPillBorder}` }}
            >
              {VIEW_MODES.map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  title={label}
                  onClick={() => setViewMode(mode)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-all duration-200"
                  style={viewMode === mode ? th.viewBtnActive : th.viewBtnInactive}
                >
                  {icon}
                  <span style={{ fontSize: 9, fontWeight: 600 }}>{label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsAIOpen(!isAIOpen)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 transition-all duration-300"
              style={isAIOpen ? th.aiBtnActive : th.aiBtnInactive}
            >
              <Brain style={{ width: 13, height: 13 }} />
              <span style={{ fontSize: 9, fontWeight: 600 }}>AI</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300"
              title={isDark ? "Светлая тема" : "Тёмная тема"}
              style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.1)",
                border: `1px solid ${th.topBarPillBorder}`,
              }}
            >
              {isDark ? (
                <Sun style={{ width: 13, height: 13, color: "#fbbf24" }} />
              ) : (
                <Moon style={{ width: 13, height: 13, color: "#6366f1" }} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setUiVisible(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
              style={{ background: "transparent" }}
              title="Скрыть интерфейс"
              aria-label="Скрыть интерфейс"
            >
              <EyeOff style={{ width: 13, height: 13, color: th.eyeBtn }} />
            </button>
          </div>

          {session.error ? (
            <div className="relative z-30 mx-3 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-center text-sm">
              {session.error}
            </div>
          ) : null}

          {commandPrompt ? <div className="relative z-30 mx-3 mt-1">{commandPrompt}</div> : null}

          <div className="relative z-10 flex min-h-0 flex-1 gap-2 px-3 pb-2">
            {effectiveViewMode === "grid" ? (
              <div
                className={cn(
                  "min-h-0 w-full",
                  isMobile
                    ? cn(
                        "gap-2",
                        gridParticipants.length === 1
                          ? "flex flex-1 items-center justify-center"
                          : "grid flex-1 grid-cols-2 content-start",
                      )
                    : cn(
                        "gap-3",
                        gridParticipants.length === 1
                          ? "flex flex-1 min-h-0 items-center justify-center overflow-y-auto"
                          : cn(
                              "grid flex-1 min-h-0",
                              desktopGridFillViewport
                                ? "h-full overflow-hidden"
                                : "content-start overflow-y-auto",
                              !desktopGridFillViewport && desktopGridCols === 2 && "grid-cols-2",
                              !desktopGridFillViewport && desktopGridCols === 3 && "grid-cols-3",
                            ),
                      ),
                )}
                style={
                  !isMobile && desktopGridFillViewport && desktopGridCols != null
                    ? {
                        gridTemplateColumns: `repeat(${desktopGridCols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${desktopGridRowCount}, minmax(0, 1fr))`,
                      }
                    : undefined
                }
              >
                {gridParticipants.map((p) => (
                  <div
                    key={p.userId}
                    className={cn(
                      "min-h-0 min-w-0",
                      isMobile &&
                        cn(
                          "aspect-square w-full max-h-[min(52vh,520px)] justify-self-center",
                          gridParticipants.length === 1 && "w-full max-w-lg",
                        ),
                      !isMobile &&
                        cn(
                          "w-full",
                          gridParticipants.length === 1
                            ? "aspect-video max-w-[min(100%,56rem)]"
                            : desktopGridFillViewport
                              ? "h-full min-h-0"
                              : "aspect-video",
                        ),
                    )}
                  >
                    <Tile
                      p={p}
                      variant="card"
                      isVideoCall={session.isVideo}
                      mutePlayback={p.userId === myUserId}
                      playbackVolume={playbackVolumeForUid(p.userId)}
                      showHandRaised={session.handRaisedUserIds.includes(p.userId)}
                      onClick={
                        isMobile
                          ? undefined
                          : () => {
                              setSpotlightUserId(p.userId)
                              setViewMode("spotlight")
                            }
                      }
                    />
                  </div>
                ))}
                {!isMobile && desktopEmptySlotCount > 0
                  ? Array.from({ length: desktopEmptySlotCount }, (_, i) => (
                      <div
                        key={`grid-empty-${i}`}
                        className={cn(
                          "min-h-0 w-full rounded-2xl border border-dashed opacity-45",
                          desktopGridFillViewport ? "h-full" : "aspect-video",
                        )}
                        style={{
                          borderColor: th.cardBorder,
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.06)",
                        }}
                        aria-hidden
                      />
                    ))
                  : null}
              </div>
            ) : null}

            {effectiveViewMode === "spotlight" ? (
              <div className="flex min-h-0 flex-1 gap-2">
                <div className="min-w-0 flex-1">
                  <Tile
                    p={spotlightP}
                    variant="card"
                    active
                    isVideoCall={session.isVideo}
                    mutePlayback={spotlightP.userId === myUserId}
                    playbackVolume={playbackVolumeForUid(spotlightP.userId)}
                    showHandRaised={session.handRaisedUserIds.includes(spotlightP.userId)}
                  />
                </div>
                <div
                  className="flex w-[130px] shrink-0 flex-col gap-2 overflow-y-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  {sidePartic.map((p) => (
                    <Tile
                      key={p.userId}
                      p={p}
                      variant="strip"
                      active={p.userId === spotlightUserId}
                      isVideoCall={session.isVideo}
                      mutePlayback={p.userId === myUserId}
                      playbackVolume={playbackVolumeForUid(p.userId)}
                      showHandRaised={session.handRaisedUserIds.includes(p.userId)}
                      onClick={() => setSpotlightUserId(p.userId)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {effectiveViewMode === "screenshare" ? (
              <div className="flex min-h-0 flex-1 gap-2">
                <div
                  className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl"
                  style={{ border: "1.5px solid rgba(239,68,68,0.35)", boxShadow: "0 0 24px rgba(239,68,68,0.12)" }}
                >
                  {showRealScreen ? (
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ScreenShareContent />
                  )}
                  {!showRealScreen &&
                  supportsScreenShare &&
                  session.isVideo &&
                  session.phase === "active" &&
                  !session.isScreenSharing ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                      <button
                        type="button"
                        onClick={() => void session.toggleScreenShare()}
                        className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-semibold transition-transform active:scale-95"
                        style={{
                          background: "rgba(239,68,68,0.22)",
                          border: "1px solid rgba(239,68,68,0.5)",
                          color: "#fecaca",
                          boxShadow: "0 0 20px rgba(239,68,68,0.25)",
                        }}
                      >
                        <MonitorUp style={{ width: 14, height: 14 }} aria-hidden />
                        Начать демонстрацию экрана
                      </button>
                    </div>
                  ) : null}
                </div>
                <div
                  className="flex w-[130px] shrink-0 flex-col gap-2 overflow-y-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  {layoutPeers.map((p) => (
                    <Tile
                      key={p.userId}
                      p={p}
                      variant="strip"
                      isVideoCall={session.isVideo}
                      mutePlayback={p.userId === myUserId}
                      playbackVolume={playbackVolumeForUid(p.userId)}
                      showHandRaised={session.handRaisedUserIds.includes(p.userId)}
                      onClick={() => {
                        setSpotlightUserId(p.userId)
                        setViewMode("spotlight")
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {captionsEffective ? (
            <CaptionsOverlayAI
              lines={overlayCaptionLines}
              listening={overlayCaptionLines.length === 0}
            />
          ) : null}

          {effectiveViewMode !== "grid" ? (
            <div
              className={cn(
                "absolute z-[25] transition-all duration-300 max-md:bottom-[calc(100px+env(safe-area-inset-bottom,0px))] max-md:right-3",
                uiVisible
                  ? "bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-[148px]"
                  : "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4",
              )}
              style={{ width: 100, height: 68, zIndex: 25 }}
            >
              <Tile
                p={self}
                variant="strip"
                isVideoCall={session.isVideo}
                mutePlayback
                playbackVolume={1}
                showHandRaised={myHandRaised}
              />
            </div>
          ) : null}

          <div
            className={cn(
              "relative z-30 flex w-full min-w-0 items-center justify-center gap-2 px-1 pb-4 pt-1.5 transition-all duration-500 max-md:gap-1.5 max-md:pb-5",
              uiVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
            )}
          >
            <div
              className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] max-md:[-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden md:flex md:justify-center"
            >
              <div
                className="inline-flex w-max max-w-none flex-nowrap items-center gap-0 rounded-full px-1.5 py-1.5 md:mx-auto"
                style={{
                  background: th.controlsPill,
                  border: `1px solid ${th.controlsPillBorder}`,
                  boxShadow: th.controlsPillShadow,
                  backdropFilter: "blur(20px)",
                }}
              >
              <RoundControlBtn
                th={th}
                ariaLabel={isMicOn ? "Выключить микрофон" : "Включить микрофон"}
                onClick={onToggleMic}
                red={!isMicOn}
                className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
              >
                {isMicOn ? <Mic style={{ width: 17, height: 17 }} /> : <MicOff style={{ width: 17, height: 17, color: "#f87171" }} />}
              </RoundControlBtn>
              <CtrlSep th={th} />
              <RoundControlBtn
                th={th}
                ariaLabel={isVideoOn && session.isVideo ? "Выключить камеру" : "Включить камеру"}
                onClick={onToggleVideo}
                red={session.isVideo ? !isVideoOn : false}
                disabled={!session.isVideo || session.phase !== "active" || session.isScreenSharing}
                className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
              >
                {isVideoOn && session.isVideo ? (
                  <Video style={{ width: 17, height: 17 }} />
                ) : (
                  <VideoOff style={{ width: 17, height: 17, color: "#f87171" }} />
                )}
              </RoundControlBtn>
              {!isMobile ? (
                <>
                  <CtrlSep th={th} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <span className="inline-flex">
                        <RoundControlBtn th={th} ariaLabel="Реакции">
                          <Sparkles style={{ width: 17, height: 17 }} />
                        </RoundControlBtn>
                      </span>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="center" className="w-auto border p-2">
                      <div className="grid grid-cols-4 gap-1">
                        {REACTION_CHOICES.map(([emoji, label]) => (
                          <button
                            key={emoji}
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10"
                            onClick={() => sendReaction(emoji, label)}
                          >
                            <span aria-hidden>{emoji}</span>
                            <span className="sr-only">{label}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : null}
              <CtrlSep th={th} />
              <RoundControlBtn
                th={th}
                ariaLabel={myHandRaised ? "Опустить руку" : "Поднять руку"}
                className="max-md:[&_svg]:!h-[22px] max-md:[&_svg]:!w-[22px]"
                onClick={() => {
                  if (!myHandRaised) {
                    playGroupHandRaiseSound()
                    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic())
                  }
                  session.setHandRaised(!myHandRaised)
                }}
                active={myHandRaised}
                activeColor="#fbbf24"
                disabled={session.phase !== "active"}
              >
                <Hand className="h-[26px] w-[26px] max-md:h-[22px] max-md:w-[22px]" strokeWidth={2} />
              </RoundControlBtn>
              <CtrlSep th={th} />
              <RoundControlBtn
                th={th}
                ariaLabel="Режим демонстрации экрана"
                onClick={() => setViewMode("screenshare")}
                red={effectiveViewMode === "screenshare"}
                glow={effectiveViewMode === "screenshare" ? "rgba(239,68,68,0.5)" : undefined}
                className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
              >
                <Monitor style={{ width: 17, height: 17 }} />
              </RoundControlBtn>
              <CtrlSep th={th} />
              <RoundControlBtn
                th={th}
                ariaLabel={session.captionsEnabled ? "Выключить субтитры" : "Включить субтитры"}
                onClick={() => {
                  if (session.canToggleTranscripts && session.phase === "active") session.toggleCaptions()
                }}
                active={session.captionsEnabled}
                activeColor="#818cf8"
                disabled={!session.canToggleTranscripts || session.phase !== "active"}
                className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
              >
                <Captions style={{ width: 17, height: 17 }} />
              </RoundControlBtn>
              <CtrlSep th={th} />
              <RoundControlBtn
                th={th}
                ariaLabel="Открыть чат в новой вкладке"
                onClick={openChatInNewTab}
                badge
                className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
              >
                <MessageSquare style={{ width: 17, height: 17 }} />
              </RoundControlBtn>
              <CtrlSep th={th} />
              <Popover>
                <PopoverTrigger asChild>
                  <span className="inline-flex">
                    <RoundControlBtn
                      th={th}
                      ariaLabel="Ещё действия"
                      className="max-md:[&_svg]:!h-[15px] max-md:[&_svg]:!w-[15px]"
                    >
                      <MoreHorizontal style={{ width: 17, height: 17 }} />
                    </RoundControlBtn>
                  </span>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-[220px] border p-2">
                  <div className="mb-3 border-b pb-3" style={{ borderColor: `${th.controlsDivider}` }}>
                    <p className="mb-1.5 text-[9px] font-semibold" style={{ color: th.textMuted }}>
                      Реакции
                    </p>
                    <div className="grid grid-cols-4 gap-1">
                      {REACTION_CHOICES.map(([emoji, label]) => (
                        <button
                          key={emoji}
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-white/10"
                          onClick={() => sendReaction(emoji, label)}
                        >
                          <span aria-hidden>{emoji}</span>
                          <span className="sr-only">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() =>
                        toast({ title: "Картинка в картинке", description: "Скоро: вынос видео в PiP." })
                      }
                    >
                      <PictureInPicture2 style={{ width: 16, height: 16 }} />
                      PiP
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={cycleSpotlightPeer}
                    >
                      <RefreshCcw style={{ width: 16, height: 16 }} />
                      Спикер
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => {
                        setFlipGridOrder((f) => {
                          const next = !f
                          toast({
                            title: "Порядок плиток",
                            description: next ? "Порядок в сетке перевёрнут." : "Как в списке участников.",
                          })
                          return next
                        })
                      }}
                    >
                      <ArrowUpDown style={{ width: 16, height: 16 }} />
                      Порядок
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      disabled={!supportsScreenShare || !session.isVideo || session.phase !== "active"}
                      onClick={() => void session.toggleScreenShare()}
                    >
                      <MonitorUp style={{ width: 16, height: 16 }} />
                      Экран
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => toast({ title: "Запись", description: "Запись звонка пока не подключена." })}
                    >
                      <Circle style={{ width: 16, height: 16 }} />
                      Запись
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => toast({ title: "Избранное", description: "Скоро." })}
                    >
                      <Heart style={{ width: 16, height: 16 }} />
                      Лайк
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => toast({ title: "Улучшение", description: "Скоро: фильтры и ретушь." })}
                    >
                      <Sparkles style={{ width: 16, height: 16 }} />
                      Красота
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => {
                        if (session.canToggleTranscripts && session.phase === "active") session.toggleCaptions()
                      }}
                      disabled={!session.canToggleTranscripts || session.phase !== "active"}
                    >
                      <Subtitles style={{ width: 16, height: 16 }} />
                      Субтитры
                    </button>
                    <button
                      type="button"
                      className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] transition-colors hover:bg-white/10"
                      style={{ color: th.textMuted }}
                      onClick={() => toast({ title: "Участник", description: "Приглашение в звонок скоро." })}
                    >
                      <UserPlus style={{ width: 16, height: 16 }} />
                      Добавить
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
              </div>
            </div>

            <button
              type="button"
              onClick={() => session.hangup()}
              className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 active:scale-90 max-md:h-11 max-md:w-11 max-md:min-h-[44px] max-md:min-w-[44px]"
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle at 42% 30%,rgba(255,80,80,0.95),rgba(185,18,18,0.92))",
                }}
              />
              <div
                className="absolute inset-x-0 top-0 h-1/2 rounded-t-full"
                style={{ background: "linear-gradient(to bottom,rgba(255,255,255,0.17),transparent)" }}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 26px rgba(220,38,38,0.58),inset 0 1px 0 rgba(255,180,180,0.22)" }}
              />
              <PhoneOff style={{ width: 17, height: 17, color: "white", position: "relative", zIndex: 10 }} />
            </button>
          </div>

          {!uiVisible ? (
            <button
              type="button"
              onClick={() => setUiVisible(true)}
              className="absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 transition-all duration-300 hover:opacity-90 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
              style={{
                background: th.showUiBg,
                border: `1px solid ${th.showUiBorder}`,
                backdropFilter: "blur(12px)",
              }}
            >
              <Eye style={{ width: 13, height: 13, color: th.showUiText }} />
              <span style={{ fontSize: 10, color: th.showUiText, fontWeight: 500 }}>Показать интерфейс</span>
            </button>
          ) : null}
        </div>

        <div
          className={cn(
            "h-full shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]",
            isAIOpen ? "w-[280px] opacity-100" : "w-0 overflow-hidden opacity-0",
          )}
        >
          {isAIOpen ? (
            <AIPanel
              peers={layoutPeers}
              transcriptSegments={session.transcriptSegments}
              captionsEnabled={session.captionsEnabled}
              canToggleTranscripts={session.canToggleTranscripts}
              onClose={() => setIsAIOpen(false)}
            />
          ) : null}
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes barPop    { from{transform:scaleY(0.4)} to{transform:scaleY(1.6)} }
          @keyframes speakRing {
            0%   { box-shadow: 0 0 0 0   rgba(129,140,248,0.7), 0 0 0 0   rgba(129,140,248,0.2) }
            60%  { box-shadow: 0 0 0 4px rgba(129,140,248,0.15),0 0 0 9px rgba(129,140,248,0.06) }
            100% { box-shadow: 0 0 0 8px rgba(129,140,248,0),   0 0 0 16px rgba(129,140,248,0) }
          }
          @keyframes captionFade   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes captionCursor { from{opacity:0.2} to{opacity:1} }
        `,
          }}
        />
      </div>
    </ThCtx.Provider>
  )
}
