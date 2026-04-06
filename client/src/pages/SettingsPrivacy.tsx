import { useState } from "react";
import { ChevronRight, Database, Lock, Scale, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { LegalSettingsNavRow } from "@/features/store-moderation/block-02-legal/legal-settings-nav-row";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";

export default function SettingsPrivacy() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [privacySaving, setPrivacySaving] = useState(false);

  const handleHideFromSearchChange = async (checked: boolean) => {
    setPrivacySaving(true);
    try {
      await updateProfile({ hideFromSearch: checked });
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleDmPolicyChange = async (value: "all" | "followers" | "mutual") => {
    setPrivacySaving(true);
    try {
      await updateProfile({ dmPolicy: value });
      await refetch();
      toast({ title: "Сохранено", duration: 1800 });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleGroupAddMePolicyChange = async (value: "all" | "followers" | "mutual") => {
    setPrivacySaving(true);
    try {
      await updateProfile({ groupAddMePolicy: value });
      await refetch();
      toast({ title: "Сохранено", duration: 1800 });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPrivacySaving(false);
    }
  };

  return (
    <SettingsScreenShell title="Приватность">
      <p className="text-sm text-muted-foreground -mt-1">
        Видимость профиля и правила: кто может писать вам или добавлять в группы.
      </p>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-blue-500 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[16px] font-medium">Скрыть профиль из поиска</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Вас не найдут в глобальном поиске. Написать и создать чат можно только по прямой ссылке и только если вы в
                контактах у человека.
              </p>
            </div>
          </div>
          <Switch
            checked={user?.hideFromSearch ?? false}
            onCheckedChange={handleHideFromSearchChange}
            disabled={privacySaving}
            className="shrink-0"
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-4 space-y-4">
        <div>
          <p className="text-[15px] font-medium">Личные сообщения</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Кто может начать с вами новый диалог. «Подписчики» — пользователи, которые подписаны на вас. «Взаимно» — только
            если вы и собеседник подписаны друг на друга.
          </p>
          <label className="sr-only" htmlFor="settings-dm-policy-page">
            Политика личных сообщений
          </label>
          <select
            id="settings-dm-policy-page"
            className="mt-2 w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm"
            value={user?.dmPolicy ?? "all"}
            onChange={(e) => void handleDmPolicyChange(e.target.value as "all" | "followers" | "mutual")}
            disabled={privacySaving}
          >
            <option value="all">Все пользователи</option>
            <option value="followers">Только подписчики (на меня подписаны)</option>
            <option value="mutual">Только взаимная подписка</option>
          </select>
        </div>
        <div>
          <p className="text-[15px] font-medium">Групповые чаты</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Кто может добавлять вас в группу. «Подписчики» — вы должны быть подписаны на того, кто добавляет. «Взаимно» —
            взаимная подписка с тем, кто добавляет.
          </p>
          <label className="sr-only" htmlFor="settings-group-add-policy-page">
            Политика добавления в группы
          </label>
          <select
            id="settings-group-add-policy-page"
            className="mt-2 w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm"
            value={user?.groupAddMePolicy ?? "all"}
            onChange={(e) => void handleGroupAddMePolicyChange(e.target.value as "all" | "followers" | "mutual")}
            disabled={privacySaving}
          >
            <option value="all">Любой админ группы</option>
            <option value="followers">Только если я подписан на добавляющего</option>
            <option value="mutual">Только взаимная подписка с добавляющим</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Полный текст о данных, целях обработки и ваших правах — в документах ниже (как требуют правила магазинов
        приложений).
      </p>
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
        <LegalSettingsNavRow
          document="privacy"
          label="Политика конфиденциальности"
          icon={<Shield className="h-4 w-4" aria-hidden />}
          iconClass="bg-slate-500"
        />
        <LegalSettingsNavRow
          document="terms"
          label="Условия использования"
          icon={<Scale className="h-4 w-4" aria-hidden />}
          iconClass="bg-indigo-600"
        />
      </div>
      <TapScaleButton
        type="button"
        subtle
        onClick={() => setLocation("/settings/data")}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card p-3.5 text-left shadow-sm transition-colors duration-75 hover:bg-secondary/40 min-h-[var(--uix-touch-min)]"
        aria-label="Данные и память: выгрузка и кэш"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Database className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-medium">Данные и память</p>
            <p className="text-xs text-muted-foreground">Выгрузка JSON, кэш медиа</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
      </TapScaleButton>
    </SettingsScreenShell>
  );
}
