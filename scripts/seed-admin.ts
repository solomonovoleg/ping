/**
 * Создаёт супер-админа: логин admin, пароль 667866.
 * Локально: npm run seed:admin (нужен .env с DATABASE_URL).
 * На сервере: node dist/seed-admin.cjs (из папки проекта, подхватит .env).
 */
import "dotenv/config";
import { hashPassword } from "../server/auth/password";
import { getDb } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_PHONE = "admin";
const ADMIN_PASSWORD = "667866";
const ADMIN_PUBLIC_ID = 1;

async function main() {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.phone, ADMIN_PHONE)).limit(1);
  const hashed = hashPassword(ADMIN_PASSWORD);

  if (existing) {
    await db
      .update(users)
      .set({ password: hashed, platformRole: "super_admin" })
      .where(eq(users.id, existing.id));
    console.log("Супер-админ обновлён: логин admin, пароль 667866");
  } else {
    await db.insert(users).values({
      phone: ADMIN_PHONE,
      password: hashed,
      publicId: ADMIN_PUBLIC_ID,
      platformRole: "super_admin",
    });
    console.log("Супер-админ создан: логин admin, пароль 667866");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
