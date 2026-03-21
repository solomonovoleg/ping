import { MessageCircle, Send, Mic, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { PULSE_ACCENT } from "./constants";

export function StoryViewerFooterOther({
  replyText,
  onReplyTextChange,
  onReplyKeyDown,
  onReplySubmit,
  canReplyCurrentStory,
  sendingReply,
  replyError,
  actionError,
  showActions,
  canLikeCurrentStory,
  isLiked,
  likesCount,
  likeButtonPulse,
  onLikeClick,
  onShareClick,
  shareDisabled,
}: {
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onReplyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Отправка текста (кнопка «отправить» — на мобильных Enter из клавиатуры часто не срабатывает). */
  onReplySubmit: () => void;
  canReplyCurrentStory: boolean;
  sendingReply: boolean;
  replyError: string | null;
  actionError: string | null;
  showActions: boolean;
  canLikeCurrentStory: boolean;
  isLiked: boolean;
  likesCount: number;
  likeButtonPulse: boolean;
  onLikeClick: (e: React.MouseEvent) => void;
  onShareClick: (e: React.MouseEvent) => void;
  shareDisabled: boolean;
}) {
  return (
    <>
      <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md">
        <MessageCircle className="mt-0.5 h-[13px] w-[13px] shrink-0 text-emerald-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/95">Ответ</p>
          <p className="text-[11.5px] leading-relaxed text-white/65">Сообщение уйдёт автору в личный чат после отправки.</p>
        </div>
      </div>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <TapScaleButton
          type="button"
          haptic
          subtle
          disabled={!canReplyCurrentStory || sendingReply || !replyText.trim()}
          onClick={() => onReplySubmit()}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-opacity",
            !canReplyCurrentStory || sendingReply || !replyText.trim()
              ? "cursor-not-allowed opacity-40"
              : "opacity-100"
          )}
          style={{ background: `${PULSE_ACCENT}22`, color: PULSE_ACCENT }}
          aria-label="Отправить ответ"
        >
          <Send className="h-3.5 w-3.5 opacity-90" />
        </TapScaleButton>
        <div className="flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 items-center rounded-full border border-white/15 bg-white/10 px-4 backdrop-blur-md focus-within:border-white/25">
          <input
            type="text"
            enterKeyHint="send"
            inputMode="text"
            autoComplete="off"
            autoCorrect="on"
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            onKeyDown={onReplyKeyDown}
            placeholder={canReplyCurrentStory ? "Ответить…" : "Недоступно"}
            disabled={!canReplyCurrentStory || sendingReply}
            className={cn(
              "min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] leading-tight text-white outline-none placeholder:text-white/40",
              (!canReplyCurrentStory || sendingReply) && "opacity-50"
            )}
            aria-label="Ответ на сториз"
          />
        </div>
        <button
          type="button"
          disabled
          className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/10 bg-white/5 opacity-35"
          aria-label="Голосовой ответ недоступен"
        >
          <Mic className="h-4 w-4 text-white/60" />
        </button>
        <TapScaleButton
          type="button"
          haptic
          subtle
          disabled={!canLikeCurrentStory}
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background,border,opacity] active:scale-95",
            canLikeCurrentStory
              ? isLiked
                ? "border-rose-400/45 bg-rose-500/20"
                : "border-white/15 bg-white/10 hover:bg-white/[0.14]"
              : "cursor-not-allowed border-white/8 bg-white/5 opacity-40"
          )}
          onClick={onLikeClick}
          aria-label={isLiked ? "Убрать лайк" : "Лайкнуть сториз"}
        >
          <span
            className="relative flex items-center justify-center"
            style={{
              animation: likeButtonPulse ? "pulseStoryHeartPop 0.5s ease" : undefined,
            }}
          >
            <Heart
              className={cn("h-[18px] w-[18px]", isLiked ? "fill-rose-400 text-rose-400" : "text-white/70")}
              strokeWidth={2}
            />
            {likesCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white/20 bg-black/60 px-0.5 text-[8px] font-bold tabular-nums text-white/95">
                {likesCount > 99 ? "99+" : likesCount}
              </span>
            )}
          </span>
        </TapScaleButton>
        <TapScaleButton
          type="button"
          haptic
          subtle
          disabled={shareDisabled}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 transition-colors hover:bg-white/[0.14]",
            shareDisabled && "cursor-not-allowed opacity-35"
          )}
          onClick={onShareClick}
          aria-label="Поделиться сториз"
        >
          <Share2 className="h-[15px] w-[15px] text-white/70" />
        </TapScaleButton>
      </div>
      {replyError ? <p className="mt-1.5 px-0.5 text-[11px] text-red-300">{replyError}</p> : null}
      {actionError && !showActions ? <p className="mt-1.5 px-0.5 text-[11px] text-red-300">{actionError}</p> : null}
    </>
  );
}
