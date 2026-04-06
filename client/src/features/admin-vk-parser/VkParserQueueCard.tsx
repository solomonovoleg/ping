import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { AdminPanelCard } from "@/features/admin-shell";
import { ListEmptyState } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import type { AdminVkParserBinding, AdminVkParserItem } from "@/lib/admin";
import { VK_PARSER_ITEM_STATUSES } from "@shared/schema";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { QUEUE_STATUS_LABELS } from "./constants";
import { VkParserQueueAnimatedList } from "./VkParserQueueAnimatedList";
import { VkParserQueueSkeleton } from "./VkParserQueueSkeleton";
import { VkParserUnavailableHint } from "./VkParserUnavailableHint";

export function VkParserQueueCard(props: {
  bindings: AdminVkParserBinding[];
  bindingsLoading: boolean;
  queueStatusFilter: string;
  setQueueStatusFilter: (v: string) => void;
  queueBindingFilter: string;
  setQueueBindingFilter: (v: string) => void;
  queuePage: number;
  setQueuePage: Dispatch<SetStateAction<number>>;
  queue: AdminVkParserItem[];
  queueTotal: number;
  queueFrom: number;
  queueTo: number;
  queueTotalPages: number;
  queueLoading: boolean;
  queueFetching: boolean;
  queueError: boolean;
  refetchQueue: () => void;
  bindingLabel: Map<string, string>;
  approveMut: UseMutationResult<{ platformPostId: string }, Error, string, unknown>;
  rejectMut: UseMutationResult<void, Error, string, unknown>;
}) {
  const filtersDisabled = props.bindingsLoading;
  const showQueueSkeleton = props.queueLoading && props.queue.length === 0;
  const showRefetchHint = props.queueFetching && !props.queueLoading && props.queueTotal > 0;

  return (
    <AdminPanelCard className="p-5 sm:p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(210_20%_98%)]" id="vk-parser-queue-title">
            Очередь и история
          </h2>
          <p className="mt-1.5 text-sm admin-text-muted">
            Модерация и архив импорта. Фильтры не меняют данные на сервере — только отображение.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5 min-w-[200px] flex-1">
            <Label htmlFor="vk-queue-status">Статус</Label>
            <select
              id="vk-queue-status"
              className="w-full min-h-[var(--uix-touch-min)] rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={props.queueStatusFilter}
              disabled={filtersDisabled}
              onChange={(e) => props.setQueueStatusFilter(e.target.value)}
              aria-busy={filtersDisabled}
            >
              <option value="">Все статусы</option>
              {VK_PARSER_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QUEUE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 min-w-[200px] flex-1">
            <Label htmlFor="vk-queue-binding">Привязка</Label>
            <select
              id="vk-queue-binding"
              className="w-full min-h-[var(--uix-touch-min)] rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={props.queueBindingFilter}
              disabled={filtersDisabled}
              onChange={(e) => props.setQueueBindingFilter(e.target.value)}
              aria-busy={filtersDisabled}
            >
              <option value="">{props.bindingsLoading ? "Загрузка…" : "Все привязки"}</option>
              {props.bindings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || b.vkOwnerId}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div>
        {showRefetchHint ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3" aria-live="polite">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
            Обновляем список…
          </p>
        ) : null}

        {showQueueSkeleton ? (
          <VkParserQueueSkeleton />
        ) : props.queueError ? (
          <div
            className="flex flex-col gap-3 items-start rounded-lg border border-destructive/25 bg-destructive/5 p-4"
            role="alert"
          >
            <div className="flex gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium">Импорт из ВК сейчас недоступен</p>
                <p className="text-xs text-muted-foreground mt-1">Очередь модерации не открывается.</p>
                <VkParserUnavailableHint />
              </div>
            </div>
            <Button type="button" variant="outline" className="min-h-[var(--uix-touch-min)]" onClick={() => props.refetchQueue()}>
              Повторить
            </Button>
          </div>
        ) : props.queueTotal === 0 ? (
          <ListEmptyState
            icon={Inbox}
            title="Нет записей"
            description={
              props.queueStatusFilter || props.queueBindingFilter
                ? "По выбранным фильтрам ничего нет. Смените статус или привязку."
                : "Новые посты из ВК появятся здесь при включённой модерации."
            }
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 tabular-nums">
              {props.queueFrom}–{props.queueTo} из {props.queueTotal}
              {props.queueTotalPages > 1 ? ` · стр. ${props.queuePage + 1} из ${props.queueTotalPages}` : null}
            </p>
            <VkParserQueueAnimatedList
              queue={props.queue}
              bindingLabel={props.bindingLabel}
              approveMut={props.approveMut}
              rejectMut={props.rejectMut}
              ariaLabelledBy="vk-parser-queue-title"
            />
            {props.queueTotalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[var(--uix-touch-min)]"
                  disabled={props.queuePage <= 0 || props.queueFetching}
                  onClick={() => props.setQueuePage((p) => Math.max(0, p - 1))}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft className="w-4 h-4 mr-1 shrink-0" aria-hidden />
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[var(--uix-touch-min)]"
                  disabled={props.queuePage >= props.queueTotalPages - 1 || props.queueFetching}
                  onClick={() => props.setQueuePage((p) => Math.min(props.queueTotalPages - 1, p + 1))}
                  aria-label="Следующая страница"
                >
                  Вперёд
                  <ChevronRight className="w-4 h-4 ml-1 shrink-0" aria-hidden />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminPanelCard>
  );
}
