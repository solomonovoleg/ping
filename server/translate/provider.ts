/**
 * Chat translation via OpenRouter (LLM). Same OPENROUTER_API_KEY as AI OVER.
 * Cache: message_translations table (keyed by messageId + targetLang).
 */

/** BCP-47-ish codes from client translate dropdown → English name for the LLM prompt */
const TARGET_LANG_LABEL: Record<string, string> = {
  ru: "Russian",
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

export interface TranslateResult {
  translatedText: string;
  detectedLang: string;
}

/** Опционально: предыдущие реплики в чате для снятия двусмысленности (местоимения, сленг). */
export type TranslateOptions = {
  chatId?: string;
  /** Время сообщения, которое переводим — в контекст попадают только более ранние. */
  anchorCreatedAt?: Date;
};

/** Сколько предыдущих реплик подмешивать в промпт (смысл, ирония, отсылки). */
const CONTEXT_MSG_CAP = 10;
const CONTEXT_LINE_MAX = 420;

async function loadPriorTextLinesForTranslate(
  chatId: string,
  messageId: string,
  anchorCreatedAt: Date,
): Promise<string[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { getDb } = await import("../db");
    const { messages } = await import("@shared/schema");
    const { eq, and, lt, ne, desc } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.type, "text"),
          ne(messages.id, messageId),
          lt(messages.createdAt, anchorCreatedAt),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(CONTEXT_MSG_CAP);

    const lines: string[] = [];
    for (const r of rows) {
      const t = (r.content ?? "").trim().replace(/\s+/g, " ");
      if (!t) continue;
      lines.push(t.length > CONTEXT_LINE_MAX ? `${t.slice(0, CONTEXT_LINE_MAX)}…` : t);
    }
    return lines.reverse();
  } catch {
    return [];
  }
}

// --------------- In-memory prefs cache (backed by DB via routes) ---------------

export type TranslatePref = { enabled: boolean; targetLang: string };

const prefsCache = new Map<string, TranslatePref>();

function prefKey(userId: string, chatId: string): string {
  return `${userId}:${chatId}`;
}

export function getCachedPref(userId: string, chatId: string): TranslatePref | undefined {
  return prefsCache.get(prefKey(userId, chatId));
}

export function setCachedPref(userId: string, chatId: string, pref: TranslatePref): void {
  prefsCache.set(prefKey(userId, chatId), pref);
}

/** Get translate preference: memory cache first, DB fallback. */
export async function getPref(userId: string, chatId: string): Promise<TranslatePref | undefined> {
  const cached = getCachedPref(userId, chatId);
  if (cached) return cached;
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const { getDb } = await import("../db");
    const { chatTranslatePrefs } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const db = getDb();
    const [row] = await db
      .select()
      .from(chatTranslatePrefs)
      .where(and(eq(chatTranslatePrefs.userId, userId), eq(chatTranslatePrefs.chatId, chatId)))
      .limit(1);
    if (!row) return undefined;
    const pref: TranslatePref = { enabled: row.enabled, targetLang: row.targetLang };
    setCachedPref(userId, chatId, pref);
    return pref;
  } catch {
    return undefined;
  }
}

// --------------- In-memory translation cache (backed by DB) ---------------

const translationCache = new Map<string, TranslateResult>();

function cacheKey(messageId: string, targetLang: string): string {
  return `${messageId}:${targetLang}`;
}

export function getCachedTranslation(messageId: string, targetLang: string): TranslateResult | undefined {
  return translationCache.get(cacheKey(messageId, targetLang));
}

export function setCachedTranslation(messageId: string, targetLang: string, result: TranslateResult): void {
  translationCache.set(cacheKey(messageId, targetLang), result);
}

// --------------- OpenRouter ---------------

