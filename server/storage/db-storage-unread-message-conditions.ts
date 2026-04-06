import { isNull, ne, or, type SQL } from "drizzle-orm";
import { messages } from "@shared/schema";

/** Сообщения не от текущего пользователя (в т.ч. системные без sender). */
export function unreadExcludesOwnMessagesCondition(userId: string): SQL {
  return or(ne(messages.senderId, userId), isNull(messages.senderId)) as SQL;
}

export function unreadNonSystemMessageTypeCondition(): SQL {
  return ne(messages.type, "system");
}
