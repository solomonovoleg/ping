import { useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Code2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useAuth } from "@/contexts/AuthContext";

export default function BoardApiHub() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/");
      return;
    }
    if (!user.boardApiHubAccess) {
      setLocation("/board");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading || !user?.boardApiHubAccess) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">API HUB</h1>
        </div>

        <div className="uix-content-x p-4 flex flex-col gap-4">
          <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Code2 className="w-6 h-6 text-primary" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold text-base">Интеграции для партнёров</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Доступ по статусу PRIME CODE</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Здесь собраны материалы для подключения к API HUB: REST, вебхуки и real-time. Техническая
              документация и ключи выдаются отдельно после согласования с командой платформы.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
