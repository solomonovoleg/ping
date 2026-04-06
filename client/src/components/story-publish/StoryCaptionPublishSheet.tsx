import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const MAX = 500;

/** После загрузки медиа: опциональная подпись с @упоминаниями, затем публикация сторис. */
export function StoryCaptionPublishSheet({
  open,
  busy,
  onCancel,
  onPublish,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onPublish: (caption: string) => void | Promise<void>;
}) {
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (open) setCaption("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-end bg-black/50 px-3 pt-3 pb-[max(var(--uix-nav-bottom),env(safe-area-inset-bottom,0px)+12px)]"
      onClick={onCancel}
    >
      <div
        className="w-full uix-responsive-max-w max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Подпись к сторис</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Необязательно. Отметки (@ или{" "}
            <span className="font-mono text-[10px]">@[Имя](номер)</span>) уходят адресату в личные сообщения.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto overscroll-y-contain p-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MAX))}
            rows={4}
            maxLength={MAX}
            disabled={busy}
            placeholder="Например: Смотрите, как тут красиво…"
            className="w-full resize-none rounded-xl border border-border/60 bg-secondary/20 px-3 py-2.5 text-[15px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            aria-label="Подпись к сторис"
          />
          <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
            {caption.length}/{MAX}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[var(--uix-touch-min)] rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void onPublish(caption.trim())}
            disabled={busy}
            className={cn(
              "min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60",
            )}
          >
            {busy ? "Публикация…" : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  );
}
