/**
 * Создаёт первого пользователя: +79956012736 / 123456.
 * Запуск: npm run seed:first-user (локально с .env) или node dist/seed-first-user.cjs на сервере.
 */
import "dotenv/config";
import { hashPassword } from "../server/auth/password";
import { getDb } from "../server/db";
import { users } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const PHONE = "+79956012736";
const PASSWORD = "123456";
const FIRST_PUBLIC_ID = 100;

async function main() {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.phone, PHONE))
    .limit(1);
  const hashed = hashPassword(PASSWORD);

  if (existing) {
    await db.update(users).set({ password: hashed }).where(eq(users.id, existing.id));
    console.log("Пользователь обновлён: +79956012736, пароль 123456");
    return;
  }

  const [maxRow] = await db
    .select({ next: sql<number>`COALESCE(MAX(${users.publicId}), ${FIRST_PUBLIC_ID - 1}) + 1` })
    .from(users);
  const publicId = maxRow?.next ?? FIRST_PUBLIC_ID;

  await db.insert(users).values({
    phone: PHONE,
    password: hashed,
    publicId,
    platformRole: "user",
  });
  console.log("Первый пользователь создан: +79956012736, пароль 123456, publicId", publicId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
