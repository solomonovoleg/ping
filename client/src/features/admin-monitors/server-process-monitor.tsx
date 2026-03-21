import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminMetricPoint } from "@/lib/admin";
import { Activity, Cpu } from "lucide-react";

export function ServerProcessLiveCards({ current }: { current: AdminMetricPoint | undefined }) {
  if (!current) return null;
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Сейчас в сети (WS)</p>
        <p className="text-xl font-semibold tabular-nums">{current.onlineUsers}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Соединений /calls</p>
        <p className="text-xl font-semibold tabular-nums">{current.openConnections}</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">Heap (Node)</p>
        <p className="text-xl font-semibold tabular-nums">{current.heapUsedMb} МБ</p>
      </Card>
      <Card className="p-3">
        <p className="text-xs text-muted-foreground">RSS (процесс)</p>
        <p className="text-xl font-semibold tabular-nums">{current.rssMb} МБ</p>
      </Card>
      <Card className="p-3 sm:col-span-2 lg:col-span-1">
        <p className="text-xs text-muted-foreground">Load 1m</p>
        <p className="text-xl font-semibold tabular-nums">{current.load1m}</p>
      </Card>
    </div>
  );
}

type HistoryChartProps = {
  data: AdminMetricPoint[];
  metricsNote?: string;
  isFetching?: boolean;
  animate: boolean;
};

export function ServerProcessHistoryChart({ data, metricsNote, isFetching, animate }: HistoryChartProps) {
  return (
    <Card className="p-4 pt-5">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Онлайн и нагрузка процесса</h2>
        </div>
        {isFetching ? <span className="text-xs text-muted-foreground">Обновление…</span> : null}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Точки каждые 5 минут после перезапуска сервера. {metricsNote ?? ""}
      </p>
      {data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2 px-4">
          <Cpu className="h-8 w-8 opacity-50" />
          <p>Нет снимков нагрузки. Подождите до первого интервала сбора (до 5 мин после старта сервера).</p>
        </div>
      ) : (
        <div className="h-64 w-full min-h-[16rem]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="at"
                tick={{ fontSize: 10 }}
                tickFormatter={(t) => format(parseISO(t), "dd.MM HH:mm", { locale: ru })}
                interval="preserveStartEnd"
              />
              <YAxis yAxisId="left" width={36} tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" width={36} tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8 }}
                labelFormatter={(t) => format(parseISO(t as string), "PPp", { locale: ru })}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="onlineUsers"
                name="В сети"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="heapUsedMb"
                name="Heap МБ"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={animate}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="load1m"
                name="Load 1m"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={animate}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

type MonitorBlockProps = {
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  current: AdminMetricPoint | undefined;
  history: AdminMetricPoint[];
  metricsNote?: string;
  isFetching?: boolean;
  animate: boolean;
};

export function ServerProcessMonitorBlock({
  isLoading,
  error,
  onRetry,
  current,
  history,
  metricsNote,
  isFetching,
  animate,
}: MonitorBlockProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted/30" />
          ))}
        </div>
        <Card className="h-72 animate-pulse bg-muted/30" />
      </div>
    );
  }
  if (error) {
    return (
      <Card className="p-4">
        <p className="text-destructive text-sm mb-2">
          {error instanceof Error ? error.message : "Не удалось загрузить метрики процесса"}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <ServerProcessLiveCards current={current} />
      <ServerProcessHistoryChart
        data={history}
        metricsNote={metricsNote}
        isFetching={isFetching}
        animate={animate}
      />
    </div>
  );
}
