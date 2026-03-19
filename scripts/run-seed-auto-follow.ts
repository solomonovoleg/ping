/**
 * Одноразово подписывает «тебя» и Леху на всех уже существующих seed_social_* (без пересоздания сида).
 * Запуск: npm run seed:auto-follow
 */
import "dotenv/config";
import { like } from "drizzle-orm";
import { ensureUserColumns, getDb } from "../server/db";
import { users } from "../shared/schema";
import { insertFollowsDesignatedToSeeds } from "./seed-auto-follow";

const PREFIX = process.env.SEED_AUTO_FOLLOW_PHONE_PREFIX?.trim() || "seed_social_%";

async function main() {
  await ensureUserColumns();
  const db = getDb();
  const pattern = PREFIX.includes("%") ? PREFIX : `${PREFIX}%`;
  const rows = await db.select({ id: users.id, phone: users.phone }).from(users).where(like(users.phone, pattern));
  if (!rows.length) {
    console.log(`[seed:auto-follow] Нет пользователей с phone LIKE '${pattern}'`);
    process.exit(0);
  }
  const ids = rows.map((r) => r.id);
  const { followerCount, attempted } = await insertFollowsDesignatedToSeeds(db, ids);
  console.log(
    `[seed:auto-follow] готово: ${rows.length} сидов, ${followerCount} подписчиков, попыток вставки follows: ${attempted}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
