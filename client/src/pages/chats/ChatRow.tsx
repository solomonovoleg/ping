import {
  memo,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic, Pin, Check, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleDiv } from "@/components/ui/tap-scale";
import { triggerContextMenuOpenFeedback } from "@/lib/capacitor-native";
import { usePrefersReducedMotion } from "@/lib/motion";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER } from "@/lib/motion";
import type { ApiChat } from "@/features/chat";
import { formatMessageTime, isOutgoingMessageReadByPeer } from "@/features/chat/utils/format";
import { formatChatLastMessagePreview, formatChatTime } from "@/pages/chats/chats-list-format";

/** Удержание для сервисного меню (~0,7 с). Сильный сдвиг пальца отменяет, чтобы не мешать скроллу. */
const CHAT_SERVICE_MENU_LONG_PRESS_MS = 720;
const CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX = 14;

/** Строка чата: мемоизация уменьшает перерисовку списка при обновлении «печатает»/«записывает» только в одном чате */
export const ChatRow = memo(function ChatRow({
  chat,
  typingLabel,
  voiceLabel,
  onSelect,
  onLongPressMenu,
  isAiChat,
  suppressUnreadVisual,
  trailingAction,
  pendingUnreadHint,
  currentUserId,
  isSelected,
  composerTransferPulse,
}: {
  chat: ApiChat;
  typingLabel: string | null;
  voiceLabel: string | null;
  onSelect: () => void;
  onLongPressMenu?: () => void;
  isAiChat?: boolean;
  suppressUnreadVisual?: boolean;
  trailingAction?: ReactNode;
  pendingUnreadHint?: boolean;
  currentUserId?: string | null;
  isSelected?: boolean;
  composerTransferPulse?: boolean;
}) {
  const rawUnc = (chat as { unread_count?: unknown }).unread_count;
  const unreadCount = Math.max(
    0,
    Number(
      chat.unreadCount ??
        (typeof rawUnc === "number" ? rawUnc : typeof rawUnc === "string" ? parseInt(rawUnc, 10) : 0),
    ) || 0,
  );
  const hasUnreadVisual =
    !isAiChat &&
    !suppressUnreadVisual &&
    (unreadCount > 0 || chat.hasUnread === true || pendingUnreadHint === true);

  const reducedMotion = usePrefersReducedMotion();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const blockClickRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressing(false);
    longPressOriginRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onLongPressMenu || isAiChat) return;
      if (e.button !== 0) return;
      longPressOriginRef.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        setPressing(false);
        longPressOriginRef.current = null;
        blockClickRef.current = true;
        window.setTimeout(() => {
          blockClickRef.current = false;
        }, 500);
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          /* ignore */
        }
        triggerContextMenuOpenFeedback();
        onLongPressMenu();
      }, CHAT_SERVICE_MENU_LONG_PRESS_MS);
    },
    [onLongPressMenu, isAiChat],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = longPressOriginRef.current;
      if (!origin || !longPressTimerRef.current) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      if (dx * dx + dy * dy > CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX * CHAT_ROW_LONG_PRESS_MOVE_CANCEL_PX) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );
  const preview =
    voiceLabel != null ? (
      <span className="text-primary/90 flex items-center gap-1">
        <Mic className="w-3 h-3 flex-shrink-0" />
        {voiceLabel} записывает голосовое
      </span>
    ) : typingLabel != null ? (
      <span className="italic text-primary/90">{typingLabel} печатает...</span>
    ) : (
      formatChatLastMessagePreview(chat.lastMessage ?? undefined)
    );
  const peerReadAt = chat.otherMember?.lastReadAt ?? null;
  const showOutgoingListReceipt =
    !isAiChat &&
    chat.type === "dm" &&
    typingLabel == null &&
    voiceLabel == null &&
    Boolean(currentUserId) &&
    chat.lastMessage?.senderId === currentUserId;
  const outgoingListReceiptRead =
    showOutgoingListReceipt && chat.lastMessage
      ? isOutgoingMessageReadByPeer(chat.lastMessage.createdAt, peerReadAt)
      : false;
  const content = (
    <>
      <div
        className={cn(
          "rounded-full p-[2px] transition-transform duration-200",
          chat.otherMemberHasUnseenStory && !isAiChat
            ? "bg-gradient-to-tr from-primary via-fuchsia-500 to-purple-500 animate-story-ring"
            : chat.otherMemberHasActiveStory && !isAiChat
              ? "bg-gradient-to-tr from-primary/75 to-purple-400/70"
              : "bg-transparent",
        )}
      >
        <UserAvatar
          avatarUrl={(chat.type === "group" ? chat.avatarUrl : chat.otherMemberAvatarUrl) ?? undefined}
          displayName={chat.name ?? "Диалог"}
          seed={chat.id}
          size={46}
          className={cn(
            "h-[46px] w-[46px] flex-shrink-0 sm:h-[50px] sm:w-[50px]",
            isAiChat && "ring-2 ring-indigo-400/60 ring-offset-2 ring-offset-indigo-500/10",
          )}
          showOnlineIndicator={chat.type === "dm" && !isAiChat}
          lastSeenAt={chat.otherMemberLastSeenAt ?? undefined}
          pointerEventsNone
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1.5">
          <h3
            className={cn(
              "flex min-w-0 items-center gap-1 text-[15px] leading-5 sm:text-[16px]",
              isAiChat && "text-indigo-700 dark:text-indigo-200",
              hasUnreadVisual ? "font-bold text-foreground" : "font-semibold text-foreground",
            )}
          >
            {chat.pinnedAt ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden /> : null}
            <span className="truncate">{chat.name ?? (chat.type === "dm" ? "Диалог" : "Чат")}</span>
          </h3>
          <span className="flex-shrink-0 text-[11px] text-muted-foreground/90 sm:text-xs">
            {formatChatTime(chat.lastMessage?.createdAt ?? chat.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "mt-0.5 flex min-w-0 items-center gap-1 text-[13px] leading-[1.25rem] sm:text-[13.5px]",
            isAiChat ? "text-indigo-600/90 dark:text-indigo-400/90" : "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-ellipsis">{preview}</span>
          {showOutgoingListReceipt && chat.lastMessage ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center self-center",
                outgoingListReceiptRead ? "text-primary" : "text-muted-foreground/80",
              )}
              title={
                outgoingListReceiptRead && peerReadAt
                  ? `Прочитано · ${formatMessageTime(peerReadAt)}`
                  : "Доставлено"
              }
            >
              {outgoingListReceiptRead ? (
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
          ) : null}
        </p>
      </div>
    </>
  );

  if (isAiChat) {
    return (
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
        className="rounded-xl sm:rounded-2xl border border-indigo-500/12 bg-indigo-500/8 transition-colors duration-150 hover:bg-indigo-500/12"
      >
        <TapScaleDiv
          onClick={onSelect}
          className="uix-list-row flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-75 hover:bg-indigo-500/8 sm:min-h-[var(--uix-touch-min)] sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5"
        >
          {content}
        </TapScaleDiv>
      </motion.div>
    );
  }

  const hasUnread = hasUnreadVisual;
  const badgeLabel = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : "";
  const showUnreadDot = hasUnread && !badgeLabel;

  return (
    <motion.div
      className="rounded-xl sm:rounded-2xl"
      animate={
        reducedMotion
          ? undefined
          : {
              scale: pressing ? 0.985 : 1,
              opacity: pressing ? 0.92 : 1,
            }
      }
      transition={reducedMotion ? undefined : { duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
    >
      <TapScaleDiv
        onClick={() => {
          if (blockClickRef.current) return;
          onSelect();
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (blockClickRef.current) return;
            onSelect();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        className={cn(
          "uix-list-row flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors duration-75 sm:min-h-[var(--uix-touch-min)] sm:gap-3 sm:rounded-2xl sm:px-2.5 sm:py-2.5",
          "select-none [-webkit-touch-callout:none]",
          "border-border/20 hover:bg-secondary/40 touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
          suppressUnreadVisual
            ? "border-dashed border-border/35 bg-card/45 opacity-[0.92] hover:bg-secondary/35 dark:bg-card/40"
            : hasUnread
              ? "bg-secondary/60 hover:bg-secondary/70 dark:bg-secondary/45 dark:hover:bg-secondary/55"
              : "bg-card/60 hover:bg-secondary/50",
          isSelected && "border-primary/35 bg-primary/10 hover:bg-primary/12 dark:bg-primary/15",
          composerTransferPulse &&
            "border-rose-400/55 shadow-[0_0_28px_rgba(244,63,94,0.22)] dark:border-rose-400/45 dark:shadow-[0_0_32px_rgba(244,63,94,0.2)]",
        )}
      >
        {content}
        {trailingAction ? (
          <span
            className="flex shrink-0 items-center"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {trailingAction}
          </span>
        ) : null}
        {badgeLabel ? (
          <span
            className="flex-shrink-0 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground"
            aria-label={`${unreadCount} непрочитанных`}
          >
            {badgeLabel}
          </span>
        ) : showUnreadDot ? (
          <span
            className="flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--background))]"
            aria-label="Есть непрочитанные сообщения"
            title="Непрочитанные"
          />
        ) : null}
      </TapScaleDiv>
    </motion.div>
  );
});
