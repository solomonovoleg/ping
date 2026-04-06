import { Check, Copy, Search, Sparkles } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListEmptyState } from "@/components/ui/empty";
import { ChecklistProgressHeader } from "@/features/store-moderation/ui/ChecklistProgressHeader";
import { UxRequirementChecklistRow } from "./UxRequirementChecklistRow";
import { useUxRequirementChecklist } from "./use-ux-requirement-checklist";

export function UxRequirementChecklistCard() {
  const checklist = useUxRequirementChecklist();

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <ChecklistProgressHeader
        title="UX-проверка для Apple (пункт 11)"
        description="Проходите пункты перед отправкой билда: каждый шаг можно быстро проверить переходом на реальный экран приложения."
        done={checklist.completed.size}
        total={checklist.totalRows}
        percent={checklist.completionPercent}
        progressAriaLabel="Прогресс UX-проверки"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={checklist.openNextUnchecked}>
          {checklist.nextUnchecked ? `Продолжить: ${checklist.nextUnchecked.routeLabel}` : "Все шаги пройдены"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={checklist.reset}>
          Сбросить
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void checklist.copyChecklist()}
          className="gap-1.5"
          disabled={!checklist.readyForSubmit}
        >
          {checklist.copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {checklist.copied ? "Скопировано" : "Копировать чеклист"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={checklist.filter === "all" ? "default" : "outline"} onClick={() => checklist.setFilter("all")}>
          Все
        </Button>
        <Button type="button" size="sm" variant={checklist.filter === "todo" ? "default" : "outline"} onClick={() => checklist.setFilter("todo")}>
          Осталось
        </Button>
        <Button type="button" size="sm" variant={checklist.filter === "done" ? "default" : "outline"} onClick={() => checklist.setFilter("done")}>
          Готово
        </Button>
      </div>

      <div className="mt-3">
        <Input
          value={checklist.query}
          onChange={(event) => checklist.setQuery(event.target.value)}
          placeholder="Поиск по шагам UX-проверки"
          className="min-h-[var(--uix-touch-min)]"
          aria-label="Поиск по UX-чеклисту"
        />
      </div>

      <div className="mt-4 space-y-3">
        {checklist.filteredRows.length === 0 ? (
          <ListEmptyState
            icon={Search}
            title="Ничего не найдено"
            description="Измените фильтр или поисковую фразу, чтобы вернуть пункты UX-проверки."
            actionLabel="Сбросить фильтры"
            onAction={() => {
              checklist.setQuery("");
              checklist.setFilter("all");
            }}
          />
        ) : (
          checklist.filteredRows.map((row) => (
            <UxRequirementChecklistRow
              key={row.key}
              row={row}
              isDone={checklist.completed.has(row.key)}
              note={checklist.getNote(row.key)}
              onOpen={() => checklist.openRoute(row.route)}
              onToggle={() => checklist.toggle(row.key)}
              onNoteChange={(value) => checklist.setNotesByKey((prev) => ({ ...prev, [row.key]: value }))}
            />
          ))
        )}
      </div>

      <p className="mt-4 text-xs text-[hsl(210_12%_62%)]">
        {checklist.readyForSubmit ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Все UX-пункты закрыты. Можно прикладывать отчет к сабмиту.
          </span>
        ) : (
          "Есть незакрытые пункты. Для Apple Review завершите все шаги и добавьте подтверждения."
        )}
      </p>
    </AdminPanelCard>
  );
}
