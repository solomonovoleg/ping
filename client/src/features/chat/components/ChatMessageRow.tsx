/**
 * Один пузырь сообщения (текст/голос/фото/видео/пост). React.memo — при «печатает» не ре-рендерим весь список.
 */
import { memo, createElement, Fragment, useRef } from "react";
import { Clock, AlertCircle, Reply as ReplyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { formatMessageTime } from "../utils/format";
import { UserAvatar } from "@/components/UserAvatar";
import { VoiceMessagePlayer } from "@/components/VoiceMessagePlayer";
import { ShatterEffect } from "@/components/ShatterEffect";
import type { ApiMessage } from "../types";

const URL_REGEX = /https?:\/\/[^\s<>]+/g;

/** Разбивает текст на фрагменты и превращает URL в кликабельные ссылки */
function linkifyText(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push(text.slice(lastIndex, m.index));
    }
    const url = m[0];
    segments.push(
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
    lastIndex = m.index + url.length;
  }
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  if (segments.length === 0) return text;
  if (segments.length === 1) return segments[0];
  return createElement(Fragment, {}, ...segments);
}

export type ChatMessageRowProps = {
  msg: ApiMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isMe: boolean;
  isDm: boolean;
  senderName: string;
  otherMemberAvatarUrl: string | null;
  otherMemberId: string;
  lastReadAt: string | null;
  currentUserId: string;
  currentUserAvatarUrl: string | null;
  currentUserDisplayName: string;
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
};

