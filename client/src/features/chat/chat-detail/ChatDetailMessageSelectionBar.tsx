import { Share2 } from "lucide-react";

/** Панель при выборе нескольких сообщений (переслать / снять выбор). Без send — только колбэки. */
export function ChatDetailMessageSelectionBar({
  selectedCount,
  onForwardSelected,
  onClearSelection,
}: {
  selectedCount: number;
  onForwardSelected: () => void;
  onClearSelection: () => void;
}) {
  if (selectedCount <= 0) return null;

  return (
    <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-primary/10 border-b border-border">
      <span className="text-sm font-medium">Выбрано: {selectedCount}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onForwardSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          <Share2 className="w-4 h-4" />
          Переслать
        </button>
        <button type="button" onClick={onClearSelection} className="px-3 py-1.5 rounded-lg bg-secondary text-sm">
          Снять выбор
        </button>
      </div>
    </div>
  );
}
