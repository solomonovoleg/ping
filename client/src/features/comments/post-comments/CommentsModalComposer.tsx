import { useState, useCallback, useId, type KeyboardEvent } from "react";
import { AtSign, Send } from "lucide-react";
import type { RefObject } from "react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { cn } from "@/lib/utils";
import type { CommentItem } from "../shared/types";
import { MAX_COMMENT_TEXT_LENGTH } from "../shared/constants";
import { ReplyTargetBanner } from "../comment-replies/ReplyTargetBanner";
import { useCommentMentionPicker } from "../comment-mentions/use-comment-mention-picker";
import { CommentMentionSuggestPanel } from "../comment-mentions/CommentMentionSuggestPanel";

export function CommentsModalComposer({
  textareaRef,
  value,
  onChange,
  onSend,
  sending,
  userPresent,
  currentUserId,
  replyingTo,
  onClearReply,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  userPresent: boolean;
  currentUserId?: string;
  replyingTo: CommentItem | null;
  onClearReply: () => void;
}) {
  const [selStart, setSelStart] = useState(0);
  const listId = useId();

  const applyCursor = useCallback(
    (pos: number) => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
      setSelStart(pos);
    },
    [textareaRef],
  );

  const mention = useCommentMentionPicker({
    value,
    onChange,
    enabled: userPresent && !!currentUserId,
    currentUserId,
    selectionStart: selStart,
    applyCursor,
  });

  const syncSel = useCallback(() => {
    const el = textareaRef.current;
    if (el) setSelStart(el.selectionStart);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mention.moveSel(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mention.moveSel(-1);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        if (mention.candidates.length > 0) {
          e.preventDefault();
          triggerLightHaptic();
          mention.pick(mention.candidates[mention.selectedIndex]!);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        mention.cancelMention();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  };

  const insertAt = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + "@" + value.slice(end);
    onChange(next);
    const pos = start + 1;
    requestAnimationFrame(() => applyCursor(pos));
    triggerLightHaptic();
  }, [value, onChange, applyCursor, textareaRef]);

  const len = value.length;

  return (
    <>
      {replyingTo ? <ReplyTargetBanner target={replyingTo} onClear={onClearReply} /> : null}

      <div className="relative mb-2">
        <CommentMentionSuggestPanel
          open={mention.open}
          candidates={mention.candidates}
          selectedIndex={mention.selectedIndex}
          searching={mention.searching}
          topPickCount={mention.topPickCount}
          onPick={(u) => {
            triggerLightHaptic();
            mention.pick(u);
          }}
          onHoverIndex={mention.setSelectedIndex}
          listId={listId}
        />
      </div>

      <div
        className={cn(
          "flex items-end gap-2 sm:gap-3 bg-secondary/50 rounded-3xl p-1.5 pl-3 sm:pl-4 border transition-[box-shadow,border-color]",
          replyingTo ? "border-primary/35 ring-2 ring-primary/15" : "border-border/50",
          userPresent && !sending ? "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10" : "",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          maxLength={MAX_COMMENT_TEXT_LENGTH}
          rows={Math.min(8, Math.max(1, value.split("\n").length))}
          aria-autocomplete={mention.open ? "list" : "none"}
          aria-controls={mention.open ? listId : undefined}
          aria-expanded={mention.open}
          onChange={(e) => {
            onChange(e.target.value);
            setSelStart(e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          onSelect={syncSel}
          onClick={syncSel}
          onKeyUp={syncSel}
          disabled={!userPresent || sending}
          placeholder={
            userPresent
              ? "Комментарий…"
              : "Войдите, чтобы комментировать"
          }
          className="flex-1 bg-transparent border-none outline-none py-2.5 text-[15px] leading-snug placeholder:text-muted-foreground disabled:opacity-60 resize-none min-h-[44px] max-h-[132px] overflow-y-auto"
        />
        <div className="flex flex-col items-end gap-0.5 shrink-0 pb-1">
          {userPresent && (len > MAX_COMMENT_TEXT_LENGTH * 0.85 || len > 0) ? (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                len >= MAX_COMMENT_TEXT_LENGTH ? "text-destructive" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {len}/{MAX_COMMENT_TEXT_LENGTH}
            </span>
          ) : null}
          <div className="flex items-center gap-1">
            <TapScaleButton
              type="button"
              haptic
              subtle
              disabled={!userPresent || sending}
              onClick={insertAt}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label="Вставить упоминание"
            >
              <AtSign className="w-5 h-5" />
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={() => void onSend()}
              disabled={!value.trim() || sending || !userPresent}
              haptic
              className="p-2.5 rounded-full bg-primary text-primary-foreground shrink-0 disabled:opacity-50 disabled:bg-secondary disabled:text-muted-foreground transition-all min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label={sending ? "Отправка…" : "Отправить комментарий"}
            >
              <Send className="w-5 h-5 ml-0.5" />
            </TapScaleButton>
          </div>
        </div>
      </div>
    </>
  );
}
