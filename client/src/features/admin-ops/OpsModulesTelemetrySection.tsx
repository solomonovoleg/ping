import { useQuery } from "@tanstack/react-query";
import { AdminPanelCard } from "@/features/admin-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, AlertCircle } from "lucide-react";
import { adminOpsUi } from "./i18n.ru";
import { fetchModulesTelemetry } from "./api";
import { cn } from "@/lib/utils";

const QK = ["admin", "ops", "modules-telemetry"] as const;

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return `${h} ч ${m % 60} мин`;
}

export function OpsModulesTelemetrySection() {
  const { data, isLoading, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: QK,
    queryFn: fetchModulesTelemetry,
    refetchInterval: 20_000,
  });

  if (isLoading) {
    return (
      <AdminPanelCard className="space-y-2 p-5 sm:p-6">
        <Skeleton className="h-5 w-56 bg-[hsl(var(--admin-elevated-strong))]" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl bg-[hsl(var(--admin-elevated-strong))]" />
        <Skeleton className="h-40 w-full bg-[hsl(var(--admin-elevated-strong))]" />
      </AdminPanelCard>
    );
  }

  if (error || !data) {
    return (
      <AdminPanelCard className="space-y-2 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">{adminOpsUi.modulesCard}</h2>
        <p className="text-sm text-[hsl(0_72%_62%)]">{adminOpsUi.modulesLoadError}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Повторить
        </Button>
      </AdminPanelCard>
    );
  }

  const hasErrors = data.recentErrors.length > 0;
  const tablePasteFallback = data.clientTelemetry?.tablePasteFallback;
  const iseeTtfp = data.clientTelemetry?.iseeTimeToFirstPlay;

  return (
    <AdminPanelCard className={cn("space-y-6 p-5 sm:p-6", hasErrors && "border-[hsl(0_62%_42%/0.35)]")}>
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-[hsl(210_20%_98%)]">
          <Layers className="h-4 w-4" />
          {adminOpsUi.modulesCard}
        </h2>
        <p className="mt-1 text-sm admin-text-muted">{adminOpsUi.modulesHint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs admin-text-muted">
          <span>
            Uptime процесса: {formatUptime(data.uptimeSec)} · {adminOpsUi.trafficRefresh}:{" "}
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ru-RU") : "—"}
            {isFetching ? " …" : ""}
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => refetch()}>
            Обновить
          </Button>
        </div>
      </div>
      <div className="space-y-6">
        {data.modules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{adminOpsUi.modulesEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-2 font-medium min-w-[140px]">{adminOpsUi.modulesTableModule}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap">{adminOpsUi.modulesTableRequests}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap">{adminOpsUi.modulesTableAvgMs}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap">{adminOpsUi.modulesTableUniqueHour}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap text-destructive/90">{adminOpsUi.modulesTable5xx}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap">{adminOpsUi.modulesTable4xx}</th>
                  <th className="p-2 font-medium text-right whitespace-nowrap text-amber-700 dark:text-amber-400">
                    {adminOpsUi.modulesTable429}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.modules.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="p-2">
                      <span className="font-medium">{row.label}</span>
                      <span className="block text-xs text-muted-foreground font-mono">{row.id}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{row.requests.toLocaleString("ru-RU")}</td>
                    <td className="p-2 text-right tabular-nums">{row.avgMs}</td>
                    <td className="p-2 text-right tabular-nums">{row.uniqueUsersThisHour.toLocaleString("ru-RU")}</td>
                    <td className="p-2 text-right tabular-nums text-destructive">{row.errors5xx}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{row.errors4xx}</td>
                    <td className="p-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{row.limited429}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-destructive" aria-hidden />
            {adminOpsUi.modulesErrorsTitle}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">{adminOpsUi.modulesLogHint}</p>
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">{adminOpsUi.modulesErrorsEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {data.recentErrors.map((e, i) => (
                <li
                  key={`${e.at}-${e.path}-${i}`}
                  className="rounded-lg border border-border/80 bg-muted/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                    <span className="text-xs text-muted-foreground font-mono">{new Date(e.at).toLocaleString("ru-RU")}</span>
                    <span className="font-medium">{e.moduleLabel}</span>
                    <span
                      className={cn(
                        "font-mono text-xs px-1.5 py-0.5 rounded",
                        e.status >= 500 ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      )}
                    >
                      {e.status}
                    </span>
                    <span className="text-muted-foreground">
                      {e.method} {e.durationMs}ms
                    </span>
                  </div>
                  <p className="font-mono text-xs break-all mt-1 text-foreground/90">{e.path}</p>
                  {e.userId ? (
                    <p className="text-xs text-muted-foreground mt-1">user: {e.userId}</p>
                  ) : null}
                  {e.detail ? (
                    <p className="text-xs mt-2 text-destructive/90 break-words">{e.detail}</p>
                  ) : null}
                  {e.hints.length > 0 ? (
                    <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4 space-y-1">
                      {e.hints.map((h, hi) => (
                        <li key={hi}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {iseeTtfp ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">Клиент: iSee time-to-first-play</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Счётчики с момента старта процесса. С клиента — не чаще 10 с и не более 40 событий за сессию вкладки.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">событий</p>
                <p className="tabular-nums text-sm font-semibold">{iseeTtfp.count.toLocaleString("ru-RU")}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">уник. пользователей</p>
                <p className="tabular-nums text-sm font-semibold">{iseeTtfp.uniqueUsers.toLocaleString("ru-RU")}</p>
              </div>
            </div>
            {iseeTtfp.recent.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {iseeTtfp.recent.slice(0, 8).map((e, idx) => (
                  <li key={`${e.at}-${e.userId}-${idx}`} className="rounded-md border bg-muted/15 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-muted-foreground">{new Date(e.at).toLocaleString("ru-RU")}</span>
                      <span className="tabular-nums font-medium">{e.ms} ms</span>
                      <span className="text-muted-foreground">post: {e.postId}</span>
                      {e.connectionType ? (
                        <span className="text-muted-foreground">net: {e.connectionType}</span>
                      ) : null}
                      <span className="text-muted-foreground">user: {e.userId}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {tablePasteFallback ? (
          <div>
            <h3 className="text-sm font-semibold mb-2">Клиент: fallback развертывания таблиц</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Счётчики с момента старта процесса. Нужны для контроля зависаний UI при выборе CSV/Excel.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">fallback shown</p>
                <p className="tabular-nums text-sm font-semibold">
                  {tablePasteFallback.counts.fallback_shown.toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">retry clicked</p>
                <p className="tabular-nums text-sm font-semibold">
                  {tablePasteFallback.counts.retry_clicked.toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">reopen success</p>
                <p className="tabular-nums text-sm font-semibold">
                  {tablePasteFallback.counts.reopen_success.toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="text-[11px] text-muted-foreground">уник. пользователей</p>
                <p className="tabular-nums text-sm font-semibold">
                  {tablePasteFallback.uniqueUsers.toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
            {tablePasteFallback.recent.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {tablePasteFallback.recent.slice(0, 8).map((e, idx) => (
                  <li key={`${e.at}-${e.userId}-${idx}`} className="rounded-md border bg-muted/15 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-muted-foreground">{new Date(e.at).toLocaleString("ru-RU")}</span>
                      <span className="font-medium">{e.event}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {e.cols}x{e.rows}
                      </span>
                      <span className="text-muted-foreground">user: {e.userId}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminPanelCard>
  );
}
