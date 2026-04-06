import { eq, and } from "drizzle-orm";
import { userBlocks } from "@shared/schema";
import { mergeBlockedRelationUserIds } from "./db-storage-user-block-relation-merge";
import { buildUserBlockUpsertPayload } from "./db-storage-user-block-upsert-build";
import { userBlocksFullRestrictionCondition } from "./db-storage-user-block-full-restriction";
import { normalizeUserBlockNoteFromDb } from "./db-storage-user-block-note";
import { isUserBlocksSchemaUnavailable } from "./db-storage-schema-guards";
import type { AppDb } from "./db-app-db";

export async function dbStorageAddBlock(
  db: AppDb,
  blockerId: string,
  blockedId: string,
  flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
  blockNote?: string | null,
): Promise<void> {
  if (blockerId === blockedId) return;
  const { values, conflictSet } = buildUserBlockUpsertPayload(blockerId, blockedId, flags, blockNote);
  await db.insert(userBlocks).values(values).onConflictDoUpdate({
    target: [userBlocks.blockerId, userBlocks.blockedId],
    set: conflictSet,
  });
}

export async function dbStorageRemoveBlock(db: AppDb, blockerId: string, blockedId: string): Promise<void> {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

export async function dbStorageIsBlocked(db: AppDb, blockerId: string, blockedId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .limit(1);
  return !!row;
}

export async function dbStorageGetBlockFlags(
  db: AppDb,
  blockerId: string,
  blockedId: string,
): Promise<{
  restrictProfile: boolean;
  restrictChat: boolean;
  restrictSocial: boolean;
  blockNote: string | null;
} | null> {
  const [row] = await db
    .select({
      restrictProfile: userBlocks.restrictProfile,
      restrictChat: userBlocks.restrictChat,
      restrictSocial: userBlocks.restrictSocial,
      blockNote: userBlocks.blockNote,
    })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .limit(1);
  if (!row) return null;
  return {
    restrictProfile: row.restrictProfile === true,
    restrictChat: row.restrictChat === true,
    restrictSocial: row.restrictSocial === true,
    blockNote: normalizeUserBlockNoteFromDb(row.blockNote),
  };
}

export async function dbStorageGetBlockedRelationIds(db: AppDb, viewerId: string): Promise<string[]> {
  try {
    const fullBlock = userBlocksFullRestrictionCondition();
    const [asBlocker, asBlocked] = await Promise.all([
      db
        .select({ blockedId: userBlocks.blockedId })
        .from(userBlocks)
        .where(and(eq(userBlocks.blockerId, viewerId), fullBlock)),
      db
        .select({ blockerId: userBlocks.blockerId })
        .from(userBlocks)
        .where(and(eq(userBlocks.blockedId, viewerId), fullBlock)),
    ]);
    return mergeBlockedRelationUserIds(asBlocker, asBlocked);
  } catch (err: unknown) {
    if (isUserBlocksSchemaUnavailable(err)) {
      console.warn(
        "[db] user_blocks недоступна — лента без фильтра полных блокировок до миграции user_block_restrictions.",
      );
      return [];
    }
    throw err;
  }
}
