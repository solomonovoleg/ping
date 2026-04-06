import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, ChevronLeft, Loader2, PlugZap } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import {
  autoConnectBusinessWidget,
  listBusinessWidgets,
  type BusinessWidgetItem,
} from "@/lib/business-chat";

const DEFAULT_WIDGET_NAME = "BUSINESS";

export default function BoardBusiness() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(DEFAULT_WIDGET_NAME);
  const [endpointUrl, setEndpointUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [contractUrl, setContractUrl] = useState("");

  const widgetsQuery = useQuery({
    queryKey: ["business-chat", "widgets"],
    queryFn: listBusinessWidgets,
  });

  const autoConnect = useMutation({
    mutationFn: autoConnectBusinessWidget,
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["business-chat", "widgets"] });
      toast({
        title: "BUSINESS чат подключён",
        description: `Команд: ${payload.actions.length}`,
      });
      setLocation(`/chat/${encodeURIComponent(payload.chatId)}`);
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Не удалось подключить", variant: "destructive" });
    },
  });

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      /^https?:\/\//i.test(endpointUrl.trim()) &&
      apiKey.trim().length > 0 &&
      !autoConnect.isPending
    );
  }, [name, endpointUrl, apiKey, autoConnect.isPending]);

  const latestWidget = (widgetsQuery.data?.[0] ?? null) as BusinessWidgetItem | null;

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <BriefcaseBusiness className="w-5 h-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="uix-text-title truncate">BUSINESS чат</h1>
              <p className="text-xs text-muted-foreground truncate">Конструктор API-команд</p>
            </div>
          </div>
        </div>

        <div className="uix-content-x flex flex-col gap-6 pb-8">
          <section className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-3">
            <h2 className="text-sm font-semibold">Автонастройка в 2 клика</h2>
            <p className="text-xs text-muted-foreground">
              Введите endpoint и API key. Мы прочитаем контракт, сгенерируем команды и создадим ваш BUSINESS чат.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="business-widget-name">Название чата</Label>
                <Input
                  id="business-widget-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: БЮДЖЕТ"
                  maxLength={48}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-endpoint">Endpoint URL</Label>
                <Input
                  id="business-endpoint"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://api.example.com/business/events"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-api-key">API key</Label>
                <Input
                  id="business-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_..."
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business-contract-url">Contract URL (опционально)</Label>
                <Input
                  id="business-contract-url"
                  value={contractUrl}
                  onChange={(e) => setContractUrl(e.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <Button
                type="button"
                className="w-full min-h-[var(--uix-touch-min)]"
                disabled={!canSubmit}
                onClick={() =>
                  autoConnect.mutate({
                    name,
                    endpointUrl,
                    apiKey,
                    providerType: "custom",
                    contractUrl: contractUrl.trim() || null,
                  })
                }
              >
                {autoConnect.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Автонастройка
              </Button>
            </div>
          </section>

          {widgetsQuery.isLoading ? (
            <section className="space-y-3">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </section>
          ) : widgetsQuery.isError ? (
            <ErrorWithRetry
              title="Не удалось загрузить BUSINESS виджеты"
              description={widgetsQuery.error instanceof Error ? widgetsQuery.error.message : "Ошибка"}
              onRetry={() => void widgetsQuery.refetch()}
            />
          ) : widgetsQuery.data && widgetsQuery.data.length > 0 ? (
            <section className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-3">
              <h2 className="text-sm font-semibold">Подключённые виджеты</h2>
              <div className="space-y-2">
                {widgetsQuery.data.map((widget) => (
                  <TapScaleButton
                    key={widget.id}
                    type="button"
                    haptic
                    onClick={() => setLocation(`/chat/${encodeURIComponent(widget.chatId)}`)}
                    className="w-full min-h-[var(--uix-touch-min)] rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-left"
                    aria-label={`Открыть чат ${widget.name}`}
                  >
                    <div className="font-medium truncate">{widget.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{widget.endpointUrl}</div>
                  </TapScaleButton>
                ))}
              </div>
              {latestWidget ? (
                <p className="text-xs text-muted-foreground">
                  Последнее обновление: {new Date(latestWidget.updatedAt).toLocaleString("ru-RU")}
                </p>
              ) : null}
            </section>
          ) : (
            <ListEmptyState
              icon={BriefcaseBusiness}
              title="BUSINESS виджетов пока нет"
              description="Подключите первый виджет через форму выше — чат создастся автоматически."
            />
          )}
        </div>
      </div>
    </div>
  );
}
