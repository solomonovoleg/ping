import type { ChatListSection } from "@shared/schema";
import { CHAT_LIST_SECTIONS } from "@shared/schema";
import { storage } from "../storage";
import { isBuiltinChatListSection, isCustomChatListFolderId } from "../storage/db-storage-user-chat-list-shelves-queries";

/** Нормализация значения listSection для PATCH /api/chats/:id/me (встроенные + свои папки). */
export async function normalizeListSectionForApiUser(userId: string, raw: unknown): Promise<string> {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "general";
  if (isBuiltinChatListSection(s)) return s;
  if (!isCustomChatListFolderId(s)) return "general";
  const row = await storage.getUserChatListCustomFolder(userId, s);
  return row ? s : "general";
}

/** Синхронный парсер только для встроенных полок (обратная совместимость). */
export function parseListSection(raw: unknown): ChatListSection {
  const s = typeof raw === "string" ? raw.trim() : "";
  return (CHAT_LIST_SECTIONS as readonly string[]).includes(s) ? (s as ChatListSection) : "general";
}
