import "dotenv/config";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { hashPassword } from "../server/auth/password";
import { ensureUserColumns, getDb } from "../server/db";
import {
  contacts,
  follows,
  postComments,
  postReactions,
  posts,
  stories,
  storyLikes,
  storyViews,
  users,
} from "../shared/schema";
import { insertFollowsDesignatedToSeeds } from "./seed-auto-follow";

const DEFAULT_USERS_COUNT = 24;
const MIN_USERS_COUNT = 20;
const MAX_USERS_COUNT = 30;
const PHONE_PREFIX = "seed_social_";
const PASSWORD = "test1234";
const MIN_POSTS_PER_USER = 2;
const MAX_POSTS_PER_USER = 6;

const CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Екатеринбург",
  "Новосибирск",
  "Краснодар",
  "Сочи",
  "Нижний Новгород",
  "Томск",
  "Владивосток",
];

const STATUSES = [
  "Вдохновляюсь новыми идеями",
  "Читаю новости с утра",
  "Люблю короткие форматы",
  "Сегодня день для контента",
  "Делюсь полезным и простым",
  "Всегда на связи",
  "Собираю интересные факты",
];

const BIO_TEMPLATES = [
  "Пишу про город, жизнь и технологии.",
  "Лента новостей + личные наблюдения.",
  "Иногда серьезно, иногда с юмором.",
  "Собираю важное из инфополя каждый день.",
  "Делаю сложное понятным и коротким.",
  "Контент, который удобно читать в дороге.",
];

const STORY_MEDIA = [
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1496440737103-cd596325d314?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=900&auto=format&fit=crop",
];

const COMMENT_PHRASES = [
  "Классный разбор, спасибо!",
  "Согласен, это правда важно.",
  "Интересный взгляд, сохранил.",
  "Хорошая подача, читается легко.",
  "Тоже замечал такое в последнее время.",
  "Актуально, особенно сейчас.",
  "Неплохо, жду продолжения темы.",
  "Отличный контент, поддерживаю.",
  "Спасибо за конкретику без воды.",
  "Полезно, отправил друзьям.",
];

const REACTION_EMOJIS = ["❤️", "🔥", "👍", "👏", "💯", "🤔", "😂"];

const FEED_SOURCES: { name: string; url: string; isYandex: boolean }[] = [
  { name: "Yandex News", url: "https://news.yandex.ru/index.rss", isYandex: true },
  { name: "Yandex Dzen", url: "https://dzen.ru/news/rss", isYandex: true },
  { name: "Lenta", url: "https://lenta.ru/rss/news", isYandex: false },
  { name: "Interfax", url: "https://www.interfax.ru/rss.asp", isYandex: false },
  { name: "Ria", url: "https://ria.ru/export/rss2/archive/index.xml", isYandex: false },
  { name: "Gazeta", url: "https://www.gazeta.ru/export/rss/lenta.xml", isYandex: false },
];

type FeedItem = {
  title: string;
  description: string;
  link: string;
  sourceName: string;
  isYandex: boolean;
};

type SeededUser = {
  id: string;
  displayName: string | null;
};

