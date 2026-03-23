/** Флаги POST /api/users/:id/block (явные boolean). */
export type UserBlockFlags = {
  restrictProfile: boolean;
  restrictChat: boolean;
  restrictSocial: boolean;
};

/** Ответ DM: собеседник ограничил текущего пользователя. */
export type ApiBlockedByPeer = {
  restrictChat: boolean;
  restrictProfile: boolean;
  restrictSocial: boolean;
  note: string | null;
} | null;

export type BlockPresetId = "chatOnly" | "chatAndSocial" | "socialOnly" | "full";

export const USER_BLOCK_NOTE_MAX = 500;
