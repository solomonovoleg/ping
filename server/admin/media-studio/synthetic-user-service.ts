import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import type { UpdateProfile, User } from "@shared/schema";
import { GENDER_VALUES, NAME_MAX_LENGTH, updateProfileSchema } from "@shared/schema";
import { hashPassword } from "../../auth/password";
import type { IStorage } from "../../storage/types";

export const createStudioSyntheticUserBodySchema = z.object({
  displayName: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  surname: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  gender: z.enum(GENDER_VALUES),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export type CreateStudioSyntheticUserBody = z.infer<typeof createStudioSyntheticUserBodySchema>;

/**
 * Обновление профиля studio user: те же поля, что у обычного профиля, но без
 * `boardApiHubPrimeCode` и `referralLimit` (не задаём из медиа-студии).
 */
export const patchStudioSyntheticUserBodySchema = updateProfileSchema
  .omit({ boardApiHubPrimeCode: true, referralLimit: true })
  .refine((o) => Object.keys(o).length > 0, { message: "Нет полей для обновления" });

export type PatchStudioSyntheticUserBody = z.infer<typeof patchStudioSyntheticUserBodySchema>;

export async function patchStudioSyntheticUser(
  storage: IStorage,
  params: { userId: string; body: PatchStudioSyntheticUserBody },
): Promise<User | undefined> {
  return storage.updateUserProfile(params.userId, params.body as UpdateProfile);
}

/**
 * Создаёт пользователя как после регистрации: аккаунт в `users`, профильные поля, маркеры studio.
 * Телефон-заглушка не проходит normalizePhone → вход по SMS невозможен.
 */
export async function createStudioSyntheticUser(
  storage: IStorage,
  params: { adminId: string; body: CreateStudioSyntheticUserBody },
): Promise<User> {
  const publicId = await storage.getNextPublicId();
  const phone = `studio_media_${randomUUID()}`;
  const password = hashPassword(randomBytes(48).toString("hex"));
  const user = await storage.createUser({
    password,
    publicId,
    phone,
    phoneLookupHash: null,
    phoneCipher: null,
  });
  await storage.applyStudioSyntheticFlags(user.id, params.adminId);
  const profile: UpdateProfile = {
    displayName: params.body.displayName,
    surname: params.body.surname,
    gender: params.body.gender,
    ...(params.body.birthDate != null && params.body.birthDate !== ""
      ? { birthDate: params.body.birthDate }
      : {}),
  };
  const updated = await storage.updateUserProfile(user.id, profile);
  if (!updated) throw new Error("Studio user profile update failed");
  return updated;
}
