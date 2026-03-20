import type { GroupCommandSuggestion, GroupTranscriptSegment } from "../transcripts/types";
import { TapScaleButton } from "@/components/ui/tap-scale";

export function GroupCommandPrompt({
  suggestion,
  previewSegments,
  onAccept,
  onDismiss,
}: {
  suggestion: GroupCommandSuggestion | null;
  previewSegments: GroupTranscriptSegment[];
  onAccept: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}) {
  if (!suggestion) return null;

  return (
    <div className="mx-3 mb-2 rounded-2xl border border-primary/25 bg-primary/8 px-3 py-3">
      <p className="text-sm font-semibold">{suggestion.title}</p>
      <p className="mt-1 text-xs text-white/70">
        Можно сохранить {previewSegments.length > 0 ? previewSegments.length : 1} выбранных реплик в существующий или новый трек.
      </p>
      {previewSegments.length > 0 && (
        <div className="mt-2 space-y-1 rounded-xl bg-black/20 px-2.5 py-2">
          {previewSegments.slice(0, 2).map((segment) => (
            <p key={segment.id} className="text-[11px] leading-snug text-white/80">
              <span className="font-medium text-white/95">{segment.speakerDisplayName}:</span> {segment.textNormalized}
            </p>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <TapScaleButton type="button" onClick={onAccept} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
          Да
        </TapScaleButton>
        <TapScaleButton type="button" onClick={onDismiss} className="px-3 py-2 rounded-lg bg-white/10 text-sm">
          Нет
        </TapScaleButton>
      </div>
    </div>
  );
}
