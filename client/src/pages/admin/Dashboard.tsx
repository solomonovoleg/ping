import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { fetchDashboardAnalytics, fetchDashboardStats } from "@/lib/admin";
import { usePrefersReducedMotion } from "@/lib/motion";
import { ServerProcessLiveCards, ServerProcessHistoryChart } from "@/features/admin-monitors/server-process-monitor";
import {
  AdminPageHeader,
  AdminPanelCard,
  AdminStatCard,
  adminPageStackClass,
} from "@/features/admin-shell";
import { Users, UserX, UserMinus, UserPlus } from "lucide-react";

const REGISTRATION_DAYS = 14;

export default function AdminDashboard() {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
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
      <div className={adminPageStackClass()}>
        <div className="h-10 w-48 animate-pulse rounded-lg bg-[hsl(var(--admin-elevated))]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-surface-card animate-pulse p-5">
              <div className="flex gap-4">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-[hsl(var(--admin-elevated-strong))]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-[hsl(var(--admin-elevated-strong))]" />
                  <div className="h-8 w-16 rounded bg-[hsl(var(--admin-elevated-strong))]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (statsError || !stats) {
    return (
      <div className={adminPageStackClass()}>
        <AdminPageHeader title="Дашборд" description="Сводка по пользователям и активности" showUserChrome={false} />
        <ErrorWithRetry
          title="Не удалось загрузить статистику"
          description={statsError instanceof Error ? statsError.message : "Ошибка загрузки"}
          onRetry={() => void refetchStats()}
          className="min-h-[220px]"
        />
      </div>
    );
  }

  const cards = [
    { title: "Всего пользователей", value: stats.total, icon: Users, accent: "violet" as const },
    { title: "Заблокировано", value: stats.blocked, icon: UserX, accent: "rose" as const },
    { title: "Удалено (скрыто)", value: stats.deleted, icon: UserMinus, accent: "amber" as const },
    { title: "За сегодня", value: stats.registeredToday, icon: UserPlus, accent: "emerald" as const },
  ];

  return (
    <div className={adminPageStackClass()}>
      <AdminPageHeader
        title="Дашборд"
        description="Сводка по пользователям, нагрузке процесса и регистрациям"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, icon, accent }) => (
          <AdminStatCard key={title} label={title} value={value} icon={icon} accent={accent} />
        ))}
      </div>

      <ServerProcessLiveCards current={current} />

      {analyticsLoading && !analytics ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="admin-surface-card h-72 animate-pulse bg-[hsl(var(--admin-elevated)/0.5)]" />
          <div className="admin-surface-card h-72 animate-pulse bg-[hsl(var(--admin-elevated)/0.5)]" />
        </div>
      ) : analyticsError ? (
        <ErrorWithRetry
          title="Не удалось загрузить графики"
          description={analyticsError instanceof Error ? analyticsError.message : "Не удалось загрузить данные"}
          onRetry={() => void refetchAnalytics()}
          className="min-h-[220px]"
        />
      ) : registrationChartData.length === 0 ? (
        <ListEmptyState
          icon={UserPlus}
          title="Недостаточно данных для графика"
          description="Новые регистрации пока не поступали или аналитика ещё не успела собраться."
          actionLabel="Повторить"
          onAction={() => void refetchAnalytics()}
          className="min-h-[220px]"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminPanelCard className="p-4 pt-5">
            <div className="mb-1 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[hsl(var(--admin-muted))]" />
              <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Новые регистрации по дням</h2>
            </div>
            <p className="mb-4 text-xs admin-text-muted">
              Последние {REGISTRATION_DAYS} дней (UTC), без удалённых аккаунтов
            </p>
            <div className="h-64 w-full min-h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={registrationChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--admin-accent))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--admin-accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--admin-border))" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(215 16% 62%)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tick={{ fontSize: 11, fill: "hsl(215 16% 62%)" }}
                  />
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
                    stroke="hsl(var(--admin-accent))"
                    fill="url(#regFill)"
                    strokeWidth={2}
                    isAnimationActive={animate}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AdminPanelCard>

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
