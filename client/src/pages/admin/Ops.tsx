import { OpsPlatformSection } from "@/features/admin-ops/OpsPlatformSection";
import { OpsReportsSection } from "@/features/admin-ops/OpsReportsSection";
import { OpsTrafficSection } from "@/features/admin-ops/OpsTrafficSection";
import { adminOpsUi } from "@/features/admin-ops/i18n.ru";

export default function AdminOpsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{adminOpsUi.pageTitle}</h1>
      <OpsTrafficSection />
      <OpsPlatformSection />
      <OpsReportsSection />
    </div>
  );
}
