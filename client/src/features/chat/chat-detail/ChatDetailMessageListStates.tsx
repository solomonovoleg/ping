import { MessageCircle } from "lucide-react";

/** Строка «Загрузка…» над списком при подгрузке истории. */
export function ChatDetailOlderMessagesLoadingRow({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="flex justify-center py-2">
      <span className="text-xs text-muted-foreground">Загрузка…</span>
    </div>
  );
}

/** Пустой чат после загрузки (не скелетон). */
export function ChatDetailMessagesEmptyState({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-muted/80 flex items-center justify-center">
        <MessageCircle className="w-7 h-7 text-muted-foreground" aria-hidden />
      </div>
      <div>
        <p className="font-medium text-foreground">Нет сообщений</p>
        <p className="text-sm text-muted-foreground mt-1">Напишите первое сообщение или отправьте голосовое</p>
      </div>
    </div>
  );
}
