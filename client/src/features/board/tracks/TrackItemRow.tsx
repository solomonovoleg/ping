/**
 * Строка элемента трека: сообщение с чатом, датой и кнопкой «Выполнено».
 * Long-press — переход к сообщению в чате.
 */
import { memo, useRef, useCallback } from "react";
import { Check, Trash2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { formatMessageTime } from "@/features/chat/utils/format";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import type { TrackItem as TrackItemType } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 700;

export type TrackItemRowProps = {
  item: TrackItemType;
  onDone: (itemId: string, done: boolean) => void;
  onRemove?: (itemId: string) => void;
  /** Переход в чат. messageId — скролл к сообщению. */
  onOpenChat?: (chatId: string, messageId?: string) => void;
};

function formatContentPreview(content: string, type: string): string {
  if (type === "text") return content.slice(0, 120) + (content.length > 120 ? "…" : "");
  if (type === "voice") return "Голосовое сообщение";
  if (type === "image") return "Фото";
  if (type === "video" || type === "video_note") return "Видео";
  return "Сообщение";
}

function TrackItemRowInner({ item, onDone, onRemove, onOpenChat }: TrackItemRowProps) {
  const isDone = !!item.doneAt;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onOpenChat) return;
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        triggerSelectionHaptic();
        onOpenChat(item.chatId, item.messageId);
      }, LONG_PRESS_MS);
    },
    [onOpenChat, item.chatId, item.messageId, clearLongPress]
  );

  const handlePointerUp = useCallback(() => clearLongPress(), [clearLongPress]);
  const handlePointerLeave = useCallback(() => clearLongPress(), [clearLongPress]);

  const contentLongPressProps = onOpenChat
    ? {
        onPointerDown: handlePointerDown,
        onPointerUp: handlePointerUp,
        onPointerLeave: handlePointerLeave,
        onTouchStart: (e: React.TouchEvent) => {
          const t = e.changedTouches?.[0] ?? e.touches?.[0];
          if (t) handlePointerDown({ clientX: t.clientX, clientY: t.clientY } as React.PointerEvent);
        },
        onTouchEnd: handlePointerUp,
        onTouchCancel: handlePointerUp,
      }
    : {};

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 min-h-[var(--uix-touch-min)] items-start transition-colors",
        isDone ? "opacity-60" : "opacity-100"
      )}
    >
      <TapScaleButton
        type="button"
        onClick={() => onDone(item.id, !isDone)}
        haptic
        subtle
        className={cn(
          "mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
          isDone
            ? "bg-primary/20 border-primary/40 text-primary"
            : "bg-transparent border-muted-foreground/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
        )}
        aria-label={isDone ? "Отменить выполнение" : "Отметить выполненным"}
      >
        {isDone && <Check className="w-4 h-4" />}
      </TapScaleButton>
      <div
        className={cn(
          "flex-1 min-w-0 cursor-default",
          isDone && "text-muted-foreground"
        )}
        {...contentLongPressProps}
        title={onOpenChat ? "Удерживайте, чтобы перейти к сообщению в чате" : undefined}
      >
        <p className={cn("text-[15px] leading-snug break-words", isDone && "line-through")}>
          {formatContentPreview(item.content, item.type)}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[12px] text-muted-foreground">
          {onOpenChat ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenChat(item.chatId, item.messageId); }}
              className="hover:text-primary hover:underline"
            >
              {item.chatName}
            </button>
          ) : (
            <span>{item.chatName}</span>
          )}
          <span>·</span>
          <span>{formatMessageTime(item.messageCreatedAt)}</span>
        </div>
      </div>
      {onRemove && (
        <TapScaleButton
          type="button"
          onClick={() => onRemove(item.id)}
          haptic
          subtle
          className="flex-shrink-0 p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
          aria-label="Убрать из трека"
        >
          <Trash2 className="w-4 h-4" />
        </TapScaleButton>
      )}
    </div>
  );
}

export const TrackItemRow = memo(TrackItemRowInner);