function parseUsersCount(): number {
  const arg = process.argv.find((v) => v.startsWith("--users="));
  if (!arg) return DEFAULT_USERS_COUNT;
  const maybe = Number.parseInt(arg.split("=")[1] ?? "", 10);
  if (!Number.isFinite(maybe)) return DEFAULT_USERS_COUNT;
  return clamp(maybe, MIN_USERS_COUNT, MAX_USERS_COUNT);
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function sample<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, Math.min(count, arr.length)));
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomDateInPast(daysBack: number): Date {
  const now = Date.now();
  const offsetMs = Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

/**
 * Недавняя дата (часы назад). Для постов в ленте важно: сервер берёт только последние N постов
 * по `created_at` (пул ранжирования, см. FEED_RANKING_CANDIDATE_*). Слишком старые сиды не попадут в ленту.
 */
function randomRecentDate(maxHoursBack: number): Date {
  const now = Date.now();
  const offsetMs = Math.floor(Math.random() * maxHoursBack * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

function randomBirthDate(): string {
  const year = randomBetween(1978, 2004);
  const month = String(randomBetween(1, 12)).padStart(2, "0");
  const day = String(randomBetween(1, 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(xmlChunk: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = xmlChunk.match(re);
  return stripHtml(match?.[1] ?? "");
}

async function fetchFeedItemsFromSource(source: (typeof FEED_SOURCES)[number]): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (PING-MOOT seed bot)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`${source.name} responded with ${response.status}`);
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1] ?? "");
  const parsed: FeedItem[] = [];

  for (const chunk of items) {
    const title = extractTag(chunk, "title");
    const description = extractTag(chunk, "description");
    const link = extractTag(chunk, "link");
    if (!title || !link) continue;
    parsed.push({
      title,
      description,
      link,
      sourceName: source.name,
      isYandex: source.isYandex,
    });
  }

  return parsed;
}

async function fetchExternalFeedItems(): Promise<FeedItem[]> {
  const all: FeedItem[] = [];

  for (const source of FEED_SOURCES) {
    try {
      const items = await fetchFeedItemsFromSource(source);
      if (items.length) {
        console.log(`[feed] ${source.name}: ${items.length} items`);
        all.push(...items);
      } else {
        console.log(`[feed] ${source.name}: 0 items`);
      }
    } catch (error) {
      console.log(`[feed] ${source.name}: skip (${error instanceof Error ? error.message : "unknown error"})`);
    }
  }

  // Убираем дубли по ссылке и заголовку.
  const dedup = new Map<string, FeedItem>();
  for (const item of all) {
    const key = `${item.link}|${item.title}`.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, item);
  }
  return Array.from(dedup.values());
}

function toPostText(item: FeedItem): string {
  const snippet = item.description
    ? item.description.slice(0, 260)
    : "Короткий пересказ новости без лишней воды.";
  return `${item.title}\n\n${snippet}\n\nИсточник: ${item.sourceName} — ${item.link}`;
}

function buildFallbackTexts(): string[] {
  return [
    "Городские сервисы становятся удобнее: что изменилось за месяц и как это влияет на повседневные задачи.",
    "Почему короткие перерывы повышают продуктивность: подборка простых практик на каждый день.",
    "Новая экономика внимания: как не утонуть в информационном потоке и сохранить фокус.",
    "Технологии в образовании: что уже работает в школах и что пока остаётся экспериментом.",
    "Тренды локального туризма: куда едут на выходные и как планируют бюджет поездки.",
    "Рынок труда меняется: какие навыки чаще всего ищут работодатели в этом году.",
    "Здоровые привычки без перегруза: мини-шаги, которые дают устойчивый результат.",
    "Как управлять личными финансами в нестабильный период: практические принципы.",
    "Влияние городского шума на стресс: что помогает восстановиться после насыщенного дня.",
    "Новые форматы контента: почему аудитория выбирает короткие и честные истории.",
  ];
}

const MALE_NAMES = [
  "Алексей",
  "Дмитрий",
  "Игорь",
  "Павел",
  "Сергей",
  "Роман",
  "Евгений",
  "Андрей",
  "Никита",
  "Максим",
  "Тимур",
  "Константин",
  "Михаил",
  "Глеб",
  "Артур",
];

const FEMALE_NAMES = [
  "Анна",
  "Мария",
  "Екатерина",
  "Ольга",
  "Юлия",
  "Наталья",
  "Ирина",
  "Светлана",
  "Полина",
  "Дарья",
  "Алина",
  "Валерия",
  "Кристина",
  "Виктория",
  "Елена",
];

const SURNAMES = [
  "Иванова",
  "Петров",
  "Соколова",
  "Кузнецов",
  "Смирнова",
  "Волков",
  "Фёдорова",
  "Морозов",
  "Попова",
  "Лебедев",
  "Новикова",
  "Орлов",
  "Романова",
  "Киселёв",
  "Захарова",
  "Комаров",
  "Прохорова",
  "Егоров",
  "Николаева",
  "Тарасов",
];

function generateProfiles(count: number): Array<{
  displayName: string;
  surname: string;
  gender: "male" | "female" | "other";
  city: string;
  bio: string;
  status: string;
}> {
  const out: Array<{
    displayName: string;
    surname: string;
    gender: "male" | "female" | "other";
    city: string;
    bio: string;
    status: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const gender = Math.random() < 0.45 ? "female" : "male";
    const displayName = gender === "female" ? pick(FEMALE_NAMES) : pick(MALE_NAMES);
    out.push({
      displayName,
      surname: pick(SURNAMES),
      gender,
      city: pick(CITIES),
      bio: pick(BIO_TEMPLATES),
      status: pick(STATUSES),
    });
  }

  return out;
}

async function main() {
  await ensureUserColumns();
  const db = getDb();
  const usersCount = parseUsersCount();
  const reset = hasArg("--reset");
  const yandexOnly = hasArg("--yandex-only");
  const dryRun = hasArg("--dry-run");
  const allowFallback = hasArg("--allow-fallback");

  console.log(
    `[seed] users=${usersCount} reset=${reset} yandexOnly=${yandexOnly} dryRun=${dryRun} allowFallback=${allowFallback}`
  );

  if (reset && !dryRun) {
    const removed = await db.delete(users).where(like(users.phone, `${PHONE_PREFIX}%`)).returning({ id: users.id });
    console.log(`[seed] removed old seeded users: ${removed.length}`);
  }

  const existing = await db.select({ id: users.id }).from(users).where(like(users.phone, `${PHONE_PREFIX}%`)).limit(1);
  if (existing.length > 0 && !reset) {
    console.log(`[seed] seeded users already exist (${PHONE_PREFIX}*). Use --reset to recreate.`);
    process.exit(0);
  }

  const feedItems = await fetchExternalFeedItems();
  const yandexItems = feedItems.filter((item) => item.isYandex);
  const selectedFeedItems = yandexOnly ? yandexItems : feedItems;
  const externalTexts = selectedFeedItems.map(toPostText);
  const postTexts = externalTexts.length ? externalTexts : allowFallback ? buildFallbackTexts() : [];

  console.log(
    `[seed] content items: total=${feedItems.length}, yandex=${yandexItems.length}, used=${postTexts.length}`
  );

  if (!postTexts.length) {
    console.error(
      "[seed] no external content available. Stop seeding to avoid synthetic posts. " +
        "Retry later or use --allow-fallback if you explicitly want template texts."
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log("[seed] dry-run complete (no DB writes).");
    process.exit(0);
  }

  const passwordHash = hashPassword(PASSWORD);
  const [maxPublicIdRow] = await db
    .select({ next: sql<number>`COALESCE(MAX(${users.publicId}), 999) + 1` })
    .from(users);
  let nextPublicId = maxPublicIdRow?.next ?? 1000;

  const profiles = generateProfiles(usersCount);
  const seededUsers: SeededUser[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i]!;
    const [inserted] = await db
      .insert(users)
      .values({
        phone: `${PHONE_PREFIX}${i + 1}`,
        password: passwordHash,
        publicId: nextPublicId++,
        displayName: profile.displayName,
        surname: profile.surname,
        gender: profile.gender,
        birthDate: randomBirthDate(),
        avatarUrl: `https://i.pravatar.cc/300?img=${(i % 70) + 1}`,
        coverUrl: `https://picsum.photos/seed/cover_${i + 1}/1200/400`,
        city: profile.city,
        bio: profile.bio,
        status: profile.status,
        profileLink: `https://t.me/${PHONE_PREFIX}${i + 1}`,
        createdAt: randomDateInPast(120),
      })
      .returning({ id: users.id, displayName: users.displayName });

    if (inserted) seededUsers.push(inserted);
  }

  console.log(`[seed] created users: ${seededUsers.length}`);

  // Граф подписок + контакты для "живой" сети.
  let followsCreated = 0;
  let contactsCreated = 0;

  for (const user of seededUsers) {
    const others = seededUsers.filter((u) => u.id !== user.id);
    const followTargets = sample(others, randomBetween(6, Math.min(14, others.length)));
    for (const target of followTargets) {
      await db
        .insert(follows)
        .values({
          followerId: user.id,
          followingId: target.id,
          createdAt: randomDateInPast(90),
        })
        .onConflictDoNothing();
      followsCreated++;

      if (Math.random() < 0.55) {
        await db
          .insert(contacts)
          .values({
            userId: user.id,
            contactUserId: target.id,
            addedAt: randomDateInPast(80),
          })
          .onConflictDoNothing();
        contactsCreated++;
      }
    }
  }

  console.log(`[seed] follows: ${followsCreated}, contacts: ${contactsCreated}`);

  const autoFollow = await insertFollowsDesignatedToSeeds(
    db,
    seededUsers.map((u) => u.id)
  );
  console.log(
    `[seed] auto-follow (твой аккаунт + «Леха прогер» → все ${PHONE_PREFIX}*): подписчиков ${autoFollow.followerCount}, попыток follows ${autoFollow.attempted}`
  );

  const createdPostIdsByAuthor = new Map<string, string[]>();
  let textIndex = 0;
  let postsCreated = 0;
  let commentsCreated = 0;
  let postReactionsCreated = 0;

  for (const author of seededUsers) {
    const postCount = randomBetween(MIN_POSTS_PER_USER, MAX_POSTS_PER_USER);
    const ownPostIds: string[] = [];

    for (let p = 0; p < postCount; p++) {
      const text = postTexts[textIndex % postTexts.length]!;
      textIndex++;
      // Последние ~72 ч — чтобы посты гарантированно входили в пул ленты (не «терялись» за сотнями более новых).
      const createdAt = randomRecentDate(72);

      const [createdPost] = await db
        .insert(posts)
        .values({
          authorId: author.id,
          text,
          imageUrl: Math.random() < 0.7 ? `https://picsum.photos/seed/post_${textIndex}/1200/900` : null,
          createdAt,
        })
        .returning({ id: posts.id });
      if (!createdPost) continue;

      postsCreated++;
      ownPostIds.push(createdPost.id);

      const peers = seededUsers.filter((u) => u.id !== author.id);
      const reactors = sample(peers, randomBetween(2, Math.min(8, peers.length)));
      const reactionsCounter = new Map<string, number>();

      for (const reactor of reactors) {
        const emoji = pick(REACTION_EMOJIS);
        await db
          .insert(postReactions)
          .values({
            postId: createdPost.id,
            userId: reactor.id,
            emoji,
            createdAt: randomRecentDate(70),
          })
          .onConflictDoNothing();
        postReactionsCreated++;
        reactionsCounter.set(emoji, (reactionsCounter.get(emoji) ?? 0) + 1);
      }

      const aggregated = Array.from(reactionsCounter.entries()).map(([emoji, count]) => ({ emoji, count }));
      await db
        .update(posts)
        .set({
          reactions: aggregated,
        })
        .where(eq(posts.id, createdPost.id));

      const commentsCount = randomBetween(0, 4);
      const commentAuthors = sample(peers, commentsCount);
      for (const commenter of commentAuthors) {
        await db.insert(postComments).values({
          postId: createdPost.id,
          userId: commenter.id,
          text: pick(COMMENT_PHRASES),
          createdAt: randomRecentDate(68),
        });
        commentsCreated++;
      }
    }

    createdPostIdsByAuthor.set(author.id, ownPostIds);
  }

  console.log(
    `[seed] posts=${postsCreated}, postReactions=${postReactionsCreated}, postComments=${commentsCreated}`
  );

  // Небольшая часть профилей получает закрепленный пост.
  for (const user of seededUsers) {
    const ownPosts = createdPostIdsByAuthor.get(user.id) ?? [];
    if (!ownPosts.length || Math.random() < 0.65) continue;
    await db
      .update(users)
      .set({ pinnedPostId: pick(ownPosts) })
      .where(and(eq(users.id, user.id), like(users.phone, `${PHONE_PREFIX}%`)));
  }

  let storiesCreated = 0;
  let storyViewsCreated = 0;
  let storyLikesCreated = 0;

  for (const user of seededUsers) {
    const storiesCount = randomBetween(0, 3);
    for (let i = 0; i < storiesCount; i++) {
      const createdAt = randomDateInPast(1);
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

      const [story] = await db
        .insert(stories)
        .values({
          authorId: user.id,
          mediaUrl: pick(STORY_MEDIA),
          thumbnailUrl: pick(STORY_MEDIA),
          createdAt,
          expiresAt,
        })
        .returning({ id: stories.id });

      if (!story) continue;
      storiesCreated++;

      const peers = seededUsers.filter((u) => u.id !== user.id);
      const viewers = sample(peers, randomBetween(4, Math.min(14, peers.length)));
      for (const viewer of viewers) {
        await db
          .insert(storyViews)
          .values({
            storyId: story.id,
            userId: viewer.id,
            viewedAt: randomDateInPast(1),
          })
          .onConflictDoNothing();
        storyViewsCreated++;

        if (Math.random() < 0.45) {
          await db
            .insert(storyLikes)
            .values({
              storyId: story.id,
              userId: viewer.id,
              createdAt: randomDateInPast(1),
            })
            .onConflictDoNothing();
          storyLikesCreated++;
        }
      }
    }
  }

  const [latestSeeded] = await db
    .select({
      phone: users.phone,
      displayName: users.displayName,
    })
    .from(users)
    .where(like(users.phone, `${PHONE_PREFIX}%`))
    .orderBy(desc(users.createdAt))
    .limit(1);

  console.log(`[seed] stories=${storiesCreated}, storyViews=${storyViewsCreated}, storyLikes=${storyLikesCreated}`);
  console.log(`[seed] done. Login examples: ${PHONE_PREFIX}1 ... ${PHONE_PREFIX}${seededUsers.length}`);
  console.log(`[seed] common password: ${PASSWORD}`);
  if (latestSeeded) {
    console.log(`[seed] latest account: ${latestSeeded.phone} (${latestSeeded.displayName ?? "no-name"})`);
  }
}

main().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
