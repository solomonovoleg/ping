import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  PhoneCall,
  RefreshCw,
  Reply,
  Send,
  XCircle,
} from "lucide-react";
import { fetchNewTelCallPasswordLog, type NewTelCallPasswordLogRow } from "@/lib/admin";
import { AdminPageHeader, AdminPanelCard, AdminStatCard, adminPageStackClass, adminSkeletonClass } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListEmptyState } from "@/components/ui/empty";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAY_OPTIONS = [7, 14, 30, 90] as const;

function utcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function scenarioLabel(scenario: string): string {
  if (scenario === "signup") return "Регистрация";
  if (scenario === "password_reset") return "Сброс пароля";
  return scenario;
}

function methodShort(method: string): string {
  if (method === "call-password/start-password-call") return "HTTP: старт звонка";
  if (method === "call-password/get-password-call-status") return "HTTP: статус звонка";
  if (method.startsWith("internal/verification/")) {
    return `Подтверждение: ${method.replace("internal/verification/", "")}`;
  }
  if (method === "internal/poll/call-details-rejected") return "Опрос: отказ (статус/код звонка)";
  if (method === "internal/poll/exhausted-or-still-pending") return "Опрос: лимит / ещё pending";
  return method;
}

type RowOutcome = "success" | "error" | "neutral";

function rowOutcome(row: NewTelCallPasswordLogRow): RowOutcome {
  if (row.apiOk === false) return "error";
  if (row.httpStatus != null && row.httpStatus >= 400) return "error";
  if (row.errorMessage && row.apiOk !== true) return "error";
  if (row.apiOk === true) return "success";
  return "neutral";
}

