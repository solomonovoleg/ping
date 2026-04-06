import { useState } from "react";
import {
  Plus,
  Star,
  Clock,
  ChevronLeft,
  List,
  Captions,
  Sparkles,
  Mail,
  Code2,
  LayoutGrid,
  BriefcaseBusiness,
} from "lucide-react";
import { getCallHistory } from "@/lib/call-history";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { getTracksStats } from "@/lib/tracks";
import { formatMessageTime } from "@/features/chat/utils/format";
import { fetchSenderWelcome } from "@/lib/sender";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOARD_MODULE_WIDGET_CATALOG,
  useBoardModuleWidgets,
} from "@/features/board/board-module-widgets";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Board() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isBusinessApproved = user?.businessStatus === "approved";
  const [widgetSheetOpen, setWidgetSheetOpen] = useState(false);
  const { isWidgetEnabled, setWidgetEnabled } = useBoardModuleWidgets();
  const { data: tracksStats } = useQuery({
    queryKey: ["tracks", "stats"],
    queryFn: getTracksStats,
  });
  const { data: callHistory = [] } = useQuery({
    queryKey: ["call-history"],
    queryFn: getCallHistory,
  });
  const { data: senderWelcome } = useQuery({
    queryKey: ["sender", "welcome"],
    queryFn: fetchSenderWelcome,
    staleTime: 30_000,
    enabled: Boolean(user?.id) && isWidgetEnabled("sender"),
  });

  const availableWidgetCatalog = isBusinessApproved
    ? BOARD_MODULE_WIDGET_CATALOG
    : BOARD_MODULE_WIDGET_CATALOG.filter((item) => item.id !== "edge");

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        
        {/* Header: слева — min-w-0 + truncate, справа — shrink-0, иначе при overflow-x-hidden у контейнера «+» мог обрезаться */}
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex justify-between items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TapScaleButton
              type="button"
              onClick={() => setLocation("/")}
              haptic
              subtle
              className="shrink-0 p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label="Назад"
            >
              <ChevronLeft className="w-6 h-6" />
            </TapScaleButton>
            <h1 className="uix-text-title min-w-0 truncate">Борд</h1>
          </div>
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => setWidgetSheetOpen(true)}
            className="shrink-0 p-2 rounded-full border border-border/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Добавить виджет"
          >
            <Plus className="w-5 h-5" />
          </TapScaleButton>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-6">
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => setWidgetSheetOpen(true)}
            className="w-full min-h-[var(--uix-touch-min)] rounded-2xl border border-border/50 bg-card/70 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium text-foreground shadow-sm"
            aria-label="Настроить виджеты модулей на борде"
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Виджеты модулей
          </TapScaleButton>

          {/* Widgets Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-5 text-white shadow-lg shadow-blue-500/20 aspect-square flex flex-col justify-between">
              <Star className="w-8 h-8 opacity-80" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Избранное</h3>
                <p className="text-white/80 text-sm">12 элементов</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-5 text-white shadow-lg shadow-purple-500/20 aspect-square flex flex-col justify-between">
              <Clock className="w-8 h-8 opacity-80" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Недавние</h3>
                <p className="text-white/80 text-sm">Файлы и ссылки</p>
              </div>
            </div>

            <TapScaleButton
              type="button"
              onClick={() => setLocation("/board/tracks")}
              className="rounded-2xl p-5 border border-border/60 bg-card/80 backdrop-blur-sm aspect-square flex flex-col justify-between text-left hover:bg-muted/50 active:scale-[0.98] transition-all shadow-sm hover:shadow-md hover:border-border"
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <List className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base">Треки</h3>
              </div>
              <div className="space-y-1 text-[13px] text-muted-foreground">
                {tracksStats ? (
                  <>
                    <p className="font-medium text-foreground">
                      {tracksStats.totalTracks} {tracksStats.totalTracks === 1 ? "трек" : tracksStats.totalTracks < 5 ? "трека" : "треков"}
                    </p>
                    <p>
                      {tracksStats.activeItemsCount + tracksStats.doneItemsCount > 0 ? (
                        <>
                          {tracksStats.activeItemsCount} активн{tracksStats.activeItemsCount === 1 ? "ое" : "ых"} / {tracksStats.doneItemsCount} закрыто
                        </>
                      ) : (
                        "Списки сообщений"
                      )}
                    </p>
                    {tracksStats.lastAddedAt && (
                      <p className="text-[12px] text-muted-foreground/80">
                        Последнее: {formatMessageTime(tracksStats.lastAddedAt)}
                      </p>
                    )}
                  </>
                ) : (
                  <p>Списки сообщений</p>
                )}
              </div>
            </TapScaleButton>

            <TapScaleButton
              type="button"
              onClick={() => setLocation("/board/calls")}
              className="rounded-2xl p-5 border border-border/60 bg-card/80 backdrop-blur-sm aspect-square flex flex-col justify-between text-left hover:bg-muted/50 active:scale-[0.98] transition-all shadow-sm hover:shadow-md hover:border-border"
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Captions className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base">Созвоны</h3>
              </div>
              <div className="space-y-1 text-[13px] text-muted-foreground">
                <p className="font-medium text-foreground">{callHistory.length} {callHistory.length === 1 ? "запись" : callHistory.length < 5 ? "записи" : "записей"}</p>
                <p>Журнал и титры · без лишнего в чатах</p>
              </div>
            </TapScaleButton>

            {isWidgetEnabled("sender") ? (
              <TapScaleButton
                type="button"
                onClick={() => setLocation("/board/sender")}
                className="rounded-2xl p-5 border border-border/60 bg-card/80 backdrop-blur-sm min-h-[110px] flex flex-col justify-between text-left hover:bg-muted/50 active:scale-[0.98] transition-all shadow-sm hover:shadow-md hover:border-border col-span-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-base">SENDER</h3>
                </div>
                <div className="space-y-1 text-[13px] text-muted-foreground">
                  {senderWelcome?.moduleEnabled ? (
                    <>
                      <p className="font-medium text-foreground">
                        {senderWelcome.stats.welcomesDeliveredCount}{" "}
                        {senderWelcome.stats.welcomesDeliveredCount === 1
                          ? "приветствие"
                          : senderWelcome.stats.welcomesDeliveredCount < 5
                            ? "приветствия"
                            : "приветствий"}{" "}
                        отправлено
                      </p>
                      <p>
                        Подписчиков: {senderWelcome.stats.followersCount}
                        {senderWelcome.autoSendOnFollow ? " · авто при подписке" : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">Авто-ЛС новым подписчикам</p>
                      <p>Текст, фото или видео</p>
                    </>
                  )}
                </div>
              </TapScaleButton>
            ) : null}

            {user?.boardApiHubAccess ? (
              <TapScaleButton
                type="button"
                onClick={() => setLocation("/board/api-hub")}
                haptic
                subtle
                className="rounded-3xl p-5 border border-emerald-500/25 bg-gradient-to-br from-emerald-500/12 to-teal-500/8 shadow-sm col-span-2 flex flex-col items-stretch text-left min-h-[var(--uix-touch-min)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Code2 className="w-6 h-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base text-foreground">API HUB</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Партнёрские интеграции и документация
                    </p>
                  </div>
                </div>
              </TapScaleButton>
            ) : null}

            {isBusinessApproved && isWidgetEnabled("edge") ? (
              <TapScaleButton
                type="button"
                onClick={() => setLocation("/board/edge")}
                haptic
                subtle
                className="rounded-3xl p-5 border border-primary/20 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 shadow-sm col-span-2 flex flex-col items-stretch text-left min-h-[var(--uix-touch-min)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base text-foreground">EDGE кампании</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Персонаж в ленте, призы, мои кампании
                    </p>
                  </div>
                </div>
              </TapScaleButton>
            ) : null}
            {isWidgetEnabled("business") ? (
              <TapScaleButton
                type="button"
                onClick={() => setLocation("/board/business")}
                haptic
                subtle
                className="rounded-3xl p-5 border border-cyan-500/25 bg-gradient-to-br from-cyan-500/12 to-sky-500/8 shadow-sm col-span-2 flex flex-col items-stretch text-left min-h-[var(--uix-touch-min)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                    <BriefcaseBusiness className="w-6 h-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base text-foreground">BUSINESS чат</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Конструктор API-команд в 2 клика
                    </p>
                  </div>
                </div>
              </TapScaleButton>
            ) : null}
          </div>
        </div>

        <Drawer open={widgetSheetOpen} onOpenChange={setWidgetSheetOpen}>
          <DrawerContent className="max-h-[min(92dvh,880px)] rounded-t-[1.25rem] border-border/35 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="space-y-2 p-5 pb-3 text-left">
              <DrawerTitle className="text-left text-[1.0625rem] font-semibold leading-snug">
                Виджеты на борде
              </DrawerTitle>
              <DrawerDescription className="text-left text-sm">
                Включите модули — плитки появятся в сетке. Список будем расширять.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-5 pb-6 flex flex-col gap-1">
              {availableWidgetCatalog.map((item) => {
                const switchId = `board-widget-${item.id}`;
                const on = isWidgetEnabled(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/60 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={switchId} className="text-base font-medium cursor-pointer">
                        {item.title}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Switch
                      id={switchId}
                      checked={on}
                      onCheckedChange={(checked) => setWidgetEnabled(item.id, checked)}
                      className="shrink-0"
                      aria-label={`${on ? "Отключить" : "Включить"} ${item.title}`}
                    />
                  </div>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}