import { Reply, X } from "lucide-react";
import type { ApiMessage } from "@/features/chat";
import { RecordingStrip } from "./RecordingStrip";

/** Полосы над капсулой ввода: редактирование, «печатает» / голос, запись (не PULSE DM). */
export function ChatDetailComposerTopChrome({
  editingId,
  onCancelEdit,
  typingDisplay,
  voiceRecordingDisplay,
  showRecordingStrip,
  recordingDurationSec,
  onStopRecording,
}: {
  editingId?: string | null;
  onCancelEdit: () => void;
  typingDisplay?: string | null;
  voiceRecordingDisplay?: string | null;
  showRecordingStrip: boolean;
  recordingDurationSec: number;
  onStopRecording: () => void;
}) {
  const editing = Boolean(editingId);
  const showMeta = Boolean((typingDisplay || voiceRecordingDisplay) && !editing);

  return (
    <>
      {editing ? (
        <div className="chat-composer-strip flex items-center justify-between gap-2 mb-1.5 rounded-t-xl border-b px-3 py-2">
          <span className="text-xs text-muted-foreground">Редактирование сообщения</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-primary hover:underline rounded-lg px-1 py-0.5 min-h-[var(--uix-touch-min)]"
          >
            Отмена
          </button>
        </div>
      ) : null}
      {showMeta ? (
        <div className="chat-composer-meta text-xs mb-1 space-y-0.5">
          {typingDisplay ? <p className="animate-pulse">{typingDisplay} печатает...</p> : null}
          {voiceRecordingDisplay ? (
            <p className="animate-pulse">{voiceRecordingDisplay} записывает голосовое...</p>
          ) : null}
        </div>
      ) : null}
      {showRecordingStrip ? (
        <RecordingStrip durationSec={recordingDurationSec} onStop={onStopRecording} />
      ) : null}
    </>
  );
}

/** Ответ и подсказка восстановленного черновика (внутри `max-w-4xl` над капсулой). */
export function ChatDetailComposerReplyDraftStrips({
  replyingTo,
  onCancelReply,
  draftRestoredHint,
  onDismissDraftHint,
}: {
  replyingTo: ApiMessage | null;
  onCancelReply: () => void;
  draftRestoredHint: boolean;
  onDismissDraftHint: () => void;
}) {
  return (
    <>
      {replyingTo ? (
        <div className="chat-composer-strip flex items-center gap-2 pl-3 pr-1 py-2 border-b text-[var(--uix-text-caption)] rounded-t-xl">
          <Reply className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden />
          <span className="flex-1 min-w-0 truncate text-muted-foreground">
            {replyingTo.type === "text"
              ? replyingTo.content.slice(0, 60) + (replyingTo.content.length > 60 ? "…" : "")
              : "Сообщение"}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex-shrink-0 min-w-[var(--uix-touch-min,44px)] min-h-[var(--uix-touch-min,44px)] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Отменить ответ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}
      {draftRestoredHint ? (
        <div className="chat-composer-strip chat-composer-strip--draft flex items-center gap-2 pl-3 pr-2 py-1.5 border-b text-[var(--uix-text-caption)] rounded-t-xl">
          <span className="flex-1 text-muted-foreground">Черновик восстановлен</span>
          <button
            type="button"
            onClick={onDismissDraftHint}
            className="flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Скрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}
    </>
  );
}
