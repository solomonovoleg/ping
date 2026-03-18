import { LayoutDashboard, Plus, Star, Clock, ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";

export default function Board() {
  const [, setLocation] = useLocation();

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