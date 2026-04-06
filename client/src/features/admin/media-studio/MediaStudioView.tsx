import { useState } from "react";
import { Clapperboard, Link2, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { SyntheticUsersSection } from "./SyntheticUsersSection";
import { CampaignsSection } from "./CampaignsSection";
import { GroupChatsSection } from "./GroupChatsSection";
import { AdminPageHeader, adminPageStackClass } from "@/features/admin-shell";

type TabId = "users" | "groups" | "campaigns";

const TABS: { id: TabId; label: string; icon: typeof Clapperboard }[] = [
  { id: "users", label: "Пользователи", icon: Clapperboard },
  { id: "groups", label: "Групповые чаты", icon: Link2 },
  { id: "campaigns", label: "Контент / кампании", icon: LayoutGrid },
];

export function MediaStudioView() {
  const [tab, setTab] = useState<TabId>("users");

  return (
    <div className={cn(adminPageStackClass(), "max-w-4xl space-y-6")}>
      <AdminPageHeader
        title="Медиа-студия"
        description="Синтетические пользователи и (далее) группы по ссылке и отложенные посты. Доступ: admin / super_admin."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <TapScaleButton
            key={id}
            type="button"
            haptic
            onClick={() => setTab(id)}
            className={cn(
              "min-h-[var(--uix-touch-min)] rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-[hsl(var(--admin-accent)/0.35)] text-[hsl(var(--admin-accent-foreground))] ring-1 ring-[hsl(var(--admin-accent)/0.45)]"
                : "bg-[hsl(var(--admin-elevated)/0.45)] text-[hsl(var(--admin-muted))] hover:text-[hsl(210_20%_92%)]",
            )}
          >
            <Icon className="inline h-4 w-4 mr-1.5 align-text-bottom" aria-hidden />
            {label}
          </TapScaleButton>
        ))}
      </div>

      {tab === "users" ? (
        <SyntheticUsersSection />
      ) : tab === "groups" ? (
        <GroupChatsSection />
      ) : (
        <CampaignsSection />
      )}
    </div>
  );
}
