import { useState, useEffect } from "react";
import { Bell, ChevronRight, Loader2, MessageCircle, Smartphone, Sparkles, Volume2 } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/auth";
import { fetchPushGlobalSettings, updatePushGlobalSettings } from "@/lib/push-feed";
import { getMicroSoundsEnabled, setMicroSoundsEnabled } from "@/lib/micro-feedback";
import {
  FOREGROUND_PUSH_TOAST_CHANGE,
  getForegroundPushToastEnabled,
  setForegroundPushToastEnabled,
} from "@/lib/foreground-push-prefs";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";

export default function SettingsNotifications() {
  const { user, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pushSaving, setPushSaving] = useState(false);
  const [microSounds, setMicroSoundsState] = useState(getMicroSoundsEnabled);
  const [foregroundPushToast, setForegroundPushToastState] = useState(getForegroundPushToastEnabled);

  const {
    data: pushModuleSettings,
    isLoading: pushModuleLoading,
    isError: pushModuleError,
    refetch: refetchPushModule,
  } = useQuery({
    queryKey: ["push", "settings"],
    queryFn: fetchPushGlobalSettings,
    staleTime: 15_000,
    retry: 1,
  });

  const patchPushModuleMutation = useMutation({
    mutationFn: (enabled: boolean) => updatePushGlobalSettings(enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["push", "settings"] });
    },
    onError: (e) => {
      toast({
        title: "Не удалось сохранить",
        description: e instanceof Error ? e.message : "Повторите позже",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const handler = () => setMicroSoundsState(getMicroSoundsEnabled());
    window.addEventListener("ping:micro-sounds-change", handler);
    return () => window.removeEventListener("ping:micro-sounds-change", handler);
  }, []);

  useEffect(() => {
    const handler = () => setForegroundPushToastState(getForegroundPushToastEnabled());
    window.addEventListener(FOREGROUND_PUSH_TOAST_CHANGE, handler);
    return () => window.removeEventListener(FOREGROUND_PUSH_TOAST_CHANGE, handler);
  }, []);

  const handlePushEnabledChange = async (checked: boolean) => {
    setPushSaving(true);
    try {
      await updateProfile({ pushEnabled: checked });
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
      await refetch();
    } finally {
      setPushSaving(false);
    }
  };

  return (
    <SettingsScreenShell title="Уведомления">
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setLocation("/notifications")}
          className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/30 transition-colors min-h-[var(--uix-touch-min)] border-b border-border/50"
          aria-label="Открыть ленту уведомлений"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">Лента уведомлений</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border/50 min-h-[var(--uix-touch-min)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">Пуш о новых сообщениях</span>
          </div>
          <Switch
            checked={user?.pushEnabled !== false}
            onCheckedChange={handlePushEnabledChange}
            disabled={pushSaving}
            className="shrink-0"
          />
        </div>
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border/50 min-h-[var(--uix-touch-min)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-foreground block">Подсказка при открытом приложении</span>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Показывать тост с текстом входящего push, пока вы в приложении (Android и сайт). На iOS системный
                баннер настраивается отдельно. Выключите, если не хотите всплывающих сообщений.
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <Switch
              checked={foregroundPushToast}
              onCheckedChange={(checked) => {
                setForegroundPushToastEnabled(checked);
                setForegroundPushToastState(checked);
              }}
              aria-label="Показывать подсказку при входящем push в открытом приложении"
              className="shrink-0"
            />
          </div>
        </div>
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border/50 min-h-[var(--uix-touch-min)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-foreground block">Пуш модуля Push</span>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Мобильные push по микропостам подписок, ответам на ваши Push и новым подписчикам на ваши Push. Лента в
                чатах и колокольчик в приложении не отключаются.
              </p>
              {pushModuleError ? (
                <button
                  type="button"
                  onClick={() => void refetchPushModule()}
                  className="mt-2 text-[12px] font-medium text-primary hover:underline min-h-[var(--uix-touch-min)] py-1"
                >
                  Повторить загрузку
                </button>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 pt-1">
            {pushModuleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            ) : pushModuleError ? null : (
              <Switch
                checked={pushModuleSettings?.notificationsEnabled !== false}
                onCheckedChange={(checked) => patchPushModuleMutation.mutate(checked)}
                disabled={patchPushModuleMutation.isPending}
                aria-label="Включить или отключить push-уведомления модуля Push"
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 p-4 min-h-[var(--uix-touch-min)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Volume2 className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">Микро-звуки</span>
          </div>
          <Switch
            checked={microSounds}
            onCheckedChange={(checked) => {
              setMicroSoundsEnabled(checked);
              setMicroSoundsState(checked);
            }}
            className="shrink-0"
          />
        </div>
      </div>
    </SettingsScreenShell>
  );
}
