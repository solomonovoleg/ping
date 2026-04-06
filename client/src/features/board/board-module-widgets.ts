import { useCallback, useState } from "react";

const STORAGE_KEY = "ping-board-module-widgets-v1";

/** Добавляемые с борда модули — расширяйте список и каталог вместе. */
export type BoardModuleWidgetId = "sender" | "edge" | "business";

export const BOARD_MODULE_WIDGET_CATALOG: readonly {
  id: BoardModuleWidgetId;
  title: string;
  description: string;
}[] = [
  {
    id: "sender",
    title: "SENDER",
    description: "Авто-ЛС новым подписчикам",
  },
  {
    id: "edge",
    title: "EDGE",
    description: "Кампании и персонаж в ленте",
  },
  {
    id: "business",
    title: "BUSINESS",
    description: "Интеграции API и чат-команды",
  },
];

function parseStoredIds(): Set<BoardModuleWidgetId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    const next = new Set<BoardModuleWidgetId>();
    for (const item of parsed) {
      if (item === "sender" || item === "edge" || item === "business") next.add(item);
    }
    return next;
  } catch {
    return new Set();
  }
}

function persistIds(ids: Set<BoardModuleWidgetId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useBoardModuleWidgets() {
  const [enabled, setEnabled] = useState<Set<BoardModuleWidgetId>>(() => parseStoredIds());

  const setWidgetEnabled = useCallback((id: BoardModuleWidgetId, on: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      persistIds(next);
      return next;
    });
  }, []);

  const isWidgetEnabled = useCallback((id: BoardModuleWidgetId) => enabled.has(id), [enabled]);

  return { enabled, isWidgetEnabled, setWidgetEnabled };
}
