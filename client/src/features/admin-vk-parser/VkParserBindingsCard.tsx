import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPanelCard } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { ListEmptyState } from "@/components/ui/empty";
import type { AdminVkParserBinding } from "@/lib/admin";
import { AlertCircle, Inbox, Play, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { VkParserBindingsSkeleton } from "./VkParserBindingsSkeleton";
import { VkParserDeleteBindingAlert } from "./VkParserDeleteBindingAlert";
import { VkParserUnavailableHint } from "./VkParserUnavailableHint";

type RunResult = { created: number; skipped: number; duplicates: number };

export function VkParserBindingsCard(props: {
  bindings: AdminVkParserBinding[];
  loading: boolean;
  fetching: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (b: AdminVkParserBinding) => void;
  runOneMut: UseMutationResult<RunResult, Error, string, unknown>;
  deleteMut: UseMutationResult<void, Error, string, unknown>;
}) {
  const [toDelete, setToDelete] = useState<AdminVkParserBinding | null>(null);

  const titleFor = (b: AdminVkParserBinding) => b.displayName || "Без названия";

  return (
    <>
      <AdminPanelCard
        className={cn(
          "space-y-3 p-5 sm:p-6",
          props.fetching && !props.loading && "opacity-95 transition-opacity",
        )}
      >
        <div>
          <h2 className="text-lg font-semibold text-[hsl(210_20%_98%)]" id="vk-parser-bindings-title">
            Привязки
          </h2>
          <p className="mt-1 text-sm admin-text-muted">
            Пользователь платформы, токен ВК и стена (owner_id). Отсюда же запускается ручной опрос.
          </p>
        </div>
        <div className="space-y-3">
          {props.loading ? (
            <VkParserBindingsSkeleton />
          ) : props.error ? (
            <div
              className="flex flex-col gap-3 items-start rounded-lg border border-destructive/25 bg-destructive/5 p-4"
              role="alert"
            >
              <div className="flex gap-2 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Импорт из ВК сейчас недоступен</p>
                  <p className="text-xs text-muted-foreground mt-1">Список привязок не открывается.</p>
                  <VkParserUnavailableHint />
                </div>
              </div>
              <Button type="button" variant="outline" className="min-h-[var(--uix-touch-min)]" onClick={props.onRetry}>
                Повторить
              </Button>
            </div>
          ) : props.bindings.length === 0 ? (
            <ListEmptyState
              icon={Inbox}
              title="Нет привязок"
              description="Создайте привязку: пользователь платформы, токен ВК и id стены сообщества."
              actionLabel="Создать"
              onAction={props.onOpenCreate}
            />
          ) : (
            <ul className="space-y-3" aria-labelledby="vk-parser-bindings-title">
              {props.bindings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl border border-border/80 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <p className="font-medium truncate">{titleFor(b)}</p>
                      <Badge variant={b.enabled ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                        {b.enabled ? "Включено" : "Выключено"}
                      </Badge>
                      <span className="text-muted-foreground font-normal text-sm font-mono">wall {b.vkOwnerId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Автор постов: <span className="font-mono">{b.platformUserId.slice(0, 8)}…</span> · интервал{" "}
                      {b.parseIntervalMinutes} мин · за прогон до {b.postsPerRun} ·{" "}
                      {b.requireModeration ? "модерация" : "сразу в ленту"}
                    </p>
                    {b.lastRunAt ? (
                      <p className="text-xs text-muted-foreground">
                        Последний опрос: {new Date(b.lastRunAt).toLocaleString("ru-RU")} · добавлено: {b.lastCreatedCount}
                      </p>
                    ) : null}
                    {b.lastError ? (
                      <p className="text-xs text-destructive break-words rounded-md bg-destructive/5 border border-destructive/15 px-2 py-1.5">
                        {b.lastError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="min-h-[var(--uix-touch-min)]"
                      disabled={props.runOneMut.isPending || !b.enabled}
                      onClick={() => props.runOneMut.mutate(b.id)}
                      aria-label={`Сканировать стену для ${titleFor(b)}`}
                    >
                      <Play className="w-4 h-4 mr-1 shrink-0" aria-hidden />
                      Сканировать
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[var(--uix-touch-min)]"
                      onClick={() => props.onOpenEdit(b)}
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] px-2 sm:px-3"
                      onClick={() => setToDelete(b)}
                      aria-label={`Удалить привязку ${titleFor(b)}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminPanelCard>

      <VkParserDeleteBindingAlert
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        bindingTitle={toDelete ? titleFor(toDelete) : ""}
        vkOwnerId={toDelete?.vkOwnerId ?? ""}
        isDeleting={props.deleteMut.isPending}
        onConfirm={() => {
          if (!toDelete) return;
          props.deleteMut.mutate(toDelete.id, {
            onSettled: () => setToDelete(null),
          });
        }}
      />
    </>
  );
}
