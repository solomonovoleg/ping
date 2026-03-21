import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle } from "lucide-react";
import { adminOpsUi } from "./i18n.ru";
import { fetchOpsTrafficShield } from "./api";
import { cn } from "@/lib/utils";

const QK = ["admin", "ops", "traffic-shield"] as const;

function minuteLabel(m: number): string {
  const d = new Date(m * 60_000);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function OpsTrafficSection() {
  const { data, isLoading, error, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: QK,
    queryFn: fetchOpsTrafficShield,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-xl mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{adminOpsUi.trafficCard}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-destructive">{adminOpsUi.trafficLoadError}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Повторить
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cur = data.currentMinute;
  const floodHint =
    cur && (cur.limited429 >= 5 || cur.anonymous >= Math.max(120, data.limits.anonymousNormal * 0.5));

  const tail = data.history.slice(-36).reverse();

  const anonLimit = data.strictApiShield ? data.limits.anonymousStrict : data.limits.anonymousNormal;
  const authLimit = data.strictApiShield ? data.limits.authenticatedStrict : data.limits.authenticatedNormal;

  return (
    <Card
      className={cn(
        floodHint && "border-amber-500/50 bg-amber-500/[0.04]",
      )}
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {adminOpsUi.trafficCard}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{adminOpsUi.trafficHint}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {adminOpsUi.trafficRefresh}:{" "}
            {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ru-RU") : "—"}
            {isFetching ? " …" : ""}
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => refetch()}>
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {floodHint ? (
          <div
            className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>
              Высокая доля анонимного трафика или много ответов 429. Включите «{adminOpsUi.trafficStrictOn}» в блоке ниже
              или усильте лимит на nginx / CDN.
            </span>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm space-y-1">
          <div className="font-medium">{adminOpsUi.trafficLimits}</div>
          <div>
            Без входа (IP): до <strong>{anonLimit}</strong> запр./мин (
            {data.strictApiShield ? "строгий" : "обычный"} режим)
          </div>
          <div>
            Авторизованные: до <strong>{authLimit}</strong> запр./мин (
            {data.strictApiShield ? "строгий" : "обычный"})
          </div>
          <div className="text-muted-foreground text-xs pt-1">
            Админка, вход, регистрация и объявление платформы не считаются в этом лимите.
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{adminOpsUi.trafficCurrentMinute}</div>
          {cur ? (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded-md border border-border/80 px-2 py-1.5">
                <dt className="text-muted-foreground">{adminOpsUi.trafficTotal}</dt>
                <dd className="font-semibold tabular-nums">{cur.total}</dd>
              </div>
              <div className="rounded-md border border-border/80 px-2 py-1.5">
                <dt className="text-muted-foreground">{adminOpsUi.trafficAnon}</dt>
                <dd className="font-semibold tabular-nums">{cur.anonymous}</dd>
              </div>
              <div className="rounded-md border border-border/80 px-2 py-1.5">
                <dt className="text-muted-foreground">{adminOpsUi.trafficAuthed}</dt>
                <dd className="font-semibold tabular-nums">{cur.authenticated}</dd>
              </div>
              <div className="rounded-md border border-border/80 px-2 py-1.5">
                <dt className="text-muted-foreground">{adminOpsUi.traffic429}</dt>
                <dd className="font-semibold tabular-nums text-destructive">{cur.limited429}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Пока нет данных за текущую минуту.</p>
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-2">{adminOpsUi.trafficHistory}</div>
          {tail.length === 0 ? (
            <p className="text-sm text-muted-foreground">История появится после накопления минутных срезов.</p>
          ) : (
            <div className="max-h-56 overflow-auto rounded-md border border-border text-xs">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2 font-medium">Время</th>
                    <th className="p-2 font-medium tabular-nums">Σ</th>
                    <th className="p-2 font-medium tabular-nums">анон</th>
                    <th className="p-2 font-medium tabular-nums">вх.</th>
                    <th className="p-2 font-medium tabular-nums">429</th>
                  </tr>
                </thead>
                <tbody>
                  {tail.map((row) => (
                    <tr key={row.minute} className="border-t border-border/60">
                      <td className="p-2 whitespace-nowrap">{minuteLabel(row.minute)}</td>
                      <td className="p-2 tabular-nums">{row.total}</td>
                      <td className="p-2 tabular-nums">{row.anonymous}</td>
                      <td className="p-2 tabular-nums">{row.authenticated}</td>
                      <td className="p-2 tabular-nums text-destructive">{row.limited429}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{adminOpsUi.trafficNoteLabel}:</span> {data.note} Uptime процесса:{" "}
          {Math.floor(data.uptimeSec / 60)} мин.
        </p>
      </CardContent>
    </Card>
  );
}
