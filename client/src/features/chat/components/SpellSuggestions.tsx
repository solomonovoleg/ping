/**
 * Подсказки по орфографии под полем ввода.
 * Тонкая, едва заметная подсказка. Тап по чипу заменяет слово.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { SpellError } from "@/lib/spellcheck";

type SpellSuggestionsProps = {
  errors: SpellError[];
  onReplace: (err: SpellError, replacement: string) => void;
  className?: string;
};

function SpellSuggestionsInner({ errors, onReplace, className }: SpellSuggestionsProps) {
  if (errors.length === 0) return null;

  return (
    <div
      className={cn("flex flex-wrap gap-1 px-2 py-1 border-t border-border/25", className)}
      role="list"
      aria-label="Предложения по исправлению орфографии"
    >
      {errors.map((err, i) => {
        const replacement = err.s?.[0];
        if (!replacement || replacement === err.word) return null;
        return (
          <TapScaleButton
            key={`${err.pos}-${err.word}-${i}`}
            type="button"
            onClick={() => onReplace(err, replacement)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/80 hover:text-foreground/90 hover:bg-muted/40 transition-colors"
            aria-label={`Исправить «${err.word}» на «${replacement}»`}
          >
            <span className="line-through opacity-70">{err.word}</span>
            <span className="opacity-50" aria-hidden>→</span>
            <span>{replacement}</span>
          </TapScaleButton>
        );
      })}
    </div>
  );
}

export const SpellSuggestions = memo(SpellSuggestionsInner);
