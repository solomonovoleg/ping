/** Таблица/колонки `user_blocks` ещё не накатили — не роняем ленту и профиль. */
export function isUserBlocksSchemaUnavailable(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string"
      ? String((err as { message: string }).message)
      : "";
  const aboutBlocks = /user_blocks/i.test(msg) || /restrict_profile/i.test(msg) || /restrict_chat/i.test(msg);
  if (code === "42P01" && aboutBlocks) return true;
  if (code === "42703" && aboutBlocks) return true;
  return /user_blocks/i.test(msg) && /does not exist/i.test(msg);
}
