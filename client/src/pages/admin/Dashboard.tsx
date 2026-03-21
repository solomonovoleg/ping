import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchDashboardAnalytics, fetchDashboardStats } from "@/lib/admin";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ServerProcessLiveCards, ServerProcessHistoryChart } from "@/features/admin-monitors/server-process-monitor";
import { Users, UserX, UserMinus, UserPlus } from "lucide-react";

const REGISTRATION_DAYS = 14;

export default function AdminDashboard() {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["admin", "dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
    isFetching: analyticsFetching,
  } = useQuery({
    queryKey: ["admin", "dashboard", "analytics", REGISTRATION_DAYS],
    queryFn: () => fetchDashboardAnalytics(REGISTRATION_DAYS),
    refetchInterval: 60_000,
  });

  const registrationChartData = useMemo(
    () =>
      (analytics?.registrationsByDay ?? []).map((r) => ({
        ...r,
        label: format(parseISO(`${r.day}T12:00:00.000Z`), "d MMM", { locale: ru }),
      })),
    [analytics]
  );

  const current = analytics?.serverMetrics.current;

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-12 rounded bg-muted" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (statsError || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-destructive">
          {statsError instanceof Error ? statsError.message : "Не удалось загрузить статистику"}
        </p>
      </div>
    );
  }

  const cards = [
    { title: "Всего пользователей", value: stats.total, icon: Users },
    { title: "Заблокировано", value: stats.blocked, icon: UserX },
    { title: "Удалено (скрыто)", value: stats.deleted, icon: UserMinus },
    { title: "За сегодня", value: stats.registeredToday, icon: UserPlus },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title} className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ServerProcessLiveCards current={current} />

      {analyticsLoading && !analytics ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="h-72 animate-pulse bg-muted/30" />
          <Card className="h-72 animate-pulse bg-muted/30" />
        </div>
      ) : analyticsError ? (
        <Card className="p-4">
          <p className="text-destructive text-sm mb-2">
            {analyticsError instanceof Error ? analyticsError.message : "Не удалось загрузить графики"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchAnalytics()}>
            Повторить
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4 pt-5">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Новые регистрации по дням</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Последние {REGISTRATION_DAYS} дней (UTC), без удалённых аккаунтов
            </p>
            <div className="h-64 w-full min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={registrationChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8 }}
                    formatter={(v: number) => [v, "Регистраций"]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { day?: string } | undefined;
                      return p?.day ?? "";
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    fill="url(#regFill)"
                    strokeWidth={2}
                    isAnimationActive={animate}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <ServerProcessHistoryChart
            data={analytics?.serverMetrics.history ?? []}
            metricsNote={analytics?.metricsNote}
            isFetching={analyticsFetching}
            animate={animate}
          />
        </div>
      )}
    </div>
  );
}