export default function AdminNewTelCallPasswordLogPage() {
  const [days, setDays] = useState<number>(14);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "new-tel-call-password-log", days],
    queryFn: () => fetchNewTelCallPasswordLog(days),
    staleTime: 30_000,
  });

  const rowsByDay = useMemo(() => {
    const map = new Map<string, NewTelCallPasswordLogRow[]>();
    for (const row of data?.rows ?? []) {
      const k = utcDayKey(row.createdAt);
      const list = map.get(k) ?? [];
      list.push(row);
      map.set(k, list);
    }
    return map;
  }, [data?.rows]);

  const err = error == null ? null : error instanceof Error ? error : new Error(String(error));

  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="New-Tel: звонки верификации"
        description="Каждая строка: исходящее тело (маскированный номер), входящий JSON (PIN вырезан), блок «диагностика» (URL, слои status/message/data/callDetails, сырой фрагмент при ошибке парсинга). Отдельно — события подтверждения (неверный PIN, сессия, успех выдачи тикета). Пункт в нижнем меню на телефоне: «New-Tel звонки»."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(days)}
              onValueChange={(v) => setDays(Number(v))}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[160px] min-h-[var(--uix-touch-min)]" aria-label="Период">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} дней
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[var(--uix-touch-min)]"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
              Обновить
            </Button>
          </div>
        }
      />

      {err && (
        <AdminPanelCard className="p-4 border-destructive/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive">{err.message}</p>
            <Button type="button" variant="secondary" size="sm" className="min-h-[var(--uix-touch-min)]" onClick={() => refetch()}>
              Повторить
            </Button>
          </div>
        </AdminPanelCard>
      )}

      {isLoading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-24 rounded-xl", adminSkeletonClass)} />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStatCard
              label="Запросов к API (всего)"
              value={data.summary.totalRequests}
              icon={BarChart3}
              accent="violet"
            />
            <AdminStatCard
              label="Старт звонка (обычно платно)"
              value={data.summary.startPasswordCalls}
              icon={PhoneCall}
              accent="emerald"
            />
            <AdminStatCard
              label="Опрос статуса"
              value={data.summary.statusPolls}
              icon={Reply}
              accent="sky"
            />
            <AdminStatCard
              label="С ошибкой (HTTP или ответ)"
              value={data.summary.apiErrors}
              icon={AlertTriangle}
              accent="rose"
            />
          </div>

          {data.truncated && (
            <p className="text-sm admin-text-muted rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              Показаны последние {data.rowLimit} записей за период; всего событий больше — уменьшите период или смотрите
              агрегаты по дням в таблице ниже.
            </p>
          )}

          <AdminPanelCard className="p-4 pt-5 sm:p-5">
            <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">По дням (UTC)</h2>
            <p className="mt-1 text-sm admin-text-muted mb-4">
              Легенда: «Старт» = <code className="text-xs">start-password-call</code>, «Статус» ={" "}
              <code className="text-xs">get-password-call-status</code>.
            </p>
            {data.byDay.length === 0 ? (
              <ListEmptyState
                icon={PhoneCall}
                title="Нет записей"
                description="За выбранный период обменов с New-Tel не было или таблица ещё не создана (нужна миграция)."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30 text-left admin-text-muted">
                      <th className="p-3 font-medium">День</th>
                      <th className="p-3 font-medium tabular-nums">Всего</th>
                      <th className="p-3 font-medium tabular-nums">Старт</th>
                      <th className="p-3 font-medium tabular-nums">Статус</th>
                      <th className="p-3 font-medium tabular-nums">Ошибки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDay.map((d) => (
                      <tr key={d.day} className="border-b border-border/40">
                        <td className="p-3 font-mono text-[hsl(210_20%_98%)]">{d.day}</td>
                        <td className="p-3 tabular-nums">{d.totalRequests}</td>
                        <td className="p-3 tabular-nums text-emerald-200/90">{d.startPasswordCalls}</td>
                        <td className="p-3 tabular-nums text-sky-200/90">{d.statusPolls}</td>
                        <td className="p-3 tabular-nums text-rose-200/90">{d.apiErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanelCard>

          <AdminPanelCard className="p-4 pt-5 sm:p-5">
            <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Детализация по дням</h2>
            <p className="mt-1 text-sm admin-text-muted mb-4">
              Список событий: статус сразу виден (зелёный «Успешно», красный «Ошибка»). Тела запроса, ответ и диагностика — раскройте
              строку. Дни тоже можно сворачивать.
            </p>
            {data.byDay.length === 0 ? null : (
              <div className="space-y-2">
                {data.byDay.map((d, idx) => {
                  const dayRows = rowsByDay.get(d.day) ?? [];
                  return (
                    <Collapsible key={d.day} defaultOpen={idx === 0}>
                      <CollapsibleTrigger className="group flex w-full min-h-[var(--uix-touch-min)] items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/35">
                        <span className="font-mono text-[hsl(210_20%_98%)]">{d.day}</span>
                        <span className="flex items-center gap-2 admin-text-muted tabular-nums">
                          <span className="hidden sm:inline">{dayRows.length} событий</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {dayRows.length === 0 ? (
                          <p className="mt-2 pl-1 text-sm admin-text-muted">
                            Нет строк в выборке (возможно, обрезка лимита — только более свежие дни попали в ленту).
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2 border-l border-border/40 pl-3 ml-1">
                            {dayRows.map((row) => {
                              const detailObj =
                                row.detail && typeof row.detail === "object"
                                  ? (row.detail as Record<string, unknown>)
                                  : null;
                              const appOutcomeMsg =
                                typeof detailObj?.outcomeMessage === "string" ? detailObj.outcomeMessage : null;
                              const headlineMsg = row.errorMessage ?? (row.apiOk ? appOutcomeMsg : null);
                              const outcome = rowOutcome(row);
                              return (
                                <li key={row.id} className="list-none">
                                  <Collapsible defaultOpen={false}>
                                    <div
                                      className={cn(
                                        "rounded-lg border p-2 sm:p-3 text-xs sm:text-sm",
                                        outcome === "error"
                                          ? "border-rose-500/50 bg-rose-950/20"
                                          : outcome === "success"
                                            ? "border-emerald-500/35 bg-emerald-950/15"
                                            : "border-border/40 bg-background/40",
                                      )}
                                    >
                                      <CollapsibleTrigger className="group flex w-full min-h-[var(--uix-touch-min)] flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
                                          <span className="font-mono tabular-nums text-muted-foreground">
                                            {new Date(row.createdAt).toLocaleTimeString("ru-RU", {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                              second: "2-digit",
                                            })}
                                          </span>
                                          <span className="rounded-md bg-violet-600/85 px-2 py-0.5 text-[11px] font-medium text-white sm:text-xs">
                                            {scenarioLabel(row.scenario)}
                                          </span>
                                          <span className="flex min-w-0 max-w-full items-center gap-1 text-muted-foreground">
                                            <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                            <span className="truncate">{methodShort(row.apiMethod)}</span>
                                          </span>
                                          <span
                                            className={cn(
                                              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold sm:text-xs",
                                              outcome === "success" &&
                                                "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/40",
                                              outcome === "error" &&
                                                "bg-rose-600 text-white shadow-sm ring-1 ring-rose-500/40",
                                              outcome === "neutral" && "bg-slate-600 text-white ring-1 ring-slate-500/35",
                                            )}
                                          >
                                            {outcome === "success" ? (
                                              <>
                                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                                Успешно
                                              </>
                                            ) : outcome === "error" ? (
                                              <>
                                                <XCircle className="h-3.5 w-3.5" aria-hidden />
                                                Ошибка
                                              </>
                                            ) : (
                                              "Нет статуса"
                                            )}
                                          </span>
                                          <span className="tabular-nums text-muted-foreground">
                                            {row.httpStatus != null ? `HTTP ${row.httpStatus}` : "без HTTP"} · {row.durationMs}{" "}
                                            мс
                                          </span>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
                                          Подробности
                                          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                        </span>
                                      </CollapsibleTrigger>
                                      {headlineMsg ? (
                                        <p
                                          className={cn(
                                            "mt-2 break-words pl-0.5 text-sm font-medium leading-snug",
                                            outcome === "success" && "text-emerald-100",
                                            outcome === "error" && "text-rose-100",
                                            outcome === "neutral" && "text-muted-foreground",
                                          )}
                                        >
                                          {headlineMsg}
                                        </p>
                                      ) : null}
                                      <CollapsibleContent>
                                        <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
                                          <div className="grid gap-2 md:grid-cols-2">
                                            <div>
                                              <p className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
                                                <Send className="h-3.5 w-3.5" />
                                                Исходящий запрос (тело)
                                              </p>
                                              <pre className="max-h-56 overflow-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed">
                                                {JSON.stringify(row.requestRedacted ?? {}, null, 2)}
                                              </pre>
                                            </div>
                                            <div>
                                              <p className="mb-1 flex items-center gap-1 font-medium text-muted-foreground">
                                                <Reply className="h-3.5 w-3.5" />
                                                Входящий ответ (JSON)
                                              </p>
                                              <pre className="max-h-56 overflow-auto rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed">
                                                {row.responseSanitized != null && typeof row.responseSanitized === "object"
                                                  ? JSON.stringify(row.responseSanitized, null, 2)
                                                  : String(row.responseSanitized ?? "—")}
                                              </pre>
                                            </div>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="mb-1 font-medium text-violet-200/90">
                                              Диагностика (URL, слои New-Tel, коды, атомы)
                                            </p>
                                            <pre className="max-h-[min(420px,50vh)] overflow-auto rounded-md border border-violet-500/25 bg-violet-950/25 p-2 font-mono text-[11px] leading-relaxed text-violet-100/90">
                                              {row.detail != null && typeof row.detail === "object"
                                                ? JSON.stringify(row.detail, null, 2)
                                                : String(row.detail ?? "—")}
                                            </pre>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </AdminPanelCard>
        </>
      ) : null}
    </div>
  );
}
