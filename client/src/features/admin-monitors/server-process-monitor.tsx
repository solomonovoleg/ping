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
import { Button } from "@/components/ui/button";
import { AdminMetricTile, AdminPanelCard } from "@/features/admin-shell";
import type { AdminMetricPoint } from "@/lib/admin";
import { Activity, Cpu } from "lucide-react";

export function ServerProcessLiveCards({ current }: { current: AdminMetricPoint | undefined }) {
  if (!current) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <AdminMetricTile>
        <p className="text-xs admin-text-muted">Сейчас в сети (WS)</p>
        <p className="text-xl font-semibold tabular-nums text-[hsl(210_20%_98%)]">{current.onlineUsers}</p>
      </AdminMetricTile>
      <AdminMetricTile>
        <p className="text-xs admin-text-muted">Соединений /calls</p>
        <p className="text-xl font-semibold tabular-nums text-[hsl(210_20%_98%)]">{current.openConnections}</p>
      </AdminMetricTile>
      <AdminMetricTile>
        <p className="text-xs admin-text-muted">Heap (Node)</p>
        <p className="text-xl font-semibold tabular-nums text-[hsl(210_20%_98%)]">{current.heapUsedMb} МБ</p>
      </AdminMetricTile>
      <AdminMetricTile>
        <p className="text-xs admin-text-muted">RSS (процесс)</p>
        <p className="text-xl font-semibold tabular-nums text-[hsl(210_20%_98%)]">{current.rssMb} МБ</p>
      </AdminMetricTile>
      <AdminMetricTile className="sm:col-span-2 lg:col-span-1">
        <p className="text-xs admin-text-muted">Load 1m</p>
        <p className="text-xl font-semibold tabular-nums text-[hsl(210_20%_98%)]">{current.load1m}</p>
      </AdminMetricTile>
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
    <AdminPanelCard className="p-4 pt-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[hsl(var(--admin-muted))]" />
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Онлайн и нагрузка процесса</h2>
        </div>
        {isFetching ? <span className="text-xs admin-text-muted">Обновление…</span> : null}
      </div>
      <p className="mb-4 text-xs admin-text-muted">
        Точки каждые 5 минут после перезапуска сервера. {metricsNote ?? ""}
      </p>
      {data.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 text-center text-sm admin-text-muted">
          <Cpu className="h-8 w-8 opacity-50" />
          <p>Нет снимков нагрузки. Подождите до первого интервала сбора (до 5 мин после старта сервера).</p>
        </div>
      ) : (
        <div className="h-64 w-full min-h-[16rem]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" opacity={0.5} />
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
                stroke="hsl(var(--admin-accent))"
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="heapUsedMb"
                name="Heap МБ"
                stroke="hsl(215 16% 55%)"
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
    </AdminPanelCard>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="admin-surface-card h-20 animate-pulse bg-[hsl(var(--admin-elevated)/0.5)]" />
          ))}
        </div>
        <div className="admin-surface-card h-72 animate-pulse bg-[hsl(var(--admin-elevated)/0.5)]" />
      </div>
    );
  }
  if (error) {
    return (
      <AdminPanelCard className="p-4">
        <p className="mb-2 text-sm text-[hsl(0_72%_62%)]">
          {error instanceof Error ? error.message : "Не удалось загрузить метрики процесса"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[hsl(var(--admin-border))] bg-transparent"
          onClick={onRetry}
        >
          Повторить
        </Button>
      </AdminPanelCard>
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
