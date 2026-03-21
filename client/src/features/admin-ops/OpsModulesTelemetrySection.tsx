import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-full max-w-2xl mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{adminOpsUi.modulesCard}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-destructive">{adminOpsUi.modulesLoadError}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasErrors = data.recentErrors.length > 0;

  return (
    <Card className={cn(hasErrors && "border-destructive/30")}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" />
          {adminOpsUi.modulesCard}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{adminOpsUi.modulesHint}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Uptime процесса: {formatUptime(data.uptimeSec)} ·{" "}
            {adminOpsUi.trafficRefresh}:{" "}
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ru-RU") : "—"}
            {isFetching ? " …" : ""}
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => refetch()}>
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
