import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Captions, Video } from "lucide-react";
import { useLocation } from "wouter";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { getCallHistory } from "@/lib/call-history";
import { formatMessageTime } from "@/features/chat/utils/format";

export function CallHistoryListPage() {
  const [, setLocation] = useLocation();
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["call-history"],
    queryFn: getCallHistory,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center gap-2 border-b border-border/50">
        <TapScaleButton type="button" onClick={() => setLocation("/board")} subtle className="p-2 -ml-2 rounded-full" aria-label="Назад">
          <ChevronLeft className="w-6 h-6" />
        </TapScaleButton>
        <h1 className="uix-text-title">История звонков</h1>
      </div>
      <div className="flex-1 overflow-y-auto pb-[var(--uix-nav-bottom)]">
        {isLoading && (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        )}
        {error && <ErrorWithRetry title="Не удалось загрузить историю" description="Попробуйте ещё раз" onRetry={() => refetch()} className="border-none" />}
        {!isLoading && !error && data.length === 0 && (
          <ListEmptyState icon={Captions} title="История звонков пуста" description="Здесь появятся расшифровки завершённых созвонов." className="border-none" />
        )}
        {!isLoading && !error && data.length > 0 && (
          <ul className="divide-y divide-border/40">
            {data.map((item) => (
              <li key={item.id}>
                <TapScaleButton
                  type="button"
                  onClick={() => setLocation(`/board/calls/${encodeURIComponent(item.id)}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {item.mediaType === "video" ? <Video className="w-5 h-5 text-primary" /> : <Captions className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{item.chatName}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {item.participantCount} участников · {formatMessageTime(item.createdAt)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      {item.endedAt ? "Есть история реплик и команд" : "Созвон ещё активен"}
                    </p>
                  </div>
                </TapScaleButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
