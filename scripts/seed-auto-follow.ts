/**
 * Подписки реальных аккаунтов на всех сидированных пользователей (ленты/сториз).
 * На проде тот же граф (Леха public_id=5 + +79956012736 → seed_social_*) дублируется идемпотентно в БД
 * скриптом `scripts/migrate-designated-follows.cjs` из `run-migrations.cjs` — без env и отдельной команды.
 *
 * Здесь — расширяемый вариант: SEED_AUTO_FOLLOW_SEEDS_PHONES, SEED_LEKHA_PUBLIC_ID, поиск по имени, SEED_LEKHA_PHONE,
 * служебный lekha_prog (SEED_LEKHA_NO_AUTO=1 отключает авто-создание).
 */
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { hashPassword } from "../server/auth/password";
import { getDb } from "../server/db";
import { follows, users } from "../shared/schema";

type Db = ReturnType<typeof getDb>;

/** Служебный логин «Леха Прогер», если в БД никого с таким именем нет */
const LEKHA_SEED_PHONE = process.env.SEED_LEKHA_SEED_PHONE?.trim() || "lekha_prog";

function parsePhonesFromEnv(): string[] {
  const raw = process.env.SEED_AUTO_FOLLOW_SEEDS_PHONES ?? "+79956012736";
  const phones = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return [...new Set(phones)];
}

export async function resolveDesignatedFollowerUserIds(db: Db): Promise<string[]> {
  const ids = new Set<string>();

  for (const phone of parsePhonesFromEnv()) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (row) {
      ids.add(row.id);
      console.log(`[seed-auto-follow] по телефону: ${phone}`);
    } else {
      console.log(`[seed-auto-follow] пользователь с телефоном ${phone} не найден (пропуск)`);
    }
  }

  /** Леха по числу из URL профиля: /profile/5 → publicId 5 */
  let lehaResolved = false;
  const lekhaPublicRaw = process.env.SEED_LEKHA_PUBLIC_ID?.trim();
  if (lekhaPublicRaw) {
    const n = Number.parseInt(lekhaPublicRaw, 10);
    if (Number.isFinite(n) && n > 0) {
      const [byPublic] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          surname: users.surname,
          publicId: users.publicId,
        })
        .from(users)
        .where(eq(users.publicId, n))
        .limit(1);
      if (byPublic) {
        ids.add(byPublic.id);
        lehaResolved = true;
        console.log(
          `[seed-auto-follow] Леха по publicId=${n} (/profile/${n}): ${[byPublic.displayName, byPublic.surname].filter(Boolean).join(" ") || byPublic.id}`
        );
      } else {
        console.log(`[seed-auto-follow] SEED_LEKHA_PUBLIC_ID=${n} — в БД нет пользователя с таким public_id`);
      }
    }
  }

  const lehaCond = or(
    and(ilike(users.displayName, "%леха%"), ilike(users.displayName, "%прогер%")),
    and(ilike(users.displayName, "%леха%"), ilike(users.surname, "%прогер%")),
    and(ilike(users.displayName, "%leha%"), ilike(users.surname, "%prog%")),
    ilike(users.displayName, "%леха прогер%")
  );
  const lehaRows = await db
    .select({ id: users.id, displayName: users.displayName, surname: users.surname })
    .from(users)
    .where(lehaCond)
    .limit(10);

  for (const r of lehaRows) {
    ids.add(r.id);
    lehaResolved = true;
    console.log(
      `[seed-auto-follow] «Леха прогер» по имени: ${[r.displayName, r.surname].filter(Boolean).join(" ") || r.id}`
    );
  }

  if (!lehaResolved) {
    const lekhaPhone = process.env.SEED_LEKHA_PHONE?.trim();
    if (lekhaPhone) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.phone, lekhaPhone)).limit(1);
      if (row) {
        ids.add(row.id);
        console.log(`[seed-auto-follow] SEED_LEKHA_PHONE=${lekhaPhone}`);
      } else {
        console.log(`[seed-auto-follow] SEED_LEKHA_PHONE=${lekhaPhone} — пользователь не найден`);
      }
    } else if (process.env.SEED_LEKHA_NO_AUTO === "1") {
      console.log(`[seed-auto-follow] «Леха прогер» не найден, авто-создание отключено (SEED_LEKHA_NO_AUTO=1)`);
    } else {
      const createdId = await ensureLekhaProgSeedUser(db);
      if (createdId) {
        ids.add(createdId);
        console.log(
          `[seed-auto-follow] создан служебный «Леха Прогер»: login ${LEKHA_SEED_PHONE}, пароль test1234`
        );
      }
    }
  }

  return Array.from(ids);
}

async function ensureLekhaProgSeedUser(db: Db): Promise<string | null> {
  const [byPhone] = await db.select({ id: users.id }).from(users).where(eq(users.phone, LEKHA_SEED_PHONE)).limit(1);
  if (byPhone) {
    console.log(`[seed-auto-follow] уже есть пользователь phone=${LEKHA_SEED_PHONE}`);
    return byPhone.id;
  }
  const [maxRow] = await db
    .select({ next: sql<number>`COALESCE(MAX(${users.publicId}), 0) + 1` })
    .from(users);
  const publicId = maxRow?.next ?? 1;
  try {
    const [row] = await db
      .insert(users)
      .values({
        phone: LEKHA_SEED_PHONE,
        password: hashPassword("test1234"),
        publicId,
        displayName: "Леха",
        surname: "Прогер",
        gender: "male",
      })
      .returning({ id: users.id });
    return row?.id ?? null;
  } catch (e) {
    console.error("[seed-auto-follow] не удалось создать Леху Прогера:", e);
    return null;
  }
}

/** Подписать заданных пользователей на всех сидов (follower -> following). */
export async function insertFollowsDesignatedToSeeds(
  db: Db,
  seedUserIds: string[]
): Promise<{ followerCount: number; attempted: number }> {
  if (seedUserIds.length === 0) return { followerCount: 0, attempted: 0 };
  const followerIds = await resolveDesignatedFollowerUserIds(db);
  let attempted = 0;
  for (const followerId of followerIds) {
    for (const followingId of seedUserIds) {
      if (followerId === followingId) continue;
      await db.insert(follows).values({ followerId, followingId }).onConflictDoNothing();
      attempted++;
    }
  }
  return { followerCount: followerIds.length, attempted };
}
