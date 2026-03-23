/**
 * Один пузырь сообщения (текст/голос/фото/видео/пост). React.memo — при «печатает» не ре-рендерим весь список.
 */
import { memo, createElement, Fragment, useRef, useState, type CSSProperties } from "react";
import { Clock, AlertCircle, Reply as ReplyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { formatMessageTime, isOutgoingMessageReadByPeer } from "../utils/format";
import { buildProfilePath } from "@/lib/profile-route";
import { extractFirstUrl } from "@/lib/link-preview";
import { parseExternalVideoUrl } from "@/lib/external-video";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { ExternalVideoEmbedCard } from "./ExternalVideoEmbedCard";
import { UserAvatar } from "@/components/UserAvatar";
import { VoiceMessagePlayer } from "@/components/VoiceMessagePlayer";
import { ShatterEffect } from "@/components/ShatterEffect";
import { CodeBlock } from "./CodeBlock";
import { PulseDmSentVideoNote } from "@/features/chat/components/pulse/PulseDmSentVideoNote";
import { useOfflineResolvedMediaUrl } from "@/hooks/useOfflineResolvedMediaUrl";
import { parseCodeSegments } from "../utils/code-detect";
import type { ApiMessage } from "../types";

function ChatInlineMediaThumb({
  src,
  type,
  onOpenMedia,
}: {
  src: string;
  type: "image" | "video";
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note") => void;
}) {
  const offlineReadySrc = useOfflineResolvedMediaUrl(src);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (offlineReadySrc && onOpenMedia) onOpenMedia(offlineReadySrc, type);
      }}
      className="block rounded-[10px] overflow-hidden max-w-[260px] w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      {type === "image" ? (
        <img
          src={offlineReadySrc}
          alt="Фото"
          className="max-h-[280px] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <video
          src={offlineReadySrc}
          className="max-h-[280px] max-w-[260px] w-full object-cover rounded-[10px]"
          playsInline
          muted
        />
      )}
    </button>
  );
}

/** Разбивает текст на фрагменты: URL — ссылки, @[Name](id) — ссылки на профиль */
function linkifyTextWithMentions(
  text: string,
  onMentionClick: (id: string) => void
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = /(https?:\/\/[^\s<>]+)|@\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index));
    }
    if (m[1]) {
      const url = m[1];
      parts.push(
        createElement(
          "a",
          {
            key: key++,
            href: url,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-primary underline underline-offset-1 break-all",
            onClick: (e: React.MouseEvent) => e.stopPropagation(),
          },
          url
        )
      );
    } else {
      const name = m[2];
      const id = m[3];
      const path = buildProfilePath({ publicId: id, userId: id });
      parts.push(
        createElement(
          "a",
          {
            key: key++,
            href: path,
            className: "text-primary font-medium underline underline-offset-1",
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onMentionClick(id);
            },
          },
          `@${name}`
        )
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) return text;
  if (parts.length === 1) return parts[0];
  return createElement(Fragment, {}, ...parts);
}

export type MessageBubbleColorPreset = "primary" | "slate" | "violet" | "sky";

const MSG_BUBBLE_CLASSES: Record<
  MessageBubbleColorPreset,
  { bubble: string; videoNoteBorder: string; replyBlock: string; footer: string; shatter: string }
> = {
  primary: {
    bubble:
      "bg-primary/15 dark:bg-primary text-foreground dark:text-primary-foreground border border-primary/30 dark:border-primary/80 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    videoNoteBorder: "border-primary-400/50 dark:border-primary-500/35",
    replyBlock: "bg-primary/15 dark:bg-primary/25 border-l-[3px] border-l-primary/50 dark:border-l-primary/60",
    footer: "text-primary-800/90 dark:text-primary-foreground/90",
    shatter: "bg-primary-100/90 dark:bg-primary-900/35",
  },
  slate: {
    bubble:
      "bg-slate-200 dark:bg-slate-600 text-foreground dark:text-white border border-slate-300/70 dark:border-slate-500/80 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    videoNoteBorder: "border-slate-400/50 dark:border-slate-500/35",
    replyBlock: "bg-slate-300/20 dark:bg-slate-600/20 border-l-[3px] border-l-slate-500/50 dark:border-l-slate-400/50",
    footer: "text-slate-700/90 dark:text-slate-300/90",
    shatter: "bg-slate-200/90 dark:bg-slate-800/70",
  },
  violet: {
    bubble:
      "bg-violet-200/95 dark:bg-violet-800/95 text-foreground dark:text-white border border-violet-300/70 dark:border-violet-500/80 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    videoNoteBorder: "border-violet-400/50 dark:border-violet-500/35",
    replyBlock: "bg-violet-300/20 dark:bg-violet-600/25 border-l-[3px] border-l-violet-500/50 dark:border-l-violet-400/50",
    footer: "text-violet-800/90 dark:text-violet-200/90",
    shatter: "bg-violet-100/90 dark:bg-violet-900/35",
  },
  sky: {
    bubble:
      "bg-sky-200/95 dark:bg-sky-800/95 text-foreground dark:text-white border border-sky-300/70 dark:border-sky-500/80 shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
    videoNoteBorder: "border-sky-400/50 dark:border-sky-500/35",
    replyBlock: "bg-sky-300/20 dark:bg-sky-600/25 border-l-[3px] border-l-sky-500/50 dark:border-l-sky-400/50",
    footer: "text-sky-800/90 dark:text-sky-200/90",
    shatter: "bg-sky-100/90 dark:bg-sky-900/35",
  },
};

