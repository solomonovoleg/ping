import { randomUUID } from "crypto";
import type { ChatListSection } from "@shared/schema";
import { CHAT_LIST_SECTIONS } from "@shared/schema";
import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";

const MAX_CUSTOM_FOLDERS = 30;
const MAX_FOLDER_NAME_LEN = 40;

const BUILTIN_TAB_IDS = new Set<string>(CHAT_LIST_SECTIONS);

function normalizeFolderName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.slice(0, MAX_FOLDER_NAME_LEN);
}

export async function getUserChatListShelvesForUser(userId: string) {
  const [customRows, builtinRows] = await Promise.all([
    storage.listUserChatListCustomFolders(userId),
    storage.listUserChatListBuiltinTabPrefs(userId),
  ]);
  const builtinTabPrefs: Record<
    string,
    { labelOverride: string | null; pushMuted: boolean }
  > = {};
  for (const r of builtinRows) {
    builtinTabPrefs[r.tabId] = {
      labelOverride: r.labelOverride ?? null,
      pushMuted: Boolean(r.pushMuted),
    };
  }
  const customFolders = customRows.map((f) => ({
    id: f.id,
    name: f.name,
    sortOrder: f.sortOrder,
    pushMuted: Boolean(f.pushMuted),
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
  }));
  return { customFolders, builtinTabPrefs };
}

export async function createUserChatListCustomFolderForUser(userId: string, body: Record<string, unknown>) {
  const name = normalizeFolderName(body.name);
  if (!name) throw new ChatsServiceError(400, "Укажите название папки");
  const existing = await storage.listUserChatListCustomFolders(userId);
  if (existing.length >= MAX_CUSTOM_FOLDERS) {
    throw new ChatsServiceError(400, `Не больше ${MAX_CUSTOM_FOLDERS} своих папок`);
  }
  const id = randomUUID();
  const sortOrder = await storage.nextUserChatListCustomFolderSortOrder(userId);
  await storage.createUserChatListCustomFolder(userId, id, name, sortOrder);
  notifyChatListUpdate(userId);
  return {
    id,
    name,
    sortOrder,
    pushMuted: false,
    createdAt: new Date().toISOString(),
  };
}

export async function updateUserChatListCustomFolderForUser(
  userId: string,
  folderId: string,
  body: Record<string, unknown>,
) {
  const row = await storage.getUserChatListCustomFolder(userId, folderId);
  if (!row) throw new ChatsServiceError(404, "Папка не найдена");
  const patch: { name?: string; pushMuted?: boolean } = {};
  if (body.name !== undefined) {
    const name = normalizeFolderName(body.name);
    if (!name) throw new ChatsServiceError(400, "Название не может быть пустым");
    patch.name = name;
  }
  if (body.pushMuted !== undefined) {
    if (typeof body.pushMuted !== "boolean") throw new ChatsServiceError(400, "pushMuted: boolean");
    patch.pushMuted = body.pushMuted;
  }
  if (Object.keys(patch).length === 0) throw new ChatsServiceError(400, "Нет полей для обновления");
  const ok = await storage.updateUserChatListCustomFolder(userId, folderId, patch);
  if (!ok) throw new ChatsServiceError(404, "Папка не найдена");
  notifyChatListUpdate(userId);
  return { ok: true };
}

export async function deleteUserChatListCustomFolderForUser(userId: string, folderId: string) {
  const row = await storage.getUserChatListCustomFolder(userId, folderId);
  if (!row) throw new ChatsServiceError(404, "Папка не найдена");
  await storage.resetUserChatMemberPrefsListSection(userId, folderId, "general");
  await storage.deleteUserChatListCustomFolder(userId, folderId);
  notifyChatListUpdate(userId);
  return { ok: true };
}

export async function updateUserChatListBuiltinTabPrefForUser(
  userId: string,
  tabId: string,
  body: Record<string, unknown>,
) {
  if (!BUILTIN_TAB_IDS.has(tabId)) throw new ChatsServiceError(400, "Неизвестная встроенная полка");
  const patch: { labelOverride?: string | null; pushMuted?: boolean } = {};
  if (body.labelOverride !== undefined) {
    if (body.labelOverride === null) patch.labelOverride = null;
    else {
      const label = normalizeFolderName(body.labelOverride);
      patch.labelOverride = label || null;
    }
  }
  if (body.pushMuted !== undefined) {
    if (typeof body.pushMuted !== "boolean") throw new ChatsServiceError(400, "pushMuted: boolean");
    patch.pushMuted = body.pushMuted;
  }
  if (Object.keys(patch).length === 0) throw new ChatsServiceError(400, "Нет полей для обновления");
  await storage.upsertUserChatListBuiltinTabPrefs(userId, tabId as ChatListSection, patch);
  notifyChatListUpdate(userId);
  return { ok: true };
}
