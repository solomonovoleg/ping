import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MIN_REVIEW_NOTE_LENGTH } from "../readiness-shared";
import type { UxReviewRow } from "./ux-review-rows";

type Props = {
  row: UxReviewRow;
  isDone: boolean;
  note: string;
  onOpen: () => void;
  onToggle: () => void;
  onNoteChange: (value: string) => void;
};

export function UxRequirementChecklistRow({ row, isDone, note, onOpen, onToggle, onNoteChange }: Props) {
  const noteTooShort = note.trim().length > 0 && note.trim().length < MIN_REVIEW_NOTE_LENGTH;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 sm:p-4",
        isDone ? "border-emerald-400/40 bg-emerald-500/10" : "border-[hsl(var(--admin-border)/0.4)] bg-[hsl(var(--admin-elevated)/0.2)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[hsl(210_20%_96%)]">{row.title}</p>
          <p className="mt-1 text-xs text-[hsl(210_12%_62%)]">{row.whyItMatters}</p>
        </div>
        <span className="rounded-full border border-[hsl(var(--admin-border)/0.5)] px-2.5 py-0.5 text-[11px]">
          {isDone ? "Готово" : "Проверить"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          {row.routeLabel}
        </Button>
        <Button type="button" size="sm" variant={isDone ? "secondary" : "default"} onClick={onToggle}>
          {isDone ? "Снять отметку" : "Отметить как проверено"}
        </Button>
      </div>
      <div className="mt-3">
        <Textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          className="min-h-[90px] text-xs leading-relaxed"
          placeholder="Что именно проверили на этом шаге: экран, путь и итог..."
          aria-label={`Подтверждение по пункту ${row.title}`}
        />
        <p className={cn("mt-1 text-[11px]", noteTooShort ? "text-amber-300" : "text-[hsl(210_12%_62%)]")}>
          {noteTooShort
            ? `Добавьте больше деталей (минимум ${MIN_REVIEW_NOTE_LENGTH} символов).`
            : "Подтверждение попадет в копируемый чеклист для команды."}
        </p>
      </div>
    </div>
  );
}
