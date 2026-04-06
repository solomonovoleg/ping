import { users } from "@shared/schema";

/** Общий select публичных полей пользователя для списков подписок / mutual. */
export const followListPublicUserSelect = {
  id: users.id,
  publicId: users.publicId,
  displayName: users.displayName,
  surname: users.surname,
  avatarUrl: users.avatarUrl,
} as const;
