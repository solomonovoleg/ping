import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OpsPlatformSection } from "@/features/admin-ops/OpsPlatformSection";
import { OpsReportsSection } from "@/features/admin-ops/OpsReportsSection";
import { adminOpsUi } from "@/features/admin-ops/i18n.ru";
import { AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";

export default function AdminOpsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title={adminOpsUi.pageTitle}
        description="Баннер, жалобы, настройки платформы и отчёты. Технические метрики — на странице «Мониторы»."
      />

      <AdminPanelCard className="border-dashed border-[hsl(var(--admin-border)/0.5)] bg-[hsl(var(--admin-elevated)/0.25)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm admin-text-muted">
          <span className="min-w-0">
            Метрики процесса, API по модулям и минутный трафик — на странице «Мониторы». Остальные подразделы модерации — в обзоре.
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/admin/moderation")}>
              Обзор модерации
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setLocation("/admin/monitors")}>
              Мониторы
            </Button>
          </div>
        </div>
      </AdminPanelCard>

      <OpsPlatformSection />
      <OpsReportsSection />
    </div>
  );
}
