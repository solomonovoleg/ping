import { useState } from "react";
import { Sparkles, Type, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { patchVibeSettings } from "@/lib/auth";
import { getSpellCheckEnabled, setSpellCheckEnabled } from "@/lib/spellcheck-prefs";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { SettingsScreenShell } from "@/features/settings/components/SettingsScreenShell";

export default function SettingsChatPrefs() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [spellCheck, setSpellCheckState] = useState(getSpellCheckEnabled);

  return (
    <SettingsScreenShell title="Чат и атмосфера">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Чат</h2>
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-4 min-h-[var(--uix-touch-min)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Type className="w-5 h-5" />
                </div>
                <span className="font-medium text-foreground">Автоисправление орфографии</span>
              </div>
              <Switch
                checked={spellCheck}
                onCheckedChange={(checked) => {
                  setSpellCheckEnabled(checked);
                  setSpellCheckState(checked);
                }}
                className="shrink-0"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Атмосфера чата</h2>
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            <div className="flex items-center justify-between gap-4 p-4 min-h-[var(--uix-touch-min)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="font-medium text-foreground">Адаптивная атмосфера</span>
              </div>
              <Switch
                checked={user?.vibeEnabled ?? false}
                onCheckedChange={async (checked) => {
                  try {
                    await patchVibeSettings({ vibeEnabled: checked });
                    await refetch();
                  } catch (e) {
                    toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
                  }
                }}
                className="shrink-0"
              />
            </div>
            {user?.vibeEnabled && (
              <div className="flex items-center justify-between gap-4 p-4 min-h-[var(--uix-touch-min)]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">Синхронизировать настроение для двоих</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      У собеседника будет ощущаться тот же визуальный тон диалога.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={user?.vibeShareWithPartner ?? false}
                  onCheckedChange={async (checked) => {
                    try {
                      await patchVibeSettings({ vibeShareWithPartner: checked });
                      await refetch();
                    } catch (e) {
                      toast({ title: e instanceof Error ? e.message : "Не сохранено", variant: "destructive" });
                    }
                  }}
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsScreenShell>
  );
}
