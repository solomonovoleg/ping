import { LayoutDashboard, Plus, Star, Clock, ChevronLeft, List } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { getTracksStats } from "@/lib/tracks";
import { formatMessageTime } from "@/features/chat/utils/format";

export default function Board() {
  const [, setLocation] = useLocation();
  const { data: tracksStats } = useQuery({
    queryKey: ["tracks", "stats"],
    queryFn: getTracksStats,
  });

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        
        {/* Header */}
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TapScaleButton
              type="button"
              onClick={() => setLocation("/")}
              haptic
              subtle
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label="Назад"
            >
              <ChevronLeft className="w-6 h-6" />
            </TapScaleButton>
            <h1 className="uix-text-title">Борд</h1>
          </div>
          <TapScaleButton
            type="button"
            haptic
            subtle
            className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Добавить"
          >
            <Plus className="w-5 h-5" />
          </TapScaleButton>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-6">
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

            <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm aspect-square flex flex-col items-center justify-center text-center gap-3 col-span-2 border-dashed">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-[15px]">Добавить виджет</h3>
                <p className="text-sm text-muted-foreground mt-1">Настройте свой борд</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}