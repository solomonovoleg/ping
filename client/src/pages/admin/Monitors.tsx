import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchDashboardAnalytics } from "@/lib/admin";
import { usePrefersReducedMotion } from "@/lib/motion";
import { OpsModulesTelemetrySection } from "@/features/admin-ops/OpsModulesTelemetrySection";
import { OpsTrafficSection } from "@/features/admin-ops/OpsTrafficSection";
import { ServerProcessMonitorBlock } from "@/features/admin-monitors/server-process-monitor";
import { AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";

const ANALYTICS_DAYS = 14;

export default function AdminMonitorsPage() {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;

  const { data: analytics, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "dashboard", "analytics", ANALYTICS_DAYS],
    queryFn: () => fetchDashboardAnalytics(ANALYTICS_DAYS),
    refetchInterval: 60_000,
  });

  const err =
    error == null ? null : error instanceof Error ? error : new Error(String(error));

  const current = analytics?.serverMetrics.current;
  const history = analytics?.serverMetrics.history ?? [];

  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Мониторы"
        description="Технические метрики: процесс Node (память, load, WebSocket звонков), запросы API по модулям и минутный трафик с учётом защиты от флуда. Жалобы и настройки платформы — «Модерация» → «Операции»."
      />

      <AdminPanelCard className="p-4 pt-5 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[hsl(210_20%_98%)]">Сервер и реальное время</h2>
          <p className="mt-1 text-sm admin-text-muted">Те же данные, что на дашборде (история — снимки раз в 5 минут).</p>
        </div>
        <ServerProcessMonitorBlock
          isLoading={isLoading && !analytics}
          error={err}
          onRetry={() => refetch()}
          current={current}
          history={history}
          metricsNote={analytics?.metricsNote}
          isFetching={isFetching}
          animate={animate}
        />
      </AdminPanelCard>

      <OpsModulesTelemetrySection />
      <OpsTrafficSection />
    </div>
  );
}