/** Убрать типичные преамбулы, если модель нарушила формат. */
function normalizeModelTranslationOutput(raw: string): string {
  let t = raw.trim().replace(/^["']|["']$/g, "");
  const oneLinePref = /^(translation|перевод|here'?s the translation|the translation is)\s*[:：]\s*/i;
  t = t.replace(oneLinePref, "").trim();
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0].length < 56 && oneLinePref.test(lines[0])) {
    return lines.slice(1).join("\n").trim();
  }
  if (lines.length >= 2 && lines[0].length < 24 && /^(translation|перевод)\b/i.test(lines[0])) {
    return lines.slice(1).join("\n").trim();
  }
  return t;
}

async function callOpenRouterTranslate(
  text: string,
  targetLang: string,
  priorLines?: string[],
): Promise<TranslateResult | null> {
  const { callOpenRouter, isOpenRouterConfigured } = await import("../lib/openrouter");
  if (!isOpenRouterConfigured()) {
    if (process.env.TRANSLATE_DEBUG === "1") {
      console.warn("[translate] OPENROUTER_API_KEY not set");
    }
    return null;
  }
  const model =
    process.env.OPENROUTER_TRANSLATE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "openai/gpt-4o-mini";
  const label = TARGET_LANG_LABEL[targetLang] ?? targetLang;
  const hasContext = priorLines && priorLines.length > 0;
  const systemPrompt =
    `You translate mobile instant messages (messengers: short, informal lines).

Primary goal: convey what the sender MEANT — intent, implication, and emotional tone — not a dictionary or word-for-word gloss. ` +
    `Write the way a native ${label} speaker would naturally type in the same register (casual, slang, humor, irritation, affection) as the original. ` +
    `Map idioms and fixed expressions to natural equivalents in ${label}; avoid literal calques that sound wooden or wrong.

Use earlier lines in the thread only to resolve references (who/what), subtext, and tone. Do not copy or summarize them into your answer.

Hard rules:
- Do not invent facts, names, or details not present in the message you translate.
- Do not explain the joke or add apologies; just produce the message as the user would send it.
- Keep emojis, @mentions, URLs, and numbers as in the source unless grammar in ${label} requires a small fix.
- If that message is already entirely in ${label}, return it unchanged (same wording).

Output: ONLY the translated message text — one chat line or one short paragraph like a real reply. No quotes, no "Translation:", no markdown, no bullets, no notes.`;

  const userBlock = hasContext
    ? [
        `Earlier messages in the same chat (oldest first). Use for context and tone only; your output must be ONLY the translation of the final line below.`,
        "",
        ...priorLines.map((line, i) => `${i + 1}. ${line}`),
        "",
        `---`,
        `Translate the following line into ${label} (BCP-47: ${targetLang}). Output nothing else:`,
        text,
      ].join("\n")
    : [
        `Translate the following chat line into ${label} (BCP-47: ${targetLang}).`,
        `Prioritize natural meaning and how a native speaker would say it in a messenger, not literal words.`,
        ``,
        text,
      ].join("\n");
  try {
    const out = await callOpenRouter(
      [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userBlock,
        },
      ],
      {
        model,
        maxTokens: Math.min(
          2048,
          Math.ceil(text.length / 2) + (hasContext ? 320 : 160) + (hasContext ? priorLines!.join("").length / 8 : 0),
        ),
        temperature: 0.28,
      },
    );
    const trimmed = normalizeModelTranslationOutput(out);
    if (!trimmed) return null;
    return { translatedText: trimmed, detectedLang: "auto" };
  } catch (e) {
    if (process.env.TRANSLATE_DEBUG === "1") console.warn("[translate] openrouter", e);
    return null;
  }
}

export async function callProvider(
  text: string,
  targetLang: string,
  _sourceLang?: string,
  priorLines?: string[],
): Promise<TranslateResult | null> {
  return callOpenRouterTranslate(text, targetLang, priorLines);
}

/**
 * Translate text with DB + memory cache.
 * 1. Check memory cache
 * 2. Check DB (if available)
 * 3. Call OpenRouter, store in DB + memory
 */
export async function translate(
  text: string,
  targetLang: string,
  messageId?: string,
  sourceLang?: string,
  options?: TranslateOptions,
): Promise<TranslateResult | null> {
  let priorLines: string[] | undefined;
  const anchor = options?.anchorCreatedAt;
  const anchorOk = anchor != null && !Number.isNaN(anchor.getTime());
  if (messageId && options?.chatId && anchorOk) {
    priorLines = await loadPriorTextLinesForTranslate(options.chatId, messageId, anchor);
  }
  const useContext = priorLines && priorLines.length > 0;

  if (!useContext && messageId) {
    const cached = getCachedTranslation(messageId, targetLang);
    if (cached) return cached;
  }

  if (!useContext && messageId && process.env.DATABASE_URL) {
    try {
      const { getDb } = await import("../db");
      const { messageTranslations } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = getDb();
      const [row] = await db
        .select()
        .from(messageTranslations)
        .where(and(eq(messageTranslations.messageId, messageId), eq(messageTranslations.targetLang, targetLang)))
        .limit(1);
      if (row) {
        const result: TranslateResult = { translatedText: row.translatedText, detectedLang: row.detectedLang || "auto" };
        setCachedTranslation(messageId, targetLang, result);
        return result;
      }
    } catch {}
  }

  const result = await callProvider(text, targetLang, sourceLang, useContext ? priorLines : undefined);
  if (!result) return null;

  if (messageId) {
    setCachedTranslation(messageId, targetLang, result);
    if (process.env.DATABASE_URL) {
      try {
        const { getDb } = await import("../db");
        const { messageTranslations } = await import("@shared/schema");
        const db = getDb();
        if (useContext) {
          await db
            .insert(messageTranslations)
            .values({
              messageId,
              targetLang,
              translatedText: result.translatedText,
              detectedLang: result.detectedLang,
            })
            .onConflictDoUpdate({
              target: [messageTranslations.messageId, messageTranslations.targetLang],
              set: {
                translatedText: result.translatedText,
                detectedLang: result.detectedLang,
              },
            });
        } else {
          await db.insert(messageTranslations).values({
            messageId,
            targetLang,
            translatedText: result.translatedText,
            detectedLang: result.detectedLang,
          }).onConflictDoNothing();
        }
      } catch {}
    }
  }

  return result;
}