function ChatMessageRowInner({
  msg,
  isFirstInGroup,
  isLastInGroup,
  isMe,
  isDm,
  senderName,
  otherMemberAvatarUrl,
  otherMemberId,
  lastReadAt,
  currentUserId,
  currentUserAvatarUrl,
  currentUserDisplayName,
  isSelected,
  isHighlighted,
  isShattering,
  showFooter,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onContextMenu,
  onRetry,
  onQuickReply,
  onScrollToReply,
  onShatterComplete,
  onOpenProfile,
}: ChatMessageRowProps) {
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartedRef = useRef(false);
  const swipeTriggeredRef = useRef(false);
  const swipeHapticTriggeredRef = useRef(false);
  const replyHintRef = useRef<HTMLDivElement | null>(null);
  const showSenderName = !isDm;
  const isMedia = msg.type === "voice" || msg.type === "image" || msg.type === "video";
  // Telegram-style: хвостик на нижнем углу (один угол меньше — «хвост» пузыря)
  const bubbleRounding = isMe
    ? cn(
        "rounded-[16px]",
        isFirstInGroup && !isLastInGroup && "rounded-br-[16px] rounded-tr-[7px] rounded-tl-[16px] rounded-bl-[16px]",
        isLastInGroup && !isFirstInGroup && "rounded-tr-[16px] rounded-br-[5px] rounded-tl-[16px] rounded-bl-[16px]",
        isFirstInGroup && isLastInGroup && "rounded-br-[5px]",
        !isFirstInGroup && !isLastInGroup && "rounded-tr-[7px] rounded-br-[5px] rounded-tl-[16px] rounded-bl-[16px]"
      )
    : cn(
        "rounded-[16px]",
        isFirstInGroup && !isLastInGroup && "rounded-bl-[16px] rounded-tl-[7px] rounded-tr-[16px] rounded-br-[16px]",
        isLastInGroup && !isFirstInGroup && "rounded-tl-[16px] rounded-bl-[5px] rounded-tr-[16px] rounded-br-[16px]",
        isFirstInGroup && isLastInGroup && "rounded-bl-[5px]",
        !isFirstInGroup && !isLastInGroup && "rounded-tl-[7px] rounded-bl-[5px] rounded-tr-[16px] rounded-br-[16px]"
      );
  const bubbleClasses = isMedia
    ? "p-0 rounded-[14px] overflow-hidden relative select-none touch-none bg-transparent"
    : cn(
        "px-2.5 py-1.5 relative select-none touch-none",
        isMe
          ? "bg-[#d9fdd3] dark:bg-emerald-900/35 text-foreground dark:text-emerald-50 shadow-[0_1px_1px_rgba(0,0,0,0.06)] border border-emerald-300/30 dark:border-emerald-500/25"
          : "bg-white dark:bg-slate-900/70 text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.06)] border border-slate-200/70 dark:border-slate-700/60",
        bubbleRounding
      );
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
        <UserAvatar avatarUrl={otherMemberAvatarUrl ?? undefined} displayName={senderName} seed={otherMemberId} size={avatarSize} className={avatarClass} />
      )}
      {!showAvatarOther && !isMe && !isDm && <div className="w-[30px] flex-shrink-0" />}
      <div className={cn("flex flex-col gap-0.5 min-w-0 max-w-[82%]", isMe ? "items-end" : "items-start")}>
        {showSenderName && isFirstInGroup && <span className={cn("text-[11px] font-medium text-muted-foreground px-1", isMe && "order-2")}>{senderName}</span>}
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
            onPointerDown={(e) => {
              swipeStartXRef.current = e.clientX;
              swipeStartedRef.current = true;
              swipeTriggeredRef.current = false;
              swipeHapticTriggeredRef.current = false;
              if (bubbleRef.current) bubbleRef.current.style.transition = "";
              onPointerDown(msg, e);
            }}
            onPointerMove={(e) => {
              if (!swipeStartedRef.current || swipeStartXRef.current == null || !bubbleRef.current) return;
              const deltaX = e.clientX - swipeStartXRef.current;
              if (deltaX <= 0 || msg.type === "system" || msg.type === "missed_call") return;
              if (Math.abs(deltaX) > 8) onPointerLeave();
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
                onPointerDown(msg, { clientX: touch.clientX, clientY: touch.clientY } as React.PointerEvent);
              }
            }}
            onTouchMove={(e) => {
              const touch = e.changedTouches?.[0] || e.touches?.[0];
              if (!touch || !swipeStartedRef.current || swipeStartXRef.current == null || !bubbleRef.current) return;
              const deltaX = touch.clientX - swipeStartXRef.current;
              if (deltaX <= 0 || msg.type === "system" || msg.type === "missed_call") return;
              if (Math.abs(deltaX) > 8) onPointerLeave();
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
            onContextMenu={onContextMenu}
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
                      ? "bg-emerald-700/10 dark:bg-emerald-300/10 border-emerald-700/35 dark:border-emerald-300/35"
                      : "bg-black/5 dark:bg-white/10 border-primary/45"
                  )}
                >
                  <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">{replyAuthor}</p>
                  <p className="text-[13px] line-clamp-2 break-words leading-snug opacity-95">
                    {msg.replyTo ? (msg.replyTo.type === "text" ? msg.replyTo.content : msg.replyTo.type === "voice" ? "Голосовое сообщение" : msg.replyTo.type === "image" ? "Фото" : msg.replyTo.type) : "Сообщение"}
                  </p>
                </button>
              );
            })()}
            {msg.type === "voice" ? (
              (() => {
                const rawContent = typeof msg.content === "string" ? msg.content.trim() : "";
                const voiceSrc = rawContent ? resolveUrl(rawContent) : "";
                if (!voiceSrc) return <span className="text-sm text-muted-foreground">Голосовое сообщение (недоступно)</span>;
                return <VoiceMessagePlayer src={voiceSrc} isMe={isMe} />;
              })()
            ) : msg.type === "image" ? (
              <a href={resolveUrl(msg.content)} target="_blank" rel="noopener noreferrer" className="block rounded-[10px] overflow-hidden max-w-[260px]">
                <img src={resolveUrl(msg.content)} alt="Фото" className="max-h-[280px] w-full object-cover" loading="lazy" decoding="async" />
              </a>
            ) : msg.type === "video" ? (
              <video src={resolveUrl(msg.content)} controls className="max-h-[280px] max-w-[260px] rounded-[10px] object-cover" playsInline />
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
            ) : (
              <p className="text-[14px] leading-[1.32] break-words whitespace-pre-wrap max-w-[min(240px,72vw)]">
                {linkifyText(msg.content)}
              </p>
            )}
            {showFooter && (
              <div className={cn("text-[11px] flex justify-end items-center gap-0.5", isMedia ? "mt-1 px-0.5" : "mt-0.5", isMe && !isMedia ? "text-emerald-800/90 dark:text-emerald-200/90" : "text-muted-foreground")}>
                {formatMessageTime(msg.createdAt)}
                {isMe && (() => {
                  if (msg.sendStatus === "sending") return <span className="inline-flex items-center gap-0.5" title="Отправляется"><Clock className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" aria-hidden /></span>;
                  if (msg.sendStatus === "failed") return (
                    <span className="inline-flex items-center gap-1">
                      <span title="Ошибка отправки"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden /></span>
                      <button type="button" className="text-[10px] font-medium underline underline-offset-1 hover:opacity-100 opacity-90" onClick={(e) => { e.stopPropagation(); onRetry(msg); }}>Повторить</button>
                    </span>
                  );
                  const isRead = lastReadAt && new Date(msg.createdAt) <= new Date(lastReadAt);
                  const title = isRead && lastReadAt ? `Просмотрено в ${formatMessageTime(lastReadAt)}` : "Доставлено";
                  return (
                    <span className="inline-flex items-center gap-0.5" title={title}>
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                      {isRead && <svg className="w-3 h-3 flex-shrink-0 -ml-2.25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
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
          {isShattering && <ShatterEffect className="absolute inset-0 rounded-[14px]" shardClassName={isMe ? "bg-emerald-100/90 dark:bg-emerald-900/35" : "bg-white/85 dark:bg-slate-900/70"} onComplete={() => onShatterComplete(msg.id)} />}
        </div>
      </div>
      {showAvatarMe && <UserAvatar avatarUrl={currentUserAvatarUrl ?? undefined} displayName={currentUserDisplayName ?? "Вы"} seed={msg.senderId ?? ""} size={avatarSize} className={avatarClass} />}
      {!showAvatarMe && isMe && <div className="w-[30px] flex-shrink-0" />}
    </div>
  );
}

export const ChatMessageRow = memo(ChatMessageRowInner);
