import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { callOpenRouter, isOpenRouterConfigured } from "../lib/openrouter";
import {
  POST_CONTENT_INTEREST_CATEGORIES,
  POST_CONTENT_INTEREST_SLUGS,
  POST_CONTENT_INTEREST_VERSION,
  POST_INTEREST_BROAD_MAX,
  POST_INTEREST_BROAD_MIN,
  POST_INTEREST_GEO_MAX,
  POST_INTEREST_SPECIFIC_MAX,
  posts,
  type PostContentInterestCategorySlug,
  type PostContentInterestsPayload,
  type PostInterestCluster,
} from "@shared/schema";

const MAX_TEXT_CHARS = 6000;
const DEFAULT_INTERESTS_MODEL = "openai/gpt-4o-mini";

function isPostInterestClassifyEnabled(): boolean {
  if (process.env.POST_INTEREST_CLASSIFY_ENABLED?.trim() === "0") return false;
  return isOpenRouterConfigured();
}

function interestsModel(): string {
  return (
    process.env.OPENROUTER_POST_INTERESTS_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_INTERESTS_MODEL
  );
}

function stripLlmJsonFence(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(s);
  if (fence?.[1]) s = fence[1].trim();
  return s;
}

function normalizeTag(s: string): string | null {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 1 || t.length > 64) return null;
  return t;
}

function normalizeTagList(raw: unknown, min: number, max: number, pad: string): string[] {
  if (!Array.isArray(raw)) return min > 0 ? [pad] : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeTag(item);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    tags.push(n);
    if (tags.length >= max) break;
  }
  while (tags.length < min) tags.push(pad);
  return tags.slice(0, max);
}

function parseCluster(raw: unknown): PostInterestCluster | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const broad = normalizeTagList(o.broad, POST_INTEREST_BROAD_MIN, POST_INTEREST_BROAD_MAX, "общее");
  const specific = normalizeTagList(o.specific, 0, POST_INTEREST_SPECIFIC_MAX, "");
  const specFiltered = specific.filter((t) => t !== "");
  return { broad, specific: specFiltered };
}

function normalizeGeoMentions(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const n = normalizeTag(item);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
    if (out.length >= POST_INTEREST_GEO_MAX) break;
  }
  return out.length > 0 ? out : undefined;
}

function normalizePayload(parsed: unknown): PostContentInterestsPayload | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const inner =
    o.categories && typeof o.categories === "object" ? (o.categories as Record<string, unknown>) : null;
  if (!inner) return null;

  const categories = {} as Record<PostContentInterestCategorySlug, PostInterestCluster>;
  for (const slug of POST_CONTENT_INTEREST_SLUGS) {
    const cl = parseCluster(inner[slug]);
    if (!cl) return null;
    categories[slug] = cl;
  }

  const geoMentions = normalizeGeoMentions(o.geoMentions);

  return {
    v: POST_CONTENT_INTEREST_VERSION,
    categories,
    ...(geoMentions ? { geoMentions } : {}),
  };
}

function buildSystemPrompt(): string {
  const catLines = POST_CONTENT_INTEREST_CATEGORIES.map(
    (c) => `- "${c.slug}" (${c.labelRu}): ${c.hintRu}`,
  );
  const exampleSlug = POST_CONTENT_INTEREST_SLUGS[0];
  return [
    "Ты классификатор постов для рекомендаций. По тексту поста заполни структуру ниже.",
    "",
    "Правила:",
    `- В каждой категории: "broad" — ${POST_INTEREST_BROAD_MIN}–${POST_INTEREST_BROAD_MAX} широких тегов на русском (ниша, сфера).`,
    `- "specific" — 0–${POST_INTEREST_SPECIFIC_MAX} УЗКИХ тегов ТОЛЬКО если явно следуют из текста (марка авто, имя бренда, дисциплина, конкретное место как объект события). Если нет оснований — пустой массив [].`,
    "- Не дублируй одинаковые строки в broad и specific внутри одной категории.",
    `- "geoMentions": до ${POST_INTEREST_GEO_MAX} упомянутых в тексте городов/стран/регионов (именительный падеж, как в новостях: «Екатеринбург»). Если гео нет — [] или опусти ключ.`,
    "- Теги без #, короткие фразы.",
    "",
    "Ответ ТОЛЬКО JSON вида:",
    `{"geoMentions":["…"],"categories":{"${exampleSlug}":{"broad":["…"],"specific":["…"]}, … все 10 slug …}}`,
    "",
    "Категории:",
    ...catLines,
  ].join("\n");
}

export async function classifyPostTextToInterests(text: string): Promise<PostContentInterestsPayload | null> {
  const trimmed = text.trim();
  const body =
    trimmed.length > 0
      ? trimmed.slice(0, MAX_TEXT_CHARS)
      : "(Пост без текста, только медиа. Заполни broad нейтрально, specific везде []. geoMentions [].)";

  const raw = await callOpenRouter(
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: `Текст поста:\n${body}` },
    ],
    {
      model: interestsModel(),
      maxTokens: 2800,
      temperature: 0.2,
    },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripLlmJsonFence(raw));
  } catch {
    return null;
  }

  const normalized = normalizePayload(parsed);
  if (!normalized) return null;
  return { ...normalized, model: interestsModel() };
}

/** Фоновая классификация; данные только в БД, не в API. */
export function schedulePostContentInterestsClassification(postId: string): void {
  if (!isPostInterestClassifyEnabled()) return;
  const id = postId.trim();
  if (!id) return;

  void (async () => {
    try {
      const db = getDb();
      const [row] = await db
        .select({ text: posts.text, isDraft: posts.isDraft })
        .from(posts)
        .where(eq(posts.id, id))
        .limit(1);
      if (!row || row.isDraft) return;

      const payload = await classifyPostTextToInterests(row.text ?? "");
      if (!payload) {
        console.warn("[posts/content-interests] classify failed or invalid JSON for post", id);
        return;
      }

      await db
        .update(posts)
        .set({
          contentInterests: payload,
          contentInterestsAt: new Date(),
        })
        .where(eq(posts.id, id));
    } catch (e) {
      console.warn("[posts/content-interests]", id, (e as Error).message);
    }
  })();
}

/** Для будущего ранжирования на сервере (не использовать в публичных ответах API). */
export async function getStoredPostContentInterests(postId: string): Promise<PostContentInterestsPayload | null> {
  const id = postId.trim();
  if (!id) return null;
  const db = getDb();
  const [row] = await db
    .select({ contentInterests: posts.contentInterests })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  const raw = row?.contentInterests;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as PostContentInterestsPayload;
  if (o.v !== POST_CONTENT_INTEREST_VERSION || !o.categories) return null;
  return o;
}
