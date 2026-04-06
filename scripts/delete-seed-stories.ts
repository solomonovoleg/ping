/**
 * Удаляет все сториз, опубликованные тестовыми / сид-пользователями:
 * - phone LIKE 'test_seed_%' (npm run seed:test-users)
 * - phone LIKE 'seed_social_%' (npm run seed:social-content / seed:social-fresh)
 * - is_studio_synthetic = true (медиа-студия в админке)
 *
 * Сначала чистятся уведомления с story_id (в схеме нет FK на stories).
 * Просмотры/лайки/пины к сториз удаляются каскадом в БД.
 *
 * Локально: npm run delete:seed-stories
 * На сервере (после npm run build): из каталога проекта с .env и DATABASE_URL:
 *   node dist/delete-seed-stories.cjs
 *   npm run delete:seed-stories:prod
 * Проверка без записи: добавьте --dry-run в конец команды.
 *
 * Только часть сидов (можно комбинировать):
 *   --only-test-seed   телефоны test_seed_*
 *   --only-social      телефоны seed_social_*
 *   --only-studio      is_studio_synthetic (медиа-студия)
 * Без этих флагов — все три группы, как раньше.
 *
 * Примеры:
 *   npm run delete:seed-stories -- --only-social
 *   npm run delete:seed-stories -- --only-test-seed --only-studio --dry-run
 *
 * Нужен .env с DATABASE_URL.
 */
import "dotenv/config";
import { eq, inArray, like, or, type SQL } from "drizzle-orm";
import { ensureUserColumns, getDb } from "../server/db";
import { notifications, stories, users } from "../shared/schema";

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

function buildSeedUserFilter(): { where: SQL; label: string } {
  const narrowed =
    hasArg("--only-test-seed") || hasArg("--only-social") || hasArg("--only-studio");

  const wantTest = !narrowed || hasArg("--only-test-seed");
  const wantSocial = !narrowed || hasArg("--only-social");
  const wantStudio = !narrowed || hasArg("--only-studio");

  const parts: SQL[] = [];
  const labels: string[] = [];
  if (wantTest) {
    parts.push(like(users.phone, "test_seed_%"));
    labels.push("test_seed_*");
  }
  if (wantSocial) {
    parts.push(like(users.phone, "seed_social_%"));
    labels.push("seed_social_*");
  }
  if (wantStudio) {
    parts.push(eq(users.isStudioSynthetic, true));
    labels.push("studio_synthetic");
  }

  if (parts.length === 0) {
    throw new Error("Внутренняя ошибка: пустой фильтр авторов");
  }

  const where = parts.length === 1 ? parts[0]! : or(parts[0]!, parts[1]!, ...parts.slice(2));
  return { where, label: labels.join(" | ") };
}

async function main() {
  const dryRun = hasArg("--dry-run");
  await ensureUserColumns();
  const db = getDb();

  const { where: seedUserWhere, label: filterLabel } = buildSeedUserFilter();
  console.log(`Фильтр авторов: ${filterLabel}`);

  const seedUsers = await db.select({ id: users.id }).from(users).where(seedUserWhere);
  const authorIds = seedUsers.map((u) => u.id);

  if (authorIds.length === 0) {
    console.log("Нет пользователей под выбранный фильтр. Сториз не трогаем.");
    return;
  }

  const storyRows = await db.select({ id: stories.id }).from(stories).where(inArray(stories.authorId, authorIds));
  const storyIds = storyRows.map((r) => r.id);

  console.log(
    `Авторов-сида: ${authorIds.length}, сториз к удалению: ${storyIds.length}${dryRun ? " (dry-run)" : ""}`,
  );

  if (storyIds.length === 0) {
    return;
  }

  if (dryRun) {
    console.log("Dry-run: БД не изменялась.");
    return;
  }

  await db.delete(notifications).where(inArray(notifications.storyId, storyIds));
  const removed = await db.delete(stories).where(inArray(stories.authorId, authorIds)).returning({ id: stories.id });
  console.log(`Готово. Удалено сториз: ${removed.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
