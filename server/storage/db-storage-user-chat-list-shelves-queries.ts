import { and, asc, eq, max } from "drizzle-orm";
import { CHAT_LIST_SECTIONS, type ChatListSection, chatMemberPrefs, userChatListBuiltinTabPrefs, userChatListCustomFolder } from "@shared/schema";
import type { AppDb } from "./db-app-db";

const CUSTOM_FOLDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCustomChatListFolderId(raw: string): boolean {
  return CUSTOM_FOLDER_ID_RE.test(raw.trim());
}

export function isBuiltinChatListSection(raw: string): raw is ChatListSection {
  return (CHAT_LIST_SECTIONS as readonly string[]).includes(raw);
}

export async function dbStorageGetChatMemberListSection(
  db: AppDb,
  userId: string,
  chatId: string,
): Promise<string> {
  const [row] = await db
    .select({ listSection: chatMemberPrefs.listSection })
    .from(chatMemberPrefs)
    .where(and(eq(chatMemberPrefs.userId, userId), eq(chatMemberPrefs.chatId, chatId)))
    .limit(1);
  return row?.listSection ?? "general";
}

export async function dbStorageIsChatListSectionPushMutedForUser(
  db: AppDb,
  userId: string,
  section: string,
): Promise<boolean> {
  if (isBuiltinChatListSection(section)) {
    const [row] = await db
      .select({ pushMuted: userChatListBuiltinTabPrefs.pushMuted })
      .from(userChatListBuiltinTabPrefs)
      .where(and(eq(userChatListBuiltinTabPrefs.userId, userId), eq(userChatListBuiltinTabPrefs.tabId, section)))
      .limit(1);
    return row?.pushMuted === true;
  }
  if (!isCustomChatListFolderId(section)) return false;
  const [row] = await db
    .select({ pushMuted: userChatListCustomFolder.pushMuted })
    .from(userChatListCustomFolder)
    .where(and(eq(userChatListCustomFolder.userId, userId), eq(userChatListCustomFolder.id, section)))
    .limit(1);
  return row?.pushMuted === true;
}

export async function dbStorageListUserChatListCustomFolders(db: AppDb, userId: string) {
  return db
    .select()
    .from(userChatListCustomFolder)
    .where(eq(userChatListCustomFolder.userId, userId))
    .orderBy(asc(userChatListCustomFolder.sortOrder), asc(userChatListCustomFolder.createdAt));
}

export async function dbStorageGetUserChatListCustomFolder(db: AppDb, userId: string, folderId: string) {
  const [row] = await db
    .select()
    .from(userChatListCustomFolder)
    .where(and(eq(userChatListCustomFolder.userId, userId), eq(userChatListCustomFolder.id, folderId)))
    .limit(1);
  return row;
}

export async function dbStorageListUserChatListBuiltinTabPrefs(db: AppDb, userId: string) {
  return db.select().from(userChatListBuiltinTabPrefs).where(eq(userChatListBuiltinTabPrefs.userId, userId));
}

export async function dbStorageNextUserChatListCustomFolderSortOrder(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ m: max(userChatListCustomFolder.sortOrder) })
    .from(userChatListCustomFolder)
    .where(eq(userChatListCustomFolder.userId, userId));
  return (row?.m ?? -1) + 1;
}

export async function dbStorageCreateUserChatListCustomFolder(
  db: AppDb,
  userId: string,
  id: string,
  name: string,
  sortOrder: number,
): Promise<void> {
  await db.insert(userChatListCustomFolder).values({
    id,
    userId,
    name,
    sortOrder,
    pushMuted: false,
  });
}

export async function dbStorageUpdateUserChatListCustomFolder(
  db: AppDb,
  userId: string,
  folderId: string,
  patch: { name?: string; pushMuted?: boolean },
): Promise<boolean> {
  const existing = await dbStorageGetUserChatListCustomFolder(db, userId, folderId);
  if (!existing) return false;
  if (patch.name === undefined && patch.pushMuted === undefined) return true;
  await db
    .update(userChatListCustomFolder)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.pushMuted !== undefined ? { pushMuted: patch.pushMuted } : {}),
    })
    .where(and(eq(userChatListCustomFolder.userId, userId), eq(userChatListCustomFolder.id, folderId)));
  return true;
}

export async function dbStorageDeleteUserChatListCustomFolder(
  db: AppDb,
  userId: string,
  folderId: string,
): Promise<boolean> {
  const del = await db
    .delete(userChatListCustomFolder)
    .where(and(eq(userChatListCustomFolder.userId, userId), eq(userChatListCustomFolder.id, folderId)))
    .returning({ id: userChatListCustomFolder.id });
  return del.length > 0;
}

export async function dbStorageResetUserChatMemberPrefsListSection(
  db: AppDb,
  userId: string,
  fromSection: string,
  toSection: string,
): Promise<void> {
  await db
    .update(chatMemberPrefs)
    .set({ listSection: toSection, updatedAt: new Date() })
    .where(and(eq(chatMemberPrefs.userId, userId), eq(chatMemberPrefs.listSection, fromSection)));
}

export async function dbStorageUpsertUserChatListBuiltinTabPrefs(
  db: AppDb,
  userId: string,
  tabId: ChatListSection,
  patch: { labelOverride?: string | null; pushMuted?: boolean },
): Promise<void> {
  await db
    .insert(userChatListBuiltinTabPrefs)
    .values({
      userId,
      tabId,
      labelOverride: patch.labelOverride ?? null,
      pushMuted: patch.pushMuted ?? false,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userChatListBuiltinTabPrefs.userId, userChatListBuiltinTabPrefs.tabId],
      set: {
        ...(patch.labelOverride !== undefined ? { labelOverride: patch.labelOverride } : {}),
        ...(patch.pushMuted !== undefined ? { pushMuted: patch.pushMuted } : {}),
        updatedAt: new Date(),
      },
    });
}
