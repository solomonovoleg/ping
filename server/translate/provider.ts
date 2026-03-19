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

async function callOpenRouterTranslate(text: string, targetLang: string): Promise<TranslateResult | null> {
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
    "openai/gpt-3.5-turbo";
  const label = TARGET_LANG_LABEL[targetLang] ?? targetLang;
  try {
    const out = await callOpenRouter(
      [
        {
          role: "system",
          content:
            "You translate instant-messaging text. Reply with ONLY the translated text: no quotes, no markdown, no explanation.",
        },
        {
          role: "user",
          content: `Translate into ${label} (language code ${targetLang}).\n\n${text}`,
        },
      ],
      {
        model,
        maxTokens: Math.min(1024, Math.ceil(text.length / 2) + 128),
        temperature: 0.2,
      },
    );
    const trimmed = out.trim().replace(/^["']|["']$/g, "");
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
): Promise<TranslateResult | null> {
  return callOpenRouterTranslate(text, targetLang);
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
): Promise<TranslateResult | null> {
  if (messageId) {
    const cached = getCachedTranslation(messageId, targetLang);
    if (cached) return cached;
  }

  if (messageId && process.env.DATABASE_URL) {
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

  const result = await callProvider(text, targetLang, sourceLang);
  if (!result) return null;

  if (messageId) {
    setCachedTranslation(messageId, targetLang, result);
    if (process.env.DATABASE_URL) {
      try {
        const { getDb } = await import("../db");
        const { messageTranslations } = await import("@shared/schema");
        const db = getDb();
        await db.insert(messageTranslations).values({
          messageId,
          targetLang,
          translatedText: result.translatedText,
          detectedLang: result.detectedLang,
        }).onConflictDoNothing();
      } catch {}
    }
  }

  return result;
}
