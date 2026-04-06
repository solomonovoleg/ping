import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { posts, users } from "@shared/schema";

export type ContentIngestConfig = {
  enabled: boolean;
  sourceName: string;
  sourceUrl: string;
  authorUserId: string | null;
  intervalMinutes: number;
  postsPerRun: number;
  includeImage: boolean;
  onlyWithImage: boolean;
};

export type ContentIngestStatus = {
  isRunning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastCreated: number;
  lastSkipped: number;
};

type FeedItem = {
  title: string;
  description: string;
  link: string;
  imageUrl: string | null;
};

type RunResult = {
  created: number;
  skipped: number;
  totalItems: number;
  message: string;
};

const DEFAULT_SOURCE_URL = "https://news.yandex.ru/index.rss";

let config: ContentIngestConfig = {
  enabled: false,
  sourceName: "Yandex News",
  sourceUrl: process.env.ADMIN_CONTENT_SOURCE_URL || DEFAULT_SOURCE_URL,
  authorUserId: process.env.ADMIN_CONTENT_AUTHOR_USER_ID || null,
  intervalMinutes: Math.max(5, Number(process.env.ADMIN_CONTENT_INTERVAL_MINUTES || 30)),
  postsPerRun: Math.max(1, Math.min(20, Number(process.env.ADMIN_CONTENT_POSTS_PER_RUN || 3))),
  includeImage: true,
  onlyWithImage: false,
};

let status: ContentIngestStatus = {
  isRunning: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastCreated: 0,
  lastSkipped: 0,
};

let pollerStarted = false;
let pollTimer: NodeJS.Timeout | null = null;
let inFlight = false;
let lastAutoRunAtMs = 0;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sanitizeConfig(patch: Partial<ContentIngestConfig>): Partial<ContentIngestConfig> {
  const next: Partial<ContentIngestConfig> = {};
  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (typeof patch.sourceName === "string") next.sourceName = patch.sourceName.trim().slice(0, 100);
  if (typeof patch.sourceUrl === "string") next.sourceUrl = patch.sourceUrl.trim();
  if (typeof patch.authorUserId === "string" || patch.authorUserId === null) {
    next.authorUserId = patch.authorUserId;
  }
  if (typeof patch.intervalMinutes === "number" && Number.isFinite(patch.intervalMinutes)) {
    next.intervalMinutes = clamp(Math.round(patch.intervalMinutes), 5, 24 * 60);
  }
  if (typeof patch.postsPerRun === "number" && Number.isFinite(patch.postsPerRun)) {
    next.postsPerRun = clamp(Math.round(patch.postsPerRun), 1, 20);
  }
  if (typeof patch.includeImage === "boolean") next.includeImage = patch.includeImage;
  if (typeof patch.onlyWithImage === "boolean") next.onlyWithImage = patch.onlyWithImage;
  return next;
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

function extractTag(chunk: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = chunk.match(re);
  return stripHtml(match?.[1] ?? "");
}

function extractImage(chunk: string): string | null {
  const media = chunk.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*>/i)?.[1];
  if (media) return media;
  const enclosure = chunk.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i)?.[1];
  if (enclosure) return enclosure;
  const desc = chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
  const fromImg = desc.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1];
  return fromImg ?? null;
}

async function fetchRssItems(url: string): Promise<FeedItem[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (PING-MOOT admin parser)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!response.ok) {
    throw new Error(`source responded with ${response.status}`);
  }
  const xml = await response.text();
  const chunks: string[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    chunks.push(match[1] ?? "");
  }
  const items: FeedItem[] = [];
  for (const chunk of chunks) {
    const title = extractTag(chunk, "title");
    const description = extractTag(chunk, "description");
    const link = extractTag(chunk, "link");
    if (!title || !link) continue;
    items.push({
      title,
      description,
      link,
      imageUrl: extractImage(chunk),
    });
  }
  return items;
}

function composePostText(sourceName: string, item: FeedItem): string {
  const preview = item.description ? item.description.slice(0, 280) : "Краткий пересказ новости.";
  return `${item.title}\n\n${preview}\n\nИсточник: ${sourceName} — ${item.link}`;
}

