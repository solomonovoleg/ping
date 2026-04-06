/** Вход флагов блокировки из API: `undefined` трактуем как «ограничение включено» (как раньше в `addBlock`). */
export type UserBlockRestrictFlagsInput = Partial<{
  restrictProfile: boolean;
  restrictChat: boolean;
  restrictSocial: boolean;
}>;

export function resolveUserBlockRestrictFlags(flags?: UserBlockRestrictFlagsInput) {
  return {
    restrictProfile: flags?.restrictProfile !== false,
    restrictChat: flags?.restrictChat !== false,
    restrictSocial: flags?.restrictSocial !== false,
  };
}
