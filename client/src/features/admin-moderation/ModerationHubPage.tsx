import { useLocation } from "wouter";
import {
  SlidersHorizontal,
  ListChecks,
  Fingerprint,
  Images,
  AlertTriangle,
  ChevronRight,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminPageHeader, AdminPanelCard, adminPageStackClass } from "@/features/admin-shell";

type HubEntry = {
  to: string;
  title: string;
  description: string;
  Icon: typeof SlidersHorizontal;
};

const ENTRY_GROUPS: Array<{ id: string; label: string; entries: HubEntry[] }> = [
  {
    id: "ugc",
    label: "Операционная модерация",
    entries: [
      {
        to: "/admin/ops",
        title: "Операции",
        description: "Очередь жалоб пользователей, баннер, настройки платформы и отчёты.",
        Icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: "apple",
    label: "App Store (Apple)",
    entries: [
      {
        to: "/admin/store-review",
        title: "Сторы и UGC",
        description: "Apple §1.2: модерация UGC, чеклист, шаблон Review Notes.",
        Icon: ListChecks,
      },
      {
        to: "/admin/store-review-privacy",
        title: "Сторы: Privacy",
        description: "Удаление аккаунта, App Privacy, export compliance, строки iOS, ATT.",
        Icon: Fingerprint,
      },
      {
        to: "/admin/store-review-metadata",
        title: "Сторы: листинг",
        description: "Скриншоты, точность метаданных, возрастной рейтинг, локализации.",
        Icon: Images,
      },
      {
        to: "/admin/store-review-risks",
        title: "Сторы: риски ревью",
        description: "IAP §3.1, минимальная функциональность, стабильность, entitlements.",
        Icon: AlertTriangle,
      },
    ],
  },
  {
    id: "play",
    label: "Google Play",
    entries: [
      {
        to: "/admin/store-review-play",
        title: "Google Play",
        description: "Data safety, UGC, политики Play; согласование с анкетой и продуктом.",
        Icon: Smartphone,
      },
    ],
  },
];

/** Единая точка входа: модерация контента и чеклисты под сторы. Маршрут `/admin/moderation`. */
export default function ModerationHubPage() {
  const [, setLocation] = useLocation();

  return (
    <div className={cn(adminPageStackClass(), "space-y-8")}>
      <AdminPageHeader
        title="Модерация"
        description="Жалобы пользователей, чеклисты App Store и Google Play, Privacy и листинг. Разделы независимы — сохраните нужные маршруты в закладки."
      />

      <div className="space-y-6">
        {ENTRY_GROUPS.map((group) => (
          <section key={group.id} className="space-y-3">
            <div className="px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[hsl(var(--admin-muted))]">
                {group.label}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.entries.map(({ to, title, description, Icon }) => (
                <AdminPanelCard key={to} className="flex flex-col p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--admin-border)/0.45)] bg-[hsl(var(--admin-elevated)/0.35)]">
                      <Icon className="h-5 w-5 text-[hsl(210_18%_88%)]" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-[hsl(210_20%_98%)]">{title}</h3>
                      <p className="mt-1 text-sm admin-text-muted leading-snug">{description}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4 w-full gap-2"
                    onClick={() => setLocation(to)}
                  >
                    Открыть
                    <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
                  </Button>
                </AdminPanelCard>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