async function ensureAuthorExists(authorUserId: string): Promise<void> {
  const db = getDb();
  const [author] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, authorUserId), eq(users.isBlocked, false)))
    .limit(1);
  if (!author) throw new Error("Автор не найден или заблокирован");
}

async function getRecentSourceLinksForAuthor(authorUserId: string): Promise<Set<string>> {
  const db = getDb();
  const recent = await db
    .select({ text: posts.text })
    .from(posts)
    .where(eq(posts.authorId, authorUserId))
    .orderBy(desc(posts.createdAt))
    .limit(400);
  const links = new Set<string>();
  for (const row of recent) {
    const matches = row.text.match(/https?:\/\/\S+/g) ?? [];
    for (const link of matches) links.add(link.trim());
  }
  return links;
}

export function getContentIngestState(): { config: ContentIngestConfig; status: ContentIngestStatus } {
  return { config: { ...config }, status: { ...status } };
}

export function updateContentIngestConfig(patch: Partial<ContentIngestConfig>): ContentIngestConfig {
  const next = sanitizeConfig(patch);
  config = { ...config, ...next };
  return { ...config };
}

export async function runContentIngestNow(trigger: "manual" | "auto" = "manual"): Promise<RunResult> {
  if (inFlight) {
    return { created: 0, skipped: 0, totalItems: 0, message: "Уже выполняется импорт" };
  }
  inFlight = true;
  status = { ...status, isRunning: true, lastRunAt: new Date().toISOString() };
  try {
    const authorUserId = config.authorUserId;
    if (!authorUserId) throw new Error("Не выбран пользователь-автор");
    if (!config.sourceUrl) throw new Error("Не указан RSS URL");
    await ensureAuthorExists(authorUserId);

    const items = await fetchRssItems(config.sourceUrl);
    if (!items.length) throw new Error("В RSS нет доступных записей");

    const existingLinks = await getRecentSourceLinksForAuthor(authorUserId);
    const db = getDb();
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      if (created >= config.postsPerRun) break;
      if (existingLinks.has(item.link)) {
        skipped++;
        continue;
      }
      if (config.onlyWithImage && !item.imageUrl) {
        skipped++;
        continue;
      }

      const imageUrl = config.includeImage ? item.imageUrl : null;
      const { mintUniquePostLinkCode } = await import("../posts/post-link-code");
      await db.insert(posts).values({
        linkCode: await mintUniquePostLinkCode(),
        authorId: authorUserId,
        text: composePostText(config.sourceName || "RSS", item),
        imageUrl,
      });
      existingLinks.add(item.link);
      created++;
    }

    status = {
      ...status,
      isRunning: false,
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
      lastCreated: created,
      lastSkipped: skipped,
    };
    if (trigger === "auto") lastAutoRunAtMs = Date.now();
    return {
      created,
      skipped,
      totalItems: items.length,
      message: created > 0 ? `Опубликовано ${created}` : "Новых материалов для публикации не найдено",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка импорта";
    status = {
      ...status,
      isRunning: false,
      lastError: message,
      lastCreated: 0,
      lastSkipped: 0,
    };
    throw error;
  } finally {
    inFlight = false;
    status = { ...status, isRunning: false };
  }
}

async function tickAutoIngest(): Promise<void> {
  if (!config.enabled || !config.authorUserId || !config.sourceUrl || inFlight) return;
  const now = Date.now();
  const intervalMs = config.intervalMinutes * 60 * 1000;
  if (lastAutoRunAtMs && now - lastAutoRunAtMs < intervalMs) return;
  try {
    await runContentIngestNow("auto");
    lastAutoRunAtMs = now;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка автопарсинга";
    status = { ...status, lastError: message };
    lastAutoRunAtMs = now;
    console.error("[content-ingest] auto run failed:", message);
  }
}

export function startContentIngestPoller(): void {
  if (pollerStarted) return;
  pollerStarted = true;
  pollTimer = setInterval(() => {
    tickAutoIngest().catch((e) => {
      console.error("[content-ingest] tick error:", e);
    });
  }, 60 * 1000);
  pollTimer.unref?.();
}

