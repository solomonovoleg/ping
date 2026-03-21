import { forwardRef } from "react";
import { Camera, Image, Paperclip } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { SpellSuggestions } from "@/features/chat/components/SpellSuggestions";
import type { SpellError } from "@/lib/spellcheck";

/** Всплывашка «Камера / Галерея / Файл» над кнопкой скрепки (только натив). */
export const ChatDetailNativeAttachMenu = forwardRef<
  HTMLDivElement,
  {
    onPickCamera: () => void;
    onPickGallery: () => void;
    onPickFile: () => void;
  }
>(function ChatDetailNativeAttachMenu({ onPickCamera, onPickGallery, onPickFile }, ref) {
  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 z-[110]"
    >
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
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary w-full border-t border-border"
        onClick={onPickFile}
      >
        <Paperclip className="w-4 h-4" />
        Файл (фото/видео)
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
