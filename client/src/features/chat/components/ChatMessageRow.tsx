/**
 * Один пузырь сообщения (текст/голос/фото/видео/пост). React.memo — при «печатает» не ре-рендерим весь список.
 */
import { memo, createElement, Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { Play, Reply as ReplyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import {
  formatMessageTime,
  isOutgoingMessageReadByPeer,
  outgoingDeliveryAriaLabel,
  outgoingDeliveryPulseFooterLabel,
  outgoingDeliveryTitle,
  incomingMessageFooterAria,
} from "../utils/format";
import { OutgoingMessageFooter } from "./OutgoingMessageFooter";
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
import { ChatPdfAttachment } from "@/features/chat/components/ChatPdfAttachment";
import { useOfflineResolvedMediaUrl } from "@/hooks/useOfflineResolvedMediaUrl";
import { usePrefersReducedMotion } from "@/lib/motion";
import { parseCodeSegments } from "../utils/code-detect";
import { ChatTableBubble, parseTablePayloadFromFenceBody } from "../message-table";
import { deriveVideoNotePosterUrl } from "../utils/video-note-poster";
import { VideoNoteBubble } from "@/features/chat/components/video-note/VideoNoteBubble";
import { registerChatMessageMediaPlaybackPauser } from "@/features/chat/chat-message-media-playback-interrupt";
import type { ApiMessage } from "../types";

const CHAT_INLINE_VIDEO_DOUBLE_TAP_MS = 320;
/** Двойной тап по пузырю сообщения → реакция ❤️ (как в сториз / ленте). */
const CHAT_MESSAGE_DOUBLE_TAP_MS = 320;
const CHAT_MESSAGE_DOUBLE_TAP_MAX_DIST_PX = 56;

function ChatInlineMediaThumb({
  src,
  onOpenMedia,
}: {
  src: string;
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note" | "pdf", title?: string) => void;
}) {
  const offlineReadySrc = useOfflineResolvedMediaUrl(src);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (offlineReadySrc && onOpenMedia) onOpenMedia(offlineReadySrc, "image");
      }}
      className="block rounded-[10px] overflow-hidden max-w-[260px] w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <img
        src={offlineReadySrc}
        alt="Фото"
        className="max-h-[280px] w-full object-cover select-auto"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </button>
  );
}

