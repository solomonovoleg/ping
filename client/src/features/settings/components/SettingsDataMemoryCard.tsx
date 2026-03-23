import { useState } from "react";
import { Bookmark, ChevronRight, Database, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { clearMediaOfflineCache } from "@/lib/media-offline-cache";
import { downloadUserDataExportFile } from "@/lib/user-data-export";

type Props = {
  onNavigateSaved: () => void;
  /** Ссылка на отдельный экран «Данные и память» (скрыть на самом этом экране). */
  onOpenDataPage?: () => void;
};

export function SettingsDataMemoryCard({ onNavigateSaved, onOpenDataPage }: Props) {
  const { toast } = useToast();
  const [clearingMediaCache, setClearingMediaCache] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleClearMediaCache = async () => {
    setClearingMediaCache(true);
    try {
      const r = await clearMediaOfflineCache();
      if (!r) {
        toast({
          title: "Кэш недоступен",
          description: "В этом окружении недоступно локальное хранилище.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: r.clearedRows > 0 ? "Кэш очищен" : "Кэш уже пуст",
        description:
          r.clearedRows > 0
            ? `Удалено записей: ${r.clearedRows}. Медиа подгрузятся снова при просмотре.`
            : "Локальных копий медиа не было.",
      });
    } catch {
      toast({ title: "Не удалось очистить кэш", variant: "destructive" });
    } finally {
      setClearingMediaCache(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadUserDataExportFile();
      toast({ title: "Файл сохранён", description: "Проверьте папку загрузок.", duration: 2500 });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось выгрузить данные",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm p-4 space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Локально сохраняются копии медиа для быстрой загрузки офлайн. Очистка не затрагивает сообщения на сервере и не
        удаляет неотправленные из очереди.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Выгрузка JSON — снимок профиля, подписок, чатов (без полной истории переписок), избранных сообщений в чатах и
        ваших постов в ленте (до лимита на сервере). Храните файл в безопасном месте.
      </p>
      <button
        type="button"
        onClick={onNavigateSaved}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-left text-sm font-medium hover:bg-secondary/40 transition-colors min-h-[var(--uix-touch-min)]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Bookmark className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          Сохранённые сообщения
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <Button
        type="button"
        variant="secondary"
        className="w-full min-h-[var(--uix-touch-min)]"
        disabled={clearingMediaCache}
        onClick={() => void handleClearMediaCache()}
      >
        {clearingMediaCache ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" aria-hidden />
            Очистка…
          </>
        ) : (
          <>
            <Database className="h-4 w-4 mr-2 shrink-0" aria-hidden />
            Очистить кэш медиа
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="default"
        className="w-full min-h-[var(--uix-touch-min)]"
        disabled={exporting}
        onClick={() => void handleExport()}
      >
        {exporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin shrink-0" aria-hidden />
            Формируем файл…
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2 shrink-0" aria-hidden />
            Скачать мои данные (JSON)
          </>
        )}
      </Button>
      {onOpenDataPage ? (
        <button
          type="button"
          onClick={onOpenDataPage}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm text-primary font-medium hover:underline min-h-[var(--uix-touch-min)]"
        >
          <span>Раздел «Данные и память» на отдельном экране</span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
