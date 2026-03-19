import { useLocation } from "wouter";
import { Bookmark, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSavedMessages } from "@/lib/chat";
import { ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TapScaleDiv } from "@/components/ui/tap-scale";
import { formatTimeLocal, formatDateShortLocal, parseServerTimestamp } from "@/lib/timezone";

function formatSavedTime(iso: string): string {
  const d = parseServerTimestamp(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return formatTimeLocal(d);
  if (diff < 172800000) return "Вчера";
  return formatDateShortLocal(d);
}

export default function SavedMessages() {
  const [, setLocation] = useLocation();
  const { data: list = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["saved-messages"],
    queryFn: () => getSavedMessages(100, 0),
  });

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 bg-background">
      <div className="uix-content-x pt-safe-offset-2 pb-2 border-b border-border/50 sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => setLocation("/settings")}
            className="p-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="uix-text-title flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-primary" />
            Избранное
          </h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 uix-content-x py-2 pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl w-full" />
            ))}
          </div>
        ) : isError ? (
          <ListEmptyState
            icon={Bookmark}
            title="Не удалось загрузить"
            description="Проверьте интернет и попробуйте снова"
            actionLabel="Повторить"
            onAction={() => refetch()}
          />
        ) : list.length === 0 ? (
          <ListEmptyState
            icon={Bookmark}
            title="Нет сохранённых сообщений"
            description="Нажмите ⋮ на сообщении в чате и выберите «Сохранить в избранное»"
          />
        ) : (
          <ul className="space-y-1">
            {list.map((item) => (
              <li key={`${item.chatId}-${item.messageId}`}>
                <TapScaleDiv
                  onClick={() => setLocation(`/chat/${item.chatId}?messageId=${item.messageId}`)}
                  className="uix-list-row flex flex-col gap-0.5 p-3 rounded-xl"
                >
                  <span className="text-xs text-muted-foreground">{item.chatName}</span>
                  <span className="text-sm truncate">{item.content}</span>
                  <span className="text-[11px] text-muted-foreground">{formatSavedTime(item.savedAt)}</span>
                </TapScaleDiv>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
