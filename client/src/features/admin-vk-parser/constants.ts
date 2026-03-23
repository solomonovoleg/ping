import { VK_PARSER_ITEM_STATUSES } from "@shared/schema";

export const QK_BINDINGS = ["admin", "vk-parser", "bindings"] as const;
export const QK_QUEUE = ["admin", "vk-parser", "queue"] as const;

export const QUEUE_PAGE_SIZE = 20;

export const QUEUE_STATUS_LABELS: Record<(typeof VK_PARSER_ITEM_STATUSES)[number], string> = {
  pending_review: "На модерации",
  published: "В ленте",
  rejected: "Отклонено",
  failed: "Ошибка",
  skipped: "Пропущено",
};