/** Видео в чате: один тап — play/pause в пузыре (+25% при воспроизведении); двойной — полноэкранный просмотр. */
function ChatInlineVideoThumb({
  src,
  onOpenMedia,
}: {
  src: string;
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note" | "pdf", title?: string) => void;
}) {
  const offlineReadySrc = useOfflineResolvedMediaUrl(src);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapMsRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => setPlaying(!v.paused);
    const onEnded = () => setPlaying(false);
    v.addEventListener("play", sync);
    v.addEventListener("pause", sync);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", sync);
      v.removeEventListener("pause", sync);
      v.removeEventListener("ended", onEnded);
    };
  }, [offlineReadySrc]);

  useEffect(() => {
    return registerChatMessageMediaPlaybackPauser(() => {
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    });
  }, []);

  const openViewer = () => {
    if (!offlineReadySrc || !onOpenMedia) return;
    videoRef.current?.pause();
    onOpenMedia(offlineReadySrc, "video");
  };

  const toggleInline = () => {
    const el = videoRef.current;
    if (!el) return;
    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
    if (el.paused) {
      el.muted = false;
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    } else {
      el.pause();
    }
  };

  const onClickVideo = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!offlineReadySrc) return;
    if (e.detail === 2) {
      lastTapMsRef.current = 0;
      openViewer();
      return;
    }
    const now = Date.now();
    if (now - lastTapMsRef.current < CHAT_INLINE_VIDEO_DOUBLE_TAP_MS) {
      lastTapMsRef.current = 0;
      openViewer();
      return;
    }
    lastTapMsRef.current = now;
    toggleInline();
  };

  if (!offlineReadySrc) {
    return (
      <div className="flex max-h-[280px] max-w-[260px] items-center justify-center rounded-[10px] bg-muted/30 px-3 py-6 text-xs text-muted-foreground">
        Видео недоступно
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClickVideo}
      className={cn(
        "relative block w-full max-w-[260px] touch-manipulation rounded-[10px] text-left outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        !reducedMotion && "transition-transform duration-200 ease-out",
        playing && "scale-[1.25]",
        "origin-center will-change-transform",
      )}
      aria-label={
        playing
          ? "Пауза. Двойное нажатие — открыть на весь экран"
          : "Воспроизвести в чате. Двойное нажатие — открыть на весь экран"
      }
    >
      <video
        ref={videoRef}
        src={offlineReadySrc}
        className="pointer-events-none max-h-[280px] w-full max-w-[260px] rounded-[10px] object-cover"
        playsInline
        muted
        preload="metadata"
        controls={false}
      />
      {!playing ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/25">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-md">
            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
          </span>
        </span>
      ) : null}
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
  onOpenSharedTarget?: (target:
    | { type: "post"; postId: string; authorId?: string }
    | { type: "story"; storyId: string; authorId?: string }
    | { type: "comment"; postId: string; commentId: string; authorId?: string }) => void;
  /** ID следующего голосового в чате (для «слушать следующее») */
  nextVoiceMessageId?: string | null;
  /** Сырой URL следующего голосового — preload, пока играет текущее */
  nextVoiceSrc?: string | null;
  /** ID голосового, который сейчас воспроизводится (для автозапуска следующего) */
  activeVoiceId?: string | null;
  /** Вызывается при завершении воспроизведения голосового (передаётся ID следующего для автозапуска) */
  onVoiceEnded?: (nextVoiceMessageId: string | null) => void;
  /** ID следующего видеокружка в чате (для «смотреть следующее») */
  nextVideoNoteMessageId?: string | null;
  /** ID видеокружка, который сейчас воспроизводится (для автозапуска следующего). */
  activeVideoNoteId?: string | null;
  /** Вызывается при завершении видеокружка (передаётся ID следующего). */
  onVideoNoteEnded?: (nextVideoNoteMessageId: string | null) => void;
  /** Открыть медиа (фото/видео) во встроенном просмотрщике */
  onOpenMedia?: (src: string, type: "image" | "video" | "video_note" | "pdf", title?: string) => void;
  /** Переведённый текст (если есть перевод) */
  translatedText?: string | null;
  /** Идёт догрузка перевода по API (показываем короткую подпись) */
  translationPending?: boolean;
  /** Двойной тап / быстрый второй тап — поставить или снять реакцию «сердечко» по умолчанию */
  onDoubleTapDefaultReaction?: (msg: ApiMessage) => void;
};

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
        <div className="uix-select-text mt-1 text-[11px] text-muted-foreground/85 leading-snug whitespace-pre-wrap break-words">
          <p>{main}</p>
          {hasOriginal ? <p className="mt-1 text-[10px] opacity-75">Оригинал: {transcript!.trim()}</p> : null}
        </div>
      )}
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
  onOpenSharedTarget,
  nextVoiceMessageId,
  nextVoiceSrc,
  activeVoiceId,
  onVoiceEnded,
  nextVideoNoteMessageId,
  activeVideoNoteId,
  onVideoNoteEnded,
  onOpenMedia,
  translatedText,
  translationPending = false,
  onDoubleTapDefaultReaction,
}: ChatMessageRowProps) {
  const bubbleStyles = MSG_BUBBLE_CLASSES[messageBubbleColor];
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const doubleTapRef = useRef<{ id: string; at: number; x: number; y: number } | null>(null);
  /** iOS: и pointerup, и touchend — без дубля одного «отпускания». */
  const lastBubbleFinishAtRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartedRef = useRef(false);
  const swipeTriggeredRef = useRef(false);
  const swipeHapticTriggeredRef = useRef(false);
  const replyHintRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (msg.type !== "voice") return;
    if (activeVoiceId !== msg.id) return;
    const raw = typeof nextVoiceSrc === "string" ? nextVoiceSrc.trim() : "";
    if (!raw) return;
    const href = resolveUrl(raw);
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "audio";
    link.href = href;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [msg.type, msg.id, activeVoiceId, nextVoiceSrc]);
  const showSenderName = !isDm;
  const isMedia =
    msg.type === "voice" ||
    msg.type === "image" ||
    msg.type === "video" ||
    msg.type === "video_note" ||
    msg.type === "sticker" ||
    msg.type === "file";
  const isStoryReply = msg.type === "story_reply";
  const isPostShare = msg.type === "post_share";
  const isCommentShare = msg.type === "comment_share";
  const isStructuredShare = isStoryReply || isPostShare || isCommentShare;
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
  const bubbleClasses = isStructuredShare
    ? "p-0 overflow-visible relative select-none touch-none bg-transparent border-0 shadow-none"
    : isMedia
    ? cn(
        "p-0 rounded-[18px] relative select-none touch-none bg-transparent",
        msg.type === "video" || msg.type === "video_note"
          ? "overflow-visible z-[1]"
          : "overflow-hidden",
      )
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
  const pulseStructuredSnippet = Boolean(pulseMobileDm) && isStructuredShare;
  const pulseStructuredIncomingBorderStyle: CSSProperties | undefined =
    pulseStructuredSnippet && pulseMobileDm === "dark" && !isMe && pulseDmAccent.length === 7 && pulseDmAccent.startsWith("#")
      ? { borderColor: `${pulseDmAccent}33` }
      : undefined;
  /** Текст под превью — пузырь; превью без внешнего пузыря. В PULSE DM те же оттенки, что у текстовых сообщений. */
  const attachedSnippetBubble = cn(
    "px-2.5 py-1.5 relative w-fit max-w-full min-w-0",
    pulseStructuredSnippet && pulseMobileDm === "dark"
      ? isMe
        ? "border border-indigo-400/35 bg-[rgba(79,70,229,0.92)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.22)] backdrop-blur-md"
        : "border border-white/15 bg-white/[0.06] text-white/[0.9] shadow-[0_1px_2px_rgba(0,0,0,0.12)] backdrop-blur-md"
      : pulseStructuredSnippet && pulseMobileDm === "light"
        ? isMe
          ? "border-0 bg-[#6366f1] text-white shadow-[0_1px_2px_rgba(99,102,241,0.25)]"
          : "border border-black/[0.08] bg-white text-[#1a1a2e] shadow-sm"
        : isMe
          ? bubbleStyles.bubble
          : "bg-white dark:bg-slate-900/70 text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.06)] border border-slate-200/70 dark:border-slate-700/60",
    bubbleRounding,
  );
  const pulseFooterShell = pulseTextShell || pulseStructuredSnippet;
  /** Склейка превью и текстового пузыря: чуть плоские стыки. */
  const structuredPreviewClass = (attachBottom: boolean) =>
    cn(
      "relative w-full overflow-hidden text-left outline-none transition-opacity duration-150",
      "ring-1 ring-black/[0.07] dark:ring-white/[0.09]",
      "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      attachBottom ? "rounded-t-[12px] rounded-b-[5px]" : "rounded-[12px]",
    );
  const structuredStackClass = "flex w-full max-w-[min(240px,72vw)] flex-col gap-1";
  /** Пузырь текста плотнее к превью сверху (общий радиус стыка). */
  const attachedSnippetUnderVisual = "!rounded-tl-[10px] !rounded-tr-[10px]";
  const structuredMetaLinkBtn =
    "inline-flex min-h-[var(--uix-touch-min)] shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium text-primary hover:underline";
  const vibeBubbleShadow =
    !vibeTextBubble && !isMedia && msg.type === "text"
      ? ({
          boxShadow: `inset 0 0 52px 0 ${isMe ? "var(--chat-vibe-bubble-out)" : "var(--chat-vibe-bubble-in)"}, 0 1px 1px rgba(0,0,0,0.06)`,
          transition:
            "background-color var(--chat-vibe-token-transition) var(--uix-easing-out), box-shadow var(--chat-vibe-token-transition) var(--uix-easing-out), border-color var(--chat-vibe-token-transition) var(--uix-easing-out)",
        } as CSSProperties)
      : undefined;
  const vibeFillStyle: CSSProperties | undefined = vibeTextBubble
    ? {
        backgroundColor: isMe ? "var(--chat-vibe-bubble-out)" : "var(--chat-vibe-bubble-in)",
        transition:
          "background-color var(--chat-vibe-token-transition) var(--uix-easing-out), box-shadow var(--chat-vibe-token-transition) var(--uix-easing-out), border-color var(--chat-vibe-token-transition) var(--uix-easing-out)",
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

  const finishBubblePointer = (clientX: number, clientY: number) => {
    const mono = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (mono - lastBubbleFinishAtRef.current < 40) return;
    lastBubbleFinishAtRef.current = mono;

    if (bubbleRef.current) {
      bubbleRef.current.style.transition = "transform 140ms cubic-bezier(0.22, 1, 0.36, 1)";
      bubbleRef.current.style.transform = "translateX(0px)";
    }
    if (replyHintRef.current) {
      replyHintRef.current.style.opacity = "0";
      replyHintRef.current.style.transform = "translateY(-50%) scale(0.9)";
    }
    const swipeDidReply =
      swipeTriggeredRef.current &&
      Boolean(onQuickReply) &&
      msg.type !== "system" &&
      msg.type !== "missed_call";
    if (swipeDidReply) {
      onQuickReply!(msg);
      swipeStartedRef.current = false;
      swipeStartXRef.current = null;
      swipeTriggeredRef.current = false;
      swipeHapticTriggeredRef.current = false;
      onPointerUp(msg.id);
      return;
    }
    swipeStartedRef.current = false;
    swipeStartXRef.current = null;
    swipeTriggeredRef.current = false;
    swipeHapticTriggeredRef.current = false;

    if (
      onDoubleTapDefaultReaction &&
      !isSelected &&
      !isShattering &&
      msg.type !== "system" &&
      msg.type !== "missed_call"
    ) {
      const now = Date.now();
      const prev = doubleTapRef.current;
      const isDouble =
        prev != null &&
        prev.id === msg.id &&
        now - prev.at <= CHAT_MESSAGE_DOUBLE_TAP_MS &&
        Math.hypot(clientX - prev.x, clientY - prev.y) < CHAT_MESSAGE_DOUBLE_TAP_MAX_DIST_PX;
      if (isDouble) {
        doubleTapRef.current = null;
        onDoubleTapDefaultReaction(msg);
      } else {
        doubleTapRef.current = { id: msg.id, at: now, x: clientX, y: clientY };
      }
    } else {
      doubleTapRef.current = null;
    }

    onPointerUp(msg.id);
  };

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
            data-chat-swipe-back-ignore
            className={cn(
              bubbleClasses,
              "w-fit max-w-full",
              msg.sendStatus === "sending" && "animate-in fade-in zoom-in-95 duration-150",
              isSelected && "ring-2 ring-primary",
              isHighlighted && "ring-2 ring-primary animate-pulse"
            )}
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
            onPointerUp={(e) => finishBubblePointer(e.clientX, e.clientY)}
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
            onTouchEnd={(e) => {
              const touch = e.changedTouches?.[0];
              if (touch) finishBubblePointer(touch.clientX, touch.clientY);
              else finishBubblePointer(0, 0);
            }}
            onContextMenu={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("img")) {
                return;
              }
              if ((msg.type === "video" || msg.type === "video_note") && target.closest("video")) {
                return;
              }
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
                            : msg.replyTo.type === "sticker"
                              ? "Стикер"
                              : msg.replyTo.type === "video_note"
                              ? "Видеокружок"
                              : msg.replyTo.type === "file"
                                ? `PDF · ${msg.replyTo.content}`
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
                  <>
                    <VoiceMessagePlayer
                      src={voiceSrc}
                      isMe={isMe}
                      bubbleColorPreset={messageBubbleColor}
                      chatVibeActive={chatVibeActive}
                      transcript={msg.transcript}
                      translatedTranscript={translatedText}
                      onEnded={onVoiceEnded ? () => onVoiceEnded(nextVoiceMessageId ?? null) : undefined}
                      autoPlay={activeVoiceId === msg.id}
                      uploadProgress={msg.localUploadProgress ?? null}
                    />
                    {translationPending && !translatedText?.trim() && msg.transcript?.trim() ? (
                      <p className="text-[10px] text-muted-foreground/75 mt-1" aria-live="polite">
                        Перевод расшифровки…
                      </p>
                    ) : null}
                  </>
                );
              })()
            ) : msg.type === "sticker" ? (
              (() => {
                const raw = typeof msg.content === "string" ? msg.content.trim() : "";
                let stickerSrc = "";
                try {
                  const o = JSON.parse(raw) as { imageUrl?: string };
                  if (typeof o.imageUrl === "string") stickerSrc = resolveUrl(o.imageUrl);
                } catch {
                  /* noop */
                }
                if (!stickerSrc) {
                  return <span className="text-sm text-muted-foreground">Стикер</span>;
                }
                return (
                  <button
                    type="button"
                    className="inline-flex max-w-[min(220px,72vw)] items-center justify-center rounded-xl bg-transparent p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => onOpenMedia?.(stickerSrc, "image", "sticker.webp")}
                    aria-label="Открыть стикер"
                  >
                    <img
                      src={stickerSrc}
                      alt=""
                      className="max-h-[min(200px,40vh)] w-auto max-w-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                );
              })()
            ) : msg.type === "image" ? (
              <ChatInlineMediaThumb src={resolveUrl(msg.content)} onOpenMedia={onOpenMedia} />
            ) : msg.type === "video" ? (
              <ChatInlineVideoThumb src={resolveUrl(msg.content)} onOpenMedia={onOpenMedia} />
            ) : msg.type === "file" ? (
              <ChatPdfAttachment
                content={msg.content}
                isMe={isMe}
                disabled={msg.sendStatus === "sending"}
                onOpenPreview={
                  onOpenMedia ? (src, fileName) => onOpenMedia(src, "pdf", fileName) : undefined
                }
              />
            ) : msg.type === "video_note" ? (
              <>
                {pulseMobileDm && isMe ? (
                  (() => {
                    const vnRead = isOutgoingMessageReadByPeer(msg.createdAt, lastReadAt);
                    const vnFooter = outgoingDeliveryPulseFooterLabel(msg.createdAt, vnRead, msg.sendStatus);
                    const vnHintTitle = outgoingDeliveryTitle(vnRead, lastReadAt, msg.sendStatus);
                    const vnHintAria = vnFooter
                      ? `${formatMessageTime(msg.createdAt)}, ${outgoingDeliveryAriaLabel(vnRead, lastReadAt, msg.sendStatus)}`
                      : null;
                    return (
                  <PulseDmSentVideoNote
                    src={resolveUrl(msg.content)}
                    posterSrc={(() => {
                      const raw = msg.videoPosterUrl ?? deriveVideoNotePosterUrl(msg.content);
                      return raw ? resolveUrl(raw) : null;
                    })()}
                    accentColor={pulseDmAccent}
                    footerLabel={vnFooter}
                    footerHintTitle={vnFooter ? vnHintTitle : null}
                    footerHintAria={vnHintAria}
                    uploadProgress={msg.localUploadProgress ?? null}
                    autoPlay={activeVideoNoteId === msg.id}
                    onEnded={onVideoNoteEnded ? () => onVideoNoteEnded(nextVideoNoteMessageId ?? null) : undefined}
                  />
                    );
                  })()
                ) : (
                  <VideoNoteBubble
                    src={resolveUrl(msg.content)}
                    posterSrc={(() => {
                      const raw = msg.videoPosterUrl ?? deriveVideoNotePosterUrl(msg.content);
                      return raw ? resolveUrl(raw) : null;
                    })()}
                    isMe={isMe}
                    borderClass={isMe ? bubbleStyles.videoNoteBorder : "border-border/55"}
                    uploadProgress={msg.localUploadProgress ?? null}
                    autoPlay={activeVideoNoteId === msg.id}
                    onEnded={onVideoNoteEnded ? () => onVideoNoteEnded(nextVideoNoteMessageId ?? null) : undefined}
                  />
                )}
                <MediaTranscriptBlock transcript={msg.transcript} translatedTranscript={translatedText} />
                {translationPending && !translatedText?.trim() && msg.transcript?.trim() ? (
                  <p className="text-[10px] text-muted-foreground/75 mt-0.5" aria-live="polite">
                    Перевод расшифровки…
                  </p>
                ) : null}
              </>
            ) : msg.type === "post_share" ? (
              (() => {
                let preview: { postId?: string; text?: string; imageUrl?: string | null; authorName?: string; authorId?: string } = {};
                try { preview = JSON.parse(msg.content); } catch {}
                const postId = preview.postId ?? "";
                const authorId = preview.authorId ?? "";
                const authorName = preview.authorName ?? "Пользователь";
                const canOpenPost = Boolean(postId && onOpenSharedTarget);
                const imageRaw = preview.imageUrl ? resolveUrl(preview.imageUrl) : "";
                const postBody = (preview.text ?? "").trim();
                const openPost = () => {
                  if (postId && onOpenSharedTarget) {
                    onOpenSharedTarget({ type: "post", postId, authorId: authorId || undefined });
                    return;
                  }
                  if (authorId) onOpenProfile(authorId);
                };
                const showTextBubble = postBody.length > 0 || !imageRaw;
                const connectSnippet = Boolean(imageRaw && showTextBubble);
                return (
                  <div className={structuredStackClass}>
                    {imageRaw ? (
                      <button
                        type="button"
                        disabled={!canOpenPost}
                        onClick={openPost}
                        className={cn(
                          structuredPreviewClass(connectSnippet),
                          "bg-black/20 dark:bg-black/35",
                          canOpenPost ? "cursor-pointer active:opacity-90" : "cursor-default opacity-90",
                        )}
                        aria-label={canOpenPost ? "Открыть пост" : "Превью поста"}
                      >
                        <img
                          src={imageRaw}
                          alt=""
                          className="max-h-[min(200px,42vh)] w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ) : null}
                    <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1 px-0.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground">Пост</p>
                        <p className="text-[12px] font-semibold leading-tight text-foreground/95">{authorName}</p>
                      </div>
                      {!canOpenPost ? (
                        <span className="inline-flex shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Недоступно
                        </span>
                      ) : null}
                      {canOpenPost && !imageRaw ? (
                        <button type="button" className={structuredMetaLinkBtn} onClick={openPost}>
                          Открыть пост
                        </button>
                      ) : null}
                    </div>
                    {showTextBubble ? (
                      <div
                        className={cn(attachedSnippetBubble, connectSnippet && attachedSnippetUnderVisual)}
                        style={pulseStructuredIncomingBorderStyle}
                      >
                        <p className="text-[14px] leading-[1.32] line-clamp-8 break-words text-foreground/90">{postBody || "Пост"}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ) : msg.type === "comment_share" ? (
              (() => {
                let payload: { postId?: string; commentId?: string; text?: string; authorName?: string; authorId?: string; postPreview?: string } = {};
                try {
                  payload = JSON.parse(msg.content);
                } catch {
                  payload = { text: msg.content };
                }
                const authorName = payload.authorName || "Комментарий";
                const text = payload.text?.trim() || "Комментарий";
                const canOpenComment = Boolean(payload.postId && payload.commentId && onOpenSharedTarget);
                const postPreview = (payload.postPreview ?? "").trim();
                const openComment = () => {
                  if (payload.postId && payload.commentId && onOpenSharedTarget) {
                    onOpenSharedTarget({
                      type: "comment",
                      postId: payload.postId,
                      commentId: payload.commentId,
                      authorId: payload.authorId || undefined,
                    });
                  }
                };
                const connectSnippet = Boolean(postPreview);
                return (
                  <div className={structuredStackClass}>
                    {postPreview ? (
                      <button
                        type="button"
                        disabled={!canOpenComment}
                        onClick={openComment}
                        className={cn(
                          structuredPreviewClass(true),
                          "bg-muted/35 px-2.5 py-2 text-left dark:bg-white/[0.05]",
                          canOpenComment ? "cursor-pointer active:opacity-90" : "cursor-default",
                        )}
                        aria-label={canOpenComment ? "Открыть комментарий в посте" : "Контекст поста"}
                      >
                        <p className="text-[11px] font-medium text-muted-foreground">К посту</p>
                        <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-foreground/85">{postPreview}</p>
                      </button>
                    ) : null}
                    <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1 px-0.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground">Комментарий</p>
                        <p className="text-[12px] font-semibold leading-tight text-foreground/95">{authorName}</p>
                      </div>
                      {!canOpenComment ? (
                        <span className="inline-flex shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Недоступно
                        </span>
                      ) : null}
                      {canOpenComment ? (
                        <button
                          type="button"
                          className={structuredMetaLinkBtn}
                          title="Открыть комментарий в посте"
                          onClick={openComment}
                        >
                          Открыть комментарий
                        </button>
                      ) : null}
                    </div>
                    <div
                      className={cn(attachedSnippetBubble, connectSnippet && attachedSnippetUnderVisual)}
                      style={pulseStructuredIncomingBorderStyle}
                    >
                      <p className="text-[14px] leading-[1.32] break-words whitespace-pre-wrap text-foreground/90">{text}</p>
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
                const avatarRaw = payload.authorAvatar ? resolveUrl(payload.authorAvatar) : "";
                const canOpenStory = Boolean(payload.storyId && onOpenSharedTarget);
                const replyText = (payload.replyText ?? "").trim();
                const connectSnippet = Boolean(mediaRaw && replyText);
                const openStory = () => {
                  if (canOpenStory && payload.storyId) {
                    onOpenSharedTarget?.({
                      type: "story",
                      storyId: payload.storyId,
                      authorId: payload.authorId || undefined,
                    });
                  }
                };
                return (
                  <div className={structuredStackClass}>
                    {mediaRaw ? (
                      <button
                        type="button"
                        disabled={!canOpenStory}
                        onClick={openStory}
                        className={cn(
                          structuredPreviewClass(connectSnippet),
                          "max-h-[min(52vh,420px)] bg-black/35 dark:bg-black/50",
                          canOpenStory ? "cursor-pointer active:opacity-90" : "cursor-default opacity-90",
                        )}
                        aria-label={canOpenStory ? "Открыть сториз" : "Превью сториз"}
                      >
                        <div className="relative aspect-[9/16] w-full max-h-[min(52vh,420px)]">
                          {isVideo ? (
                            <video
                              src={mediaRaw}
                              className="absolute inset-0 h-full w-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              poster={posterSrc || undefined}
                              aria-hidden
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
                          {isVideo ? (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-[1px] ring-1 ring-white/25">
                                <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ) : null}
                    <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1 px-0.5">
                      <UserAvatar
                        avatarUrl={avatarRaw || undefined}
                        displayName={authorName}
                        seed={payload.authorId ?? authorName}
                        size={24}
                        className="h-6 w-6 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-muted-foreground">Сториз</p>
                        <p className="text-[12px] font-semibold leading-tight text-foreground/95">{authorName}</p>
                        {payload.storyTimeLabel ? (
                          <p className="text-[11px] text-muted-foreground">{payload.storyTimeLabel}</p>
                        ) : null}
                      </div>
                      {!canOpenStory ? (
                        <span className="inline-flex shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Недоступно
                        </span>
                      ) : null}
                      {canOpenStory && !mediaRaw ? (
                        <button type="button" className={structuredMetaLinkBtn} onClick={openStory}>
                          Открыть сториз
                        </button>
                      ) : null}
                    </div>
                    {!payload.storyId && payload.authorId ? (
                      <button type="button" className={cn(structuredMetaLinkBtn, "self-start")} onClick={() => onOpenProfile(payload.authorId!)}>
                        Профиль автора
                      </button>
                    ) : null}
                    {replyText ? (
                      <div
                        className={cn(attachedSnippetBubble, connectSnippet && attachedSnippetUnderVisual)}
                        style={pulseStructuredIncomingBorderStyle}
                      >
                        <p className="uix-select-text text-[14px] leading-[1.32] break-words whitespace-pre-wrap">{replyText}</p>
                      </div>
                    ) : null}
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
                        {segments.map((seg, i) => {
                          if (seg.type === "code") {
                            if (seg.lang === "table") {
                              const tablePayload = parseTablePayloadFromFenceBody(seg.content);
                              return tablePayload ? (
                                <ChatTableBubble key={i} payload={tablePayload} className="my-1" />
                              ) : (
                                <CodeBlock key={i} code={seg.content} lang={seg.lang} className="my-1" />
                              );
                            }
                            return <CodeBlock key={i} code={seg.content} lang={seg.lang} className="my-1" />;
                          }
                          return (
                            <p key={i} className="uix-select-text text-[14px] leading-[1.32] break-words whitespace-pre-wrap">
                              {linkifyTextWithMentions(seg.content, onOpenProfile)}
                            </p>
                          );
                        })}
                      </div>
                    );
                  }
                  return (
                    <p className="uix-select-text text-[14px] leading-[1.32] break-words whitespace-pre-wrap max-w-[min(240px,72vw)]">
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
                {translationPending && !translatedText?.trim() && msg.type === "text" ? (
                  <p className="text-[10px] text-muted-foreground/75 mt-0.5" aria-live="polite">
                    Перевод…
                  </p>
                ) : null}
              </>
            )}
            {showFooter && (
              <div
                className={cn(
                  "text-[11px] flex justify-end items-center gap-0.5",
                  isMedia || isStructuredShare ? "mt-1 px-0.5" : "mt-0.5",
                  vibeTextBubble && isMe
                    ? "text-white/85"
                    : pulseFooterShell && pulseMobileDm === "dark" && isMe
                      ? "text-white/65"
                      : pulseFooterShell && pulseMobileDm === "light" && isMe
                        ? "text-white/85"
                        : isMe
                          ? bubbleStyles.footer
                          : "text-muted-foreground",
                )}
              >
                {!isMe ? (
                  <span aria-label={incomingMessageFooterAria(msg.createdAt)}>{formatMessageTime(msg.createdAt)}</span>
                ) : (
                  <OutgoingMessageFooter
                    msg={msg}
                    lastReadAt={lastReadAt}
                    vibeTextBubble={vibeTextBubble}
                    pulseTextShell={pulseFooterShell}
                    pulseMobileDm={pulseMobileDm}
                    onRetry={onRetry}
                  />
                )}
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
