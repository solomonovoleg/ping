import { and, eq } from "drizzle-orm";
import { userBlocks } from "@shared/schema";

/**
 * «Полная» блокировка: все три ограничения включены (для фильтра ленты / скрытия контента).
 * Одна точка правды — меньше риска рассинхрона с клиентом при изменении схемы.
 */
export function userBlocksFullRestrictionCondition() {
  return and(
    eq(userBlocks.restrictProfile, true),
    eq(userBlocks.restrictChat, true),
    eq(userBlocks.restrictSocial, true),
  );
}
