import { cn } from "@/lib/utils";
import { DURATION_FAST_MS, EASING_OUT } from "@/lib/motion";
import { StickerPickerPanel } from "./StickerPickerPanel";

type Tab = "emoji" | "stickers";

type ChatComposerStickerEmojiPanelProps = {
  emojiTab: Tab;
  onEmojiTabChange: (tab: Tab) => void;
  emojis: readonly string[];
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (stickerId: string) => void;
  onClosePanel: () => void;
};

const tabTransition = { transition: `color ${DURATION_FAST_MS}ms ${EASING_OUT}, background-color ${DURATION_FAST_MS}ms ${EASING_OUT}, box-shadow ${DURATION_FAST_MS}ms ${EASING_OUT}` };

/**
 * Плавающая панель над композером: эмодзи + стикеры (домен в `features/stickers/`).
 */
export function ChatComposerStickerEmojiPanel({
  emojiTab,
  onEmojiTabChange,
  emojis,
  onPickEmoji,
  onPickSticker,
  onClosePanel,
}: ChatComposerStickerEmojiPanelProps) {
  return (
    <div className="w-[min(340px,calc(100vw-2rem))] animate-in fade-in zoom-in-95 rounded-2xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-xl duration-200">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <span className="text-sm font-medium text-muted-foreground">Эмодзи и стикеры</span>
        <button
          type="button"
          onClick={onClosePanel}
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Закрыть панель"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="mb-2 flex gap-1 rounded-xl border border-border/40 bg-muted/35 p-1" role="tablist" aria-label="Режим панели">
        <button
          type="button"
          role="tab"
          aria-selected={emojiTab === "emoji"}
          className={cn(
            "min-h-[var(--uix-touch-min)] flex-1 rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-[color,background-color,box-shadow]",
            emojiTab === "emoji"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
          style={tabTransition}
          onClick={() => onEmojiTabChange("emoji")}
        >
          Эмодзи
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={emojiTab === "stickers"}
          className={cn(
            "min-h-[var(--uix-touch-min)] flex-1 rounded-lg px-2 py-2 text-xs font-semibold outline-none transition-[color,background-color,box-shadow]",
            emojiTab === "stickers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
          style={tabTransition}
          onClick={() => onEmojiTabChange("stickers")}
        >
          Стикеры
        </button>
      </div>

      {emojiTab === "emoji" ? (
        <div className="grid grid-cols-6 gap-1.5" role="tabpanel">
          {emojis.map((emo) => (
            <button
              key={emo}
              type="button"
              onClick={() => onPickEmoji(emo)}
              className="flex min-h-[var(--uix-touch-min)] items-center justify-center rounded-lg text-2xl transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {emo}
            </button>
          ))}
        </div>
      ) : (
        <div role="tabpanel" className="min-h-0">
          <StickerPickerPanel
            onPickSticker={(id) => {
              onPickSticker(id);
              onClosePanel();
            }}
          />
        </div>
      )}
    </div>
  );
}
