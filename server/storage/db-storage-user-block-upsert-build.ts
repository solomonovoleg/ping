import { userBlockNoteForInsert } from "./db-storage-user-block-note";
import { resolveUserBlockRestrictFlags, type UserBlockRestrictFlagsInput } from "./db-storage-user-block-restrict-defaults";

export function buildUserBlockUpsertPayload(
  blockerId: string,
  blockedId: string,
  flags: UserBlockRestrictFlagsInput | undefined,
  blockNote: string | null | undefined,
) {
  const { restrictProfile, restrictChat, restrictSocial } = resolveUserBlockRestrictFlags(flags);
  const values = {
    blockerId,
    blockedId,
    restrictProfile,
    restrictChat,
    restrictSocial,
    blockNote: userBlockNoteForInsert(blockNote),
  };
  const conflictSet: {
    restrictProfile: boolean;
    restrictChat: boolean;
    restrictSocial: boolean;
    blockNote?: string | null;
  } = { restrictProfile, restrictChat, restrictSocial };
  if (blockNote !== undefined) {
    conflictSet.blockNote = blockNote;
  }
  return { values, conflictSet };
}
