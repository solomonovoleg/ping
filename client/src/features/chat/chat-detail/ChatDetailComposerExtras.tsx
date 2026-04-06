import { forwardRef } from "react";
import { Camera, FileText, Image, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { SpellSuggestions } from "@/features/chat/components/SpellSuggestions";
import type { SpellError } from "@/lib/spellcheck";

/** Всплывашка «Камера / Галерея / Медиа / PDF» над кнопкой скрепки. Камера и галерея — только в нативном приложении. */
export const ChatDetailNativeAttachMenu = forwardRef<
  HTMLDivElement,
  {
    showCameraGallery: boolean;
    onPickCamera: () => void;
    onPickGallery: () => void;
    onPickFile: () => void;
    onPickPdf: () => void;
  }
>(function ChatDetailNativeAttachMenu(
  { showCameraGallery, onPickCamera, onPickGallery, onPickFile, onPickPdf },
  ref
) {
  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 z-[110]"
    >
      {showCameraGallery ? (
        <>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full"
            onClick={onPickCamera}
          >
            <Camera className="w-4 h-4" />
            Камера
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full"
            onClick={onPickGallery}
          >
            <Image className="w-4 h-4" />
            Галерея
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full",
          showCameraGallery ? "border-t border-border" : ""
        )}
        onClick={onPickFile}
      >
        <Paperclip className="w-4 h-4" />
        Фото или видео
      </button>
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full"
        onClick={onPickPdf}
      >
        <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
        PDF до 15 МБ
      </button>
    </div>
  );
});

/** Строка «Отменить исправление» или чипы SpellSuggestions. */
export function ChatDetailComposerSpellFooter({
  spellUndo,
  onSpellUndo,
  effectiveSpellCheck,
  spellErrors,
  onSpellReplace,
  suggestionsClassName,
}: {
  spellUndo: { from: string; to: string } | null;
  onSpellUndo: () => void;
  effectiveSpellCheck: boolean;
  spellErrors: SpellError[];
  onSpellReplace: (err: SpellError, replacement: string) => void;
  suggestionsClassName?: string;
}) {
  if (spellUndo) {
    return (
      <div className="chat-composer-spell-row flex items-center justify-center gap-1.5 py-1 px-2 border-t border-border/20">
        <span className="text-[10px] text-muted-foreground/60">Исправлено</span>
        <TapScaleButton
          type="button"
          onClick={onSpellUndo}
          haptic
          className="text-[10px] text-muted-foreground/55 hover:text-muted-foreground/90 underline underline-offset-1 decoration-muted-foreground/30 hover:decoration-muted-foreground/60 min-h-[22px] px-1 -mx-1 rounded transition-colors"
          aria-label="Отменить исправление"
        >
          Отменить
        </TapScaleButton>
      </div>
    );
  }
  if (effectiveSpellCheck) {
    return (
      <SpellSuggestions
        errors={spellErrors}
        onReplace={onSpellReplace}
        className={suggestionsClassName}
      />
    );
  }
  return null;
}
