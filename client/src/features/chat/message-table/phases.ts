import type { MessageTablePhase } from "./types";

/**
 * Пять этапов внедрения модуля `message-table` (навигация для команды).
 * Поля `done` отражают текущее состояние репозитория.
 */
export const MESSAGE_TABLE_PHASES: MessageTablePhase[] = [
  {
    id: 1,
    title: "Ядро и контракт",
    summary: "Константы, типы, parsePastedGrid, JSON payload + fenced ```table",
    done: true,
  },
  {
    id: 2,
    title: "Склейка с парсером сообщений",
    summary: "В ChatMessageRow: сегмент code + lang table → не CodeBlock, а таблица",
    done: true,
  },
  {
    id: 3,
    title: "UI превью и полный просмотр",
    summary: "ChatTableBubble: мини-таблица, Dialog, reduced motion",
    done: true,
  },
  {
    id: 4,
    title: "Вставка в композере",
    summary: "onPaste в ChatDetail: авто-fence при подходящей сетке; тост при перелимите",
    done: true,
  },
  {
    id: 5,
    title: "Большие таблицы",
    summary: "CSV и XLSX (xlsx) до 10 МБ, диалог выбора формата, upload + parse-chat-file; карточки в пузыре и медиа-ленте",
    done: true,
  },
];
