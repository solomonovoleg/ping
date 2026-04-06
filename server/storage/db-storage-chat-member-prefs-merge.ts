import type { ChatMemberPrefs } from "@shared/schema";

export type ChatMemberPrefsUpsertPatch = {
  pinnedAt?: Date | null;
  hiddenAt?: Date | null;
  listSection?: string;
};

type PrefsRowSlice = Pick<ChatMemberPrefs, "pinnedAt" | "hiddenAt" | "listSection">;

/** Слияние patch с существующей строкой перед insert/onConflict (семантика как в `upsertChatMemberPrefs`). */
export function mergeChatMemberPrefsForUpsert(
  chatId: string,
  userId: string,
  patch: ChatMemberPrefsUpsertPatch,
  row: PrefsRowSlice | undefined,
  updatedAt: Date,
): {
  chatId: string;
  userId: string;
  pinnedAt: Date | null;
  hiddenAt: Date | null;
  listSection: string;
  updatedAt: Date;
} {
  return {
    chatId,
    userId,
    pinnedAt: patch.pinnedAt !== undefined ? patch.pinnedAt : row?.pinnedAt ?? null,
    hiddenAt: patch.hiddenAt !== undefined ? patch.hiddenAt : row?.hiddenAt ?? null,
    listSection: patch.listSection !== undefined ? patch.listSection : row?.listSection ?? "general",
    updatedAt,
  };
}
