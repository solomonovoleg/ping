import { useQuery } from "@tanstack/react-query";
import { fetchDashboardAnalytics } from "@/lib/admin";
import { usePrefersReducedMotion } from "@/lib/motion";
import { OpsModulesTelemetrySection } from "@/features/admin-ops/OpsModulesTelemetrySection";
import { OpsTrafficSection } from "@/features/admin-ops/OpsTrafficSection";
import { ServerProcessMonitorBlock } from "@/features/admin-monitors/server-process-monitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Мониторы</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Единая страница технических метрик: процесс Node (память, load, WebSocket звонков), запросы API по модулям и
          минутный трафик с учётом защиты от флуда. Баннер, жалобы и настройки платформы остаются в разделе «Операции».
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сервер и реальное время</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Те же данные, что на дашборде (история — снимки раз в 5 минут).
          </p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <OpsModulesTelemetrySection />
      <OpsTrafficSection />
    </div>
  );
}
