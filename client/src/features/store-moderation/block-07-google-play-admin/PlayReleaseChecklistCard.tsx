import { Check, Copy, Search } from "lucide-react";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListEmptyState } from "@/components/ui/empty";
import { ChecklistProgressHeader } from "@/features/store-moderation/ui/ChecklistProgressHeader";
import { PlayReleaseChecklistRow } from "./PlayReleaseChecklistRow";
import { usePlayReleaseChecklist } from "./use-play-release-checklist";

export function PlayReleaseChecklistCard() {
  const checklist = usePlayReleaseChecklist();

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <ChecklistProgressHeader
        title="Готовность релиза (admin + user + moderator)"
        description="Проверка финального UX перед публикацией в Google Play: админские, пользовательские и модераторские пути."
        done={checklist.done}
        total={checklist.total}
        percent={checklist.progress}
        progressAriaLabel="Прогресс Play readiness"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={checklist.openNextUnchecked}>
          {checklist.nextUnchecked ? `Продолжить: ${checklist.nextUnchecked.routeLabel}` : "Все шаги закрыты"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={checklist.resetMarks}>
          Сбросить отметки
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={checklist.resetNotes}>
          Очистить заметки
        </Button>
        <Button type="button" size="sm" onClick={() => void checklist.copy()} className="gap-1.5" disabled={!checklist.readyForSubmit}>
          {checklist.copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {checklist.copied ? "Скопировано" : "Копировать отчет"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={checklist.audienceFilter === "all" ? "default" : "outline"} onClick={() => checklist.setAudienceFilter("all")}>
          Все роли
        </Button>
        <Button type="button" size="sm" variant={checklist.audienceFilter === "admin" ? "default" : "outline"} onClick={() => checklist.setAudienceFilter("admin")}>
          Админ
        </Button>
        <Button type="button" size="sm" variant={checklist.audienceFilter === "user" ? "default" : "outline"} onClick={() => checklist.setAudienceFilter("user")}>
          Пользователь
        </Button>
        <Button
          type="button"
          size="sm"
          variant={checklist.audienceFilter === "moderator" ? "default" : "outline"}
          onClick={() => checklist.setAudienceFilter("moderator")}
        >
          Модератор
        </Button>
      </div>

      <div className="mt-3">
        <Input
          value={checklist.query}
          onChange={(event) => checklist.setQuery(event.target.value)}
          placeholder="Поиск по чеклисту релиза"
          className="min-h-[var(--uix-touch-min)]"
          aria-label="Поиск по шагам готовности Google Play"
        />
      </div>

      <div className="mt-4 space-y-3">
        {checklist.filteredRows.length === 0 ? (
          <ListEmptyState
            icon={Search}
            title="Пункты не найдены"
            description="Попробуйте изменить фильтр роли или строку поиска."
            actionLabel="Сбросить фильтры"
            onAction={() => {
              checklist.setQuery("");
              checklist.setAudienceFilter("all");
            }}
          />
        ) : (
          checklist.filteredRows.map((row) => (
            <PlayReleaseChecklistRow
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
        {checklist.readyForSubmit ? "Все пункты закрыты: релиз в Play подготовлен." : "Закройте все пункты и подтверждения для финальной готовности к релизу."}
      </p>
    </AdminPanelCard>
  );
}
