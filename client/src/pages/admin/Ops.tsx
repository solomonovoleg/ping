import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OpsPlatformSection } from "@/features/admin-ops/OpsPlatformSection";
import { OpsReportsSection } from "@/features/admin-ops/OpsReportsSection";
import { adminOpsUi } from "@/features/admin-ops/i18n.ru";

export default function AdminOpsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{adminOpsUi.pageTitle}</h1>

      <Card className="bg-muted/20 border-dashed">
        <CardContent className="py-3 text-sm text-muted-foreground flex flex-wrap items-center gap-3 justify-between">
          <span className="min-w-0">
            Метрики процесса, API по модулям и минутный трафик — на странице «Мониторы».
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => setLocation("/admin/monitors")}>
            Открыть мониторы
          </Button>
        </CardContent>
      </Card>

      <OpsPlatformSection />
      <OpsReportsSection />
    </div>
  );
}