export type ChatMessageRowProps = {
  msg: ApiMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isMe: boolean;
  isDm: boolean;
  senderName: string;
  /** Аватар отправителя (для групповых — из members; для DM — otherMember) */
  senderAvatarUrl: string | null;
  otherMemberId: string;
  lastReadAt: string | null;
  currentUserId: string;
  currentUserAvatarUrl: string | null;
  currentUserDisplayName: string;
  /** Пресет цвета пузыря своих сообщений (primary, slate, violet, sky) */
  messageBubbleColor?: MessageBubbleColorPreset;
  /** Активен chat vibe — заливка пузырей из CSS-переменных (PULSE-токены) */
  chatVibeActive?: boolean;
  /** Личный чат на мобиле: пузыри как MobileChatDark/Light (если vibe не перекрашивает текст) */
  pulseMobileDm?: "dark" | "light" | null;
  /** Акцент темы настроения для обводки входящих (hex #rrggbb) */
  pulseDmAccent?: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isShattering: boolean;
  showFooter: boolean;
  onPointerDown: (msg: ApiMessage, e: React.PointerEvent) => void;
  onPointerUp: (messageId: string) => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onOpenMenu: (msg: ApiMessage, rect: DOMRect) => void;
  onRetry: (msg: ApiMessage) => void;
  onQuickReply?: (msg: ApiMessage) => void;
  onScrollToReply: (id: string) => void;
  onShatterComplete: (id: string) => void;
  onOpenProfile: (authorId: string) => void;
  /** ID следующего голосового в чате (для «слушать следующее») */
  nextVoiceMessageId?: string | null;
  /** ID голосового, который сейчас воспроизводится (для автозапуска следующего) */
  activeVoiceId?: string | null;
  /** Вызывается при завершении воспроизведения голосового (передаётся ID следующего для автозапуска) */
  onVoiceEnded?: (nextVoiceMessageId: string | null) => void;
  /** Открыть медиа (фото/видео) во встроенном просмотрщике */
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note") => void;
  /** Переведённый текст (если есть перевод) */
  translatedText?: string | null;
};

function formatVideoNoteDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Расшифровка + перевод для видеокружка (как у голосового). */
function MediaTranscriptBlock({
  transcript,
  translatedTranscript,
}: {
  transcript?: string | null;
  translatedTranscript?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const main = translatedTranscript?.trim() || transcript?.trim();
  if (!main) return null;
  const hasOriginal =
    Boolean(translatedTranscript?.trim() && transcript?.trim()) &&
    translatedTranscript!.trim() !== transcript!.trim();
  return (
    <div className="mt-1 max-w-[220px]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        aria-expanded={open}
      >
        {open ? "Скрыть текст" : "Показать текст"}
      </button>
      {open && (
        <div className="mt-1 text-[11px] text-muted-foreground/85 leading-snug whitespace-pre-wrap break-words">
          <p>{main}</p>
          {hasOriginal ? <p className="mt-1 text-[10px] opacity-75">Оригинал: {transcript!.trim()}</p> : null}
        </div>
      )}
    </div>
  );
}

const VIDEO_NOTE_PREVIEW_SEC = 1.2;
const VIDEO_NOTE_PLAY_START_SEC = 0.15;

function VideoNoteBubble({
  src,
  isMe,
  bubbleColorPreset = "primary",
}: {
  src: string;
  isMe: boolean;
  bubbleColorPreset?: MessageBubbleColorPreset;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const borderClass = isMe ? MSG_BUBBLE_CLASSES[bubbleColorPreset].videoNoteBorder : "border-border/55";

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = false;
      if (video.currentTime < VIDEO_NOTE_PLAY_START_SEC || video.currentTime >= VIDEO_NOTE_PREVIEW_SEC) {
        video.currentTime = VIDEO_NOTE_PLAY_START_SEC;
      }
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  };

  return (
    <div className={cn("flex", isPlaying && "w-full justify-center")}>
      <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        togglePlayback();
      }}
      className={cn(
        "group relative block h-[176px] w-[176px] overflow-hidden rounded-full border shadow-md transition-transform duration-300 ease-out will-change-transform",
        isPlaying ? "z-10 scale-[1.4]" : "scale-100",
        borderClass
      )}
      aria-label={isPlaying ? "Пауза видеокружка" : "Воспроизвести видеокружок"}
    >
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full object-cover"
        playsInline
        muted={false}
        preload="auto"
        controls={false}
        onLoadedData={() => setPreviewReady(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          const target = e.currentTarget;
          const dur = Number.isFinite(target.duration) ? target.duration : null;
          setDurationSec(dur);
          // Берём ранний кадр (в районе 1с), чтобы превью стабильно появлялось на разных кодеках.
          if (dur != null && dur > 0.35 && target.paused) {
            const maxSeek = Math.max(0.2, dur - 0.12);
            const previewAt = Math.min(VIDEO_NOTE_PREVIEW_SEC, maxSeek);
            try {
              target.currentTime = previewAt;
            } catch {
              // Если seek не удался, оставляем первый доступный кадр.
            }
          }
        }}
        onSeeked={() => setPreviewReady(true)}
        onError={() => setPreviewReady(true)}
      />
      {!previewReady && (
        <div className="pointer-events-none absolute inset-0 bg-muted/70" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/95">
        {formatVideoNoteDuration(durationSec)}
      </span>
    </button>
    </div>
  );
}

function ChatMessageRowInner({
  msg,
  isFirstInGroup,
  isLastInGroup,
  isMe,
  isDm,
  senderName,
  senderAvatarUrl,
  otherMemberId,
  lastReadAt,
  currentUserId,
  currentUserAvatarUrl,
  currentUserDisplayName,
  messageBubbleColor = "primary",
  chatVibeActive = false,
  pulseMobileDm = null,
  pulseDmAccent = "#818cf8",
  isSelected,
  isHighlighted,
  isShattering,
  showFooter,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
  onOpenMenu,
  onRetry,
  onQuickReply,
  onScrollToReply,
  onShatterComplete,
  onOpenProfile,
  nextVoiceMessageId,
  activeVoiceId,
  onVoiceEnded,
  onOpenMedia,
  translatedText,
}: ChatMessageRowProps) {
  const bubbleStyles = MSG_BUBBLE_CLASSES[messageBubbleColor];
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartedRef = useRef(false);
  const swipeTriggeredRef = useRef(false);
  const swipeHapticTriggeredRef = useRef(false);
  const replyHintRef = useRef<HTMLDivElement | null>(null);
  const showSenderName = !isDm;
  const isMedia = msg.type === "voice" || msg.type === "image" || msg.type === "video" || msg.type === "video_note";
  // PULSE / Telegram: основной радиус 18px, хвост 4px, стык группы ~8px
  const bubbleRounding = isMe
    ? cn(
        "rounded-[18px]",
        isFirstInGroup && !isLastInGroup && "rounded-br-[18px] rounded-tr-[8px] rounded-tl-[18px] rounded-bl-[18px]",
        isLastInGroup && !isFirstInGroup && "rounded-tr-[18px] rounded-br-[4px] rounded-tl-[18px] rounded-bl-[18px]",
        isFirstInGroup && isLastInGroup && "rounded-br-[4px]",
        !isFirstInGroup && !isLastInGroup && "rounded-tr-[8px] rounded-br-[4px] rounded-tl-[18px] rounded-bl-[18px]"
      )
    : cn(
        "rounded-[18px]",
        isFirstInGroup && !isLastInGroup && "rounded-bl-[18px] rounded-tl-[8px] rounded-tr-[18px] rounded-br-[18px]",
        isLastInGroup && !isFirstInGroup && "rounded-tl-[18px] rounded-bl-[4px] rounded-tr-[18px] rounded-br-[18px]",
        isFirstInGroup && isLastInGroup && "rounded-bl-[4px]",
        !isFirstInGroup && !isLastInGroup && "rounded-tl-[8px] rounded-bl-[4px] rounded-tr-[18px] rounded-br-[18px]"
      );
  const vibeTextBubble = chatVibeActive && !isMedia && msg.type === "text";
  const pulseTextShell =
    Boolean(pulseMobileDm) && !isMedia && msg.type === "text" && !vibeTextBubble;
  const bubbleClasses = isMedia
    ? "p-0 rounded-[18px] overflow-hidden relative select-none touch-none bg-transparent"
    : cn(
        "px-2.5 py-1.5 relative select-none touch-none",
        vibeTextBubble
          ? isMe
            ? "text-white border-0 shadow-[0_1px_2px_rgba(0,0,0,0.14)]"
            : "text-foreground border border-black/[0.08] dark:border-white/10 shadow-[0_1px_1px_rgba(0,0,0,0.06)]"
          : pulseTextShell && pulseMobileDm === "dark"
            ? isMe
              ? "border border-indigo-400/35 bg-[rgba(79,70,229,0.92)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] backdrop-blur-md"
              : "border border-white/15 bg-white/[0.06] text-white/[0.9] shadow-[0_1px_2px_rgba(0,0,0,0.12)] backdrop-blur-md"
            : pulseTextShell && pulseMobileDm === "light"
              ? isMe
                ? "border-0 bg-[#6366f1] text-white shadow-[0_1px_2px_rgba(99,102,241,0.25)]"
                : "border border-black/[0.08] bg-white text-[#1a1a2e] shadow-sm"
              : isMe
                ? bubbleStyles.bubble
                : "bg-white dark:bg-slate-900/70 text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.06)] border border-slate-200/70 dark:border-slate-700/60",
        bubbleRounding
      );
  const vibeBubbleShadow =
    !vibeTextBubble && !isMedia && msg.type === "text"
      ? ({
          boxShadow: `inset 0 0 52px 0 ${isMe ? "var(--chat-vibe-bubble-out)" : "var(--chat-vibe-bubble-in)"}, 0 1px 1px rgba(0,0,0,0.06)`,
        } as CSSProperties)
      : undefined;
  const vibeFillStyle: CSSProperties | undefined = vibeTextBubble
    ? {
        backgroundColor: isMe ? "var(--chat-vibe-bubble-out)" : "var(--chat-vibe-bubble-in)",
      }
    : undefined;
  const pulseIncomingBorderStyle: CSSProperties | undefined =
    pulseTextShell && pulseMobileDm === "dark" && !isMe && pulseDmAccent.length === 7 && pulseDmAccent.startsWith("#")
      ? { borderColor: `${pulseDmAccent}33` }
      : undefined;
  const showAvatarOther = !isMe && !isDm && isLastInGroup;
  const showAvatarMe = false;

  const avatarSize = 30;
  const avatarClass = "w-[30px] h-[30px] rounded-full flex-shrink-0 mt-auto";
  return (
    <div
      key={msg.id}
      data-message-id={msg.id}
      className={cn(
        "flex w-full gap-1 animate-in fade-in slide-in-from-bottom-1 duration-200",
        isMe ? "justify-end" : "justify-start",
        isLastInGroup ? "mb-2" : "mb-0.5"
      )}
    >
      {showAvatarOther && (
        <UserAvatar avatarUrl={senderAvatarUrl ?? undefined} displayName={senderName} seed={msg.senderId ?? otherMemberId} size={avatarSize} className={avatarClass} />
      )}
      {!showAvatarOther && !isMe && !isDm && <div className="w-[30px] flex-shrink-0" />}
      <div className={cn("flex flex-col gap-0.5 min-w-0 max-w-[82%]", isMe ? "items-end" : "items-start")}>
        <div className={cn("relative w-fit max-w-full", isShattering && "pointer-events-none", msg.reactions && msg.reactions.length > 0 && "pb-5")}>
          <div
            ref={replyHintRef}
            className={cn(
              "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 rounded-full border border-border/70 bg-background/95 p-1.5 text-muted-foreground shadow-sm opacity-0",
              isMe ? "right-full mr-1" : "left-0 -ml-7"
            )}
            style={{ transform: "translateY(-50%) scale(0.9)", transition: "opacity 120ms ease-out, transform 120ms ease-out" }}
            aria-hidden
          >
            <ReplyIcon className="h-3.5 w-3.5" />
          </div>
          <div
            ref={bubbleRef}
            className={cn(bubbleClasses, "w-fit max-w-full", isSelected && "ring-2 ring-primary", isHighlighted && "ring-2 ring-primary animate-pulse")}
            style={{ ...vibeFillStyle, ...vibeBubbleShadow, ...pulseIncomingBorderStyle }}
            onPointerDown={(e) => {
              swipeStartXRef.current = e.clientX;
              swipeStartedRef.current = true;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              if (bubbleRef.current) bubbleRef.current.style.transition = "";
              try {
                onPointerDown(msg, e);
              } catch (err) {
                console.error("[ChatMessageRow] pointerdown failed:", err);
              }
            }}
            onPointerMove={(e) => {
              if (!swipeStartedRef.current || swipeStartXRef.current == null || !bubbleRef.current) return;
              const deltaX = e.clientX - swipeStartXRef.current;
              if (deltaX <= 0 || msg.type === "system" || msg.type === "missed_call") return;
              if (Math.abs(deltaX) > 24) onPointerLeave();
              bubbleRef.current.style.transform = `translateX(${Math.min(deltaX, 28)}px)`;
              if (replyHintRef.current) {
                const p = Math.max(0, Math.min(deltaX / 56, 1));
                replyHintRef.current.style.opacity = String(0.35 + p * 0.65);
                replyHintRef.current.style.transform = `translateY(-50%) scale(${0.9 + p * 0.1})`;
              }
              if (deltaX > 52) {
                swipeTriggeredRef.current = true;
                if (!swipeHapticTriggeredRef.current) {
                  triggerSelectionHaptic();
                  swipeHapticTriggeredRef.current = true;
                }
              }
            }}
            onPointerUp={() => {
              if (bubbleRef.current) {
                bubbleRef.current.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
                bubbleRef.current.style.transform = "translateX(0px)";
              }
              if (replyHintRef.current) {
                replyHintRef.current.style.opacity = "0";
                replyHintRef.current.style.transform = "translateY(-50%) scale(0.9)";
              }
              if (swipeTriggeredRef.current && onQuickReply && msg.type !== "system" && msg.type !== "missed_call") {
                onQuickReply(msg);
                swipeStartedRef.current = false;
                swipeStartXRef.current = null;
                swipeTriggeredRef.current = false;
                swipeHapticTriggeredRef.current = false;
                return;
              }
              swipeStartedRef.current = false;
              swipeStartXRef.current = null;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              onPointerUp(msg.id);
            }}
            onPointerCancel={() => {
              swipeStartedRef.current = false;
              swipeStartXRef.current = null;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              if (bubbleRef.current) {
                bubbleRef.current.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
                bubbleRef.current.style.transform = "translateX(0px)";
              }
              if (replyHintRef.current) {
                replyHintRef.current.style.opacity = "0";
                replyHintRef.current.style.transform = "translateY(-50%) scale(0.9)";
              }
              onPointerLeave();
            }}
            onPointerLeave={() => {
              swipeStartedRef.current = false;
              swipeStartXRef.current = null;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              if (bubbleRef.current) {
                bubbleRef.current.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
                bubbleRef.current.style.transform = "translateX(0px)";
              }
              if (replyHintRef.current) {
                replyHintRef.current.style.opacity = "0";
                replyHintRef.current.style.transform = "translateY(-50%) scale(0.9)";
              }
              onPointerLeave();
            }}
            onTouchStart={(e) => {
              const touch = e.changedTouches?.[0] || e.touches?.[0];
              if (touch) {
                swipeStartXRef.current = touch.clientX;
                swipeStartedRef.current = true;
                swipeTriggeredRef.current = false;
                swipeHapticTriggeredRef.current = false;
                try {
                  onPointerDown(msg, { clientX: touch.clientX, clientY: touch.clientY } as React.PointerEvent);
                } catch (err) {
                  console.error("[ChatMessageRow] touchstart->pointerdown failed:", err);
                }
              }
            }}
            onTouchMove={(e) => {
              const touch = e.changedTouches?.[0] || e.touches?.[0];
              if (!touch || !swipeStartedRef.current || swipeStartXRef.current == null || !bubbleRef.current) return;
              const deltaX = touch.clientX - swipeStartXRef.current;
              if (deltaX <= 0 || msg.type === "system" || msg.type === "missed_call") return;
              if (Math.abs(deltaX) > 24) onPointerLeave();
              bubbleRef.current.style.transform = `translateX(${Math.min(deltaX, 28)}px)`;
              if (replyHintRef.current) {
                const p = Math.max(0, Math.min(deltaX / 56, 1));
                replyHintRef.current.style.opacity = String(0.35 + p * 0.65);
                replyHintRef.current.style.transform = `translateY(-50%) scale(${0.9 + p * 0.1})`;
              }
              if (deltaX > 52) {
                swipeTriggeredRef.current = true;
                if (!swipeHapticTriggeredRef.current) {
                  triggerSelectionHaptic();
                  swipeHapticTriggeredRef.current = true;
                }
              }
            }}
            onTouchEnd={() => {
              if (bubbleRef.current) {
                bubbleRef.current.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
                bubbleRef.current.style.transform = "translateX(0px)";
              }
              if (replyHintRef.current) {
                replyHintRef.current.style.opacity = "0";
                replyHintRef.current.style.transform = "translateY(-50%) scale(0.9)";
              }
              if (swipeTriggeredRef.current && onQuickReply && msg.type !== "system" && msg.type !== "missed_call") {
                onQuickReply(msg);
                swipeStartedRef.current = false;
                swipeStartXRef.current = null;
                swipeTriggeredRef.current = false;
                swipeHapticTriggeredRef.current = false;
                return;
              }
              swipeStartedRef.current = false;
              swipeStartXRef.current = null;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              onPointerUp(msg.id);
            }}
            onContextMenu={(e) => {
              try {
                onContextMenu(e);
                if (msg.type !== "system" && msg.type !== "missed_call" && bubbleRef.current && onOpenMenu) {
                  onOpenMenu(msg, bubbleRef.current.getBoundingClientRect());
                }
              } catch (err) {
                console.error("[ChatMessageRow] contextmenu failed:", err);
              }
            }}
          >
            {msg.forwardedFromSenderName && <p className="text-[12px] text-muted-foreground mb-1">Переслано от {msg.forwardedFromSenderName}</p>}
            {(msg.replyTo || msg.replyToId) && (() => {
              const replyTargetId = msg.replyTo?.id ?? msg.replyToId ?? "";
              const replyAuthor =
                msg.replyTo?.senderId && msg.replyTo.senderId === currentUserId
                  ? "Вы"
                  : "Ответ";
              return (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (replyTargetId) onScrollToReply(replyTargetId); }}
                  className={cn(
                    "mb-2 min-w-0 w-full cursor-pointer rounded-[8px] border-l-[3px] py-1 pr-2 pl-2 text-left transition-opacity hover:opacity-90",
                    isMe
                      ? pulseMobileDm === "dark" && !isMedia && !vibeTextBubble
                        ? "bg-black/25 border-l-white/35"
                        : bubbleStyles.replyBlock
                      : pulseMobileDm === "dark" && !isMedia
                        ? "bg-white/[0.06] border-l-indigo-400/50"
                        : pulseMobileDm === "light" && !isMedia
                          ? "bg-slate-100/90 border-l-indigo-500/35"
                          : "bg-black/5 dark:bg-white/10 border-primary/45"
                  )}
                >
                  <p
                    className={cn(
                      "mb-0.5 text-[11px] font-semibold tracking-wide",
                      vibeTextBubble && isMe
                        ? "text-neutral-600 dark:text-white/55"
                        : "text-muted-foreground",
                    )}
                  >
                    {replyAuthor}
                  </p>
                  <p
                    className={cn(
                      "text-[13px] line-clamp-2 break-words leading-snug opacity-95",
                      vibeTextBubble && isMe && "text-neutral-900/92 dark:text-white/92",
                    )}
                  >
                    {msg.replyTo
                      ? msg.replyTo.type === "text"
                        ? msg.replyTo.content
                        : msg.replyTo.type === "voice"
                          ? "Голосовое сообщение"
                          : msg.replyTo.type === "image"
                            ? "Фото"
                            : msg.replyTo.type === "video_note"
                              ? "Видеокружок"
                              : msg.replyTo.type
                      : "Сообщение"}
                  </p>
                </button>
              );
            })()}
            {msg.type === "voice" ? (
              (() => {
                const rawContent = typeof msg.content === "string" ? msg.content.trim() : "";
                const voiceSrc = rawContent ? resolveUrl(rawContent) : "";
                if (!voiceSrc) return <span className="text-sm text-muted-foreground">Голосовое сообщение (недоступно)</span>;
                return (
                  <VoiceMessagePlayer
                    src={voiceSrc}
                    isMe={isMe}
                    bubbleColorPreset={messageBubbleColor}
                    transcript={msg.transcript}
                    translatedTranscript={translatedText}
                    onEnded={onVoiceEnded ? () => onVoiceEnded(nextVoiceMessageId ?? null) : undefined}
                    autoPlay={activeVoiceId === msg.id}
                  />
                );
              })()
            ) : msg.type === "image" ? (
              <ChatInlineMediaThumb
                src={resolveUrl(msg.content)}
                type="image"
                onOpenMedia={onOpenMedia}
              />
            ) : msg.type === "video" ? (
              <ChatInlineMediaThumb
                src={resolveUrl(msg.content)}
                type="video"
                onOpenMedia={onOpenMedia}
              />
            ) : msg.type === "video_note" ? (
              <>
                {pulseMobileDm && isMe ? (
                  <PulseDmSentVideoNote
                    src={resolveUrl(msg.content)}
                    accentColor={pulseDmAccent}
                    footerLabel={
                      msg.sendStatus === "sending" || msg.sendStatus === "failed"
                        ? null
                        : (() => {
                            const t = formatMessageTime(msg.createdAt);
                            const isRead = isOutgoingMessageReadByPeer(msg.createdAt, lastReadAt);
                            return isRead ? `${t} ✓✓` : `${t} ✓`;
                          })()
                    }
                  />
                ) : (
                  <VideoNoteBubble src={resolveUrl(msg.content)} isMe={isMe} bubbleColorPreset={messageBubbleColor} />
                )}
                <MediaTranscriptBlock transcript={msg.transcript} translatedTranscript={translatedText} />
              </>
            ) : msg.type === "post_share" ? (
              (() => {
                let preview: { postId?: string; text?: string; imageUrl?: string | null; authorName?: string; authorId?: string } = {};
                try { preview = JSON.parse(msg.content); } catch {}
                const authorId = preview.authorId ?? "";
                const authorName = preview.authorName ?? "Пользователь";
                return (
                  <div className="max-w-[240px] rounded-[10px] overflow-hidden border border-border/50 bg-muted/30 dark:bg-white/5">
                    {preview.imageUrl && <img src={resolveUrl(preview.imageUrl)} alt="" className="w-full max-h-[200px] object-cover" loading="lazy" decoding="async" />}
                    <div className="p-2">
                      <p className="text-[13px] line-clamp-2 text-foreground/90">{preview.text || "Пост"}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{authorName}</p>
                      <button type="button" className="mt-2 text-xs text-primary font-medium hover:underline" onClick={() => onOpenProfile(authorId)}>Открыть пост</button>
                    </div>
                  </div>
                );
              })()
            ) : msg.type === "story_reply" ? (
              (() => {
                let payload: {
                  storyId?: string;
                  mediaUrl?: string;
                  thumbnailUrl?: string;
                  authorId?: string;
                  authorName?: string;
                  authorAvatar?: string;
                  storyTimeLabel?: string;
                  replyText?: string;
                } = {};
                try {
                  payload = JSON.parse(msg.content);
                } catch {
                  payload = { replyText: msg.content };
                }
                const mediaRaw = payload.mediaUrl ? resolveUrl(payload.mediaUrl) : "";
                const thumbRaw = payload.thumbnailUrl ? resolveUrl(payload.thumbnailUrl) : "";
                const isVideo = isLikelyStoryVideoUrl(mediaRaw);
                const posterSrc = thumbRaw || (!isVideo ? mediaRaw : "");
                const authorName = payload.authorName || "История";
                return (
                  <div className="max-w-[min(240px,72vw)] rounded-[12px] overflow-hidden border border-border/50 bg-muted/30 dark:bg-white/5">
                    {mediaRaw && (
                      <div className="relative w-full aspect-[9/16] bg-black/40">
                        {isVideo ? (
                          <video
                            src={mediaRaw}
                            className="absolute inset-0 h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            poster={posterSrc || undefined}
                            aria-label="Превью сториз"
                          />
                        ) : (
                          <img
                            src={posterSrc || mediaRaw}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-[11px] text-muted-foreground">Репост сториз</p>
                      <p className="text-[13px] font-medium mt-0.5">{authorName}</p>
                      {payload.storyTimeLabel && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{payload.storyTimeLabel}</p>
                      )}
                      {payload.replyText && (
                        <p className="text-[13px] leading-snug whitespace-pre-wrap break-words text-foreground/90 mt-2 border-t border-border/40 pt-2">
                          {payload.replyText}
                        </p>
                      )}
                      {payload.authorId && (
                        <button
                          type="button"
                          className="mt-2 text-xs text-primary font-medium hover:underline"
                          onClick={() => onOpenProfile(payload.authorId!)}
                        >
                          Профиль автора
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                {(() => {
                  const displayText = translatedText || msg.content;
                  const segments = parseCodeSegments(displayText);
                  const hasCode = segments.some((s) => s.type === "code");
                  if (hasCode) {
                    return (
                      <div className="max-w-[min(280px,80vw)]">
                        {segments.map((seg, i) =>
                          seg.type === "code" ? (
                            <CodeBlock key={i} code={seg.content} lang={seg.lang} className="my-1" />
                          ) : (
                            <p key={i} className="text-[14px] leading-[1.32] break-words whitespace-pre-wrap">
                              {linkifyTextWithMentions(seg.content, onOpenProfile)}
                            </p>
                          ),
                        )}
                      </div>
                    );
                  }
                  return (
                    <p className="text-[14px] leading-[1.32] break-words whitespace-pre-wrap max-w-[min(240px,72vw)]">
                      {linkifyTextWithMentions(displayText, onOpenProfile)}
                    </p>
                  );
                })()}
                {msg.type === "text" && (() => {
                  const url = extractFirstUrl(msg.content);
                  if (!url) return null;
                  const externalVideo = parseExternalVideoUrl(url);
                  return externalVideo ? <ExternalVideoEmbedCard url={url} /> : <LinkPreviewCard url={url} />;
                })()}
              </>
            )}
            {showFooter && (
              <div
                className={cn(
                  "text-[11px] flex justify-end items-center gap-0.5",
                  isMedia ? "mt-1 px-0.5" : "mt-0.5",
                  vibeTextBubble && isMe
                    ? "text-white/85"
                    : pulseTextShell && pulseMobileDm === "dark" && isMe
                      ? "text-white/65"
                      : pulseTextShell && pulseMobileDm === "light" && isMe
                        ? "text-white/85"
                        : isMe && !isMedia
                          ? bubbleStyles.footer
                          : "text-muted-foreground",
                )}
              >
                {formatMessageTime(msg.createdAt)}
                {isMe && (() => {
                  if (msg.sendStatus === "sending") return <span className="inline-flex items-center gap-0.5" title="Отправляется"><Clock className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" aria-hidden /></span>;
                  if (msg.sendStatus === "failed") return (
                    <span className="inline-flex items-center gap-1">
                      <span title="Ошибка отправки"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden /></span>
                      <button type="button" className="text-[10px] font-medium underline underline-offset-1 hover:opacity-100 opacity-90" onClick={(e) => { e.stopPropagation(); onRetry(msg); }}>Повторить</button>
                    </span>
                  );
                  const isRead = isOutgoingMessageReadByPeer(msg.createdAt, lastReadAt);
                  const title = isRead && lastReadAt ? `Прочитано · ${formatMessageTime(lastReadAt)}` : "Доставлено";
                  const checkGlow = vibeTextBubble
                    ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.45)]"
                    : pulseTextShell && pulseMobileDm === "dark" && isMe
                      ? "drop-shadow-[0_0_5px_rgba(165,180,252,0.55)]"
                      : "drop-shadow-[0_0_5px_hsl(var(--primary)/0.6)]";
                  return (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5",
                        isRead &&
                          (vibeTextBubble
                            ? "text-white"
                            : pulseTextShell && pulseMobileDm === "dark" && isMe
                              ? "text-indigo-200"
                              : pulseTextShell && pulseMobileDm === "light" && isMe
                                ? "text-white"
                                : "text-primary"),
                      )}
                      title={title}
                    >
                      <svg className={cn("w-3 h-3 flex-shrink-0", isRead && checkGlow)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                      {isRead && <svg className={cn("w-3 h-3 flex-shrink-0 -ml-2.25", checkGlow)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
          {msg.reactions && msg.reactions.length > 0 && (
            <div className={cn("absolute bottom-0 flex flex-wrap gap-1 pointer-events-none", isMe ? "right-0 justify-end" : "left-0 justify-start")} style={{ bottom: 2, transition: "opacity 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}>
            {msg.reactions.map((r) => (
              <span key={r.emoji} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] bg-background/95 text-foreground/90 border border-border/50 shadow-sm">
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="opacity-80 tabular-nums">{r.count}</span>}
              </span>
            ))}
          </div>
          )}
          {isShattering && <ShatterEffect className="absolute inset-0 rounded-[18px]" shardClassName={isMe ? bubbleStyles.shatter : "bg-white/85 dark:bg-slate-900/70"} onComplete={() => onShatterComplete(msg.id)} />}
        </div>
        {showSenderName && isLastInGroup && (
          <span className={cn("text-[10px] font-medium text-muted-foreground/80 mt-0.5 px-1", isMe && "text-right")}>
            {senderName}
          </span>
        )}
      </div>
      {showAvatarMe && <UserAvatar avatarUrl={currentUserAvatarUrl ?? undefined} displayName={currentUserDisplayName ?? "Вы"} seed={msg.senderId ?? ""} size={avatarSize} className={avatarClass} />}
      {!showAvatarMe && isMe && <div className="w-[30px] flex-shrink-0" />}
    </div>
  );
}

export const ChatMessageRow = memo(ChatMessageRowInner);
