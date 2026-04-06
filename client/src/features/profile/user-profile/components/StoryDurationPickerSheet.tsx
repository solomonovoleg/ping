import { cn } from "@/lib/utils";
import type { StoryExpiresHours } from "@/lib/stories";
import { userProfileRu } from "../i18n.ru";

const CAPTION_MAX = 500;

export function StoryDurationPickerSheet({
  open,
  storyExpiresInHours,
  onHoursChange,
  storyCaption,
  onStoryCaptionChange,
  onCancel,
  onPublish,
  addingStory,
  hasPendingFile,
}: {
  open: boolean;
  storyExpiresInHours: StoryExpiresHours;
  onHoursChange: (h: StoryExpiresHours) => void;
  storyCaption: string;
  onStoryCaptionChange: (v: string) => void;
  onCancel: () => void;
  onPublish: () => void;
  addingStory: boolean;
  hasPendingFile: boolean;
}) {
  const d = userProfileRu.storyDuration;
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[220] flex items-end bg-black/45 px-3 pt-3 pb-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px)+12px)] touch-pan-y"
      onClick={onCancel}
    >
      <div
        className="w-full uix-responsive-max-w max-h-[78vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{d.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{d.subtitle}</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto overscroll-y-contain p-3 touch-pan-y">
          <div className="grid grid-cols-3 gap-2">
            {([24, 46, 56] as const).map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => onHoursChange(hours)}
                className={cn(
                  "min-h-[var(--uix-touch-min)] rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  storyExpiresInHours === hours
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-foreground hover:bg-secondary",
                )}
              >
                {d.hours(hours)}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-foreground">{d.captionLabel}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{d.captionHint}</p>
            <textarea
              value={storyCaption}
              onChange={(e) => onStoryCaptionChange(e.target.value.slice(0, CAPTION_MAX))}
              rows={3}
              maxLength={CAPTION_MAX}
              disabled={addingStory}
              placeholder={d.captionPlaceholder}
              className="mt-2 w-full resize-none rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-[14px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              aria-label={d.captionLabel}
            />
            <p className="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
              {storyCaption.length}/{CAPTION_MAX}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[var(--uix-touch-min)] rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground"
            >
              {d.cancel}
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={addingStory || !hasPendingFile}
              className="min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {addingStory ? d.publishing : d.publish}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
