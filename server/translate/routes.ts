/**
 * Translation endpoints:
 * - POST /api/translate — translate text (with DB caching)
 * - GET  /api/chats/:chatId/translate-prefs — get user's translate prefs for a chat
 * - PUT  /api/chats/:chatId/translate-prefs — set translate prefs
 * - GET  /api/chats/:chatId/translations — bulk-fetch cached translations for messages
 */
import type { Express } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { translate, getPref, setCachedPref, type TranslatePref } from "./provider";

const MAX_TEXT_LENGTH = 5000;

export function registerTranslateRoutes(app: Express): void {
  app.post("/api/translate", async (req, res) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const targetLang = typeof req.body?.targetLang === "string" ? req.body.targetLang : "ru";
      const sourceLang = typeof req.body?.sourceLang === "string" ? req.body.sourceLang : undefined;
      const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : undefined;

      if (!text || text.length < 1) {
        return res.json({ translatedText: null, detectedLang: null });
      }

      const truncated = text.slice(0, MAX_TEXT_LENGTH);
      const result = await translate(truncated, targetLang, messageId, sourceLang);

      if (!result) {
        return res.json({ translatedText: null, detectedLang: null });
      }

      res.json({ translatedText: result.translatedText, detectedLang: result.detectedLang });
    } catch {
      res.json({ translatedText: null, detectedLang: null });
    }
  });

  // --- Per-chat translate preferences ---

  app.get("/api/chats/:chatId/translate-prefs", requireAuth, async (req, res) => {
    const userId = getUserId(req)!;
    const chatId = req.params.chatId as string;

    const pref = await getPref(userId, chatId);
    if (pref) return res.json(pref);

    res.json({ enabled: false, targetLang: "ru" });
  });

  app.put("/api/chats/:chatId/translate-prefs", requireAuth, async (req, res) => {
    const userId = getUserId(req)!;
    const chatId = req.params.chatId as string;
    const enabled = req.body?.enabled === true;
    const targetLang = typeof req.body?.targetLang === "string" ? req.body.targetLang : "ru";
    const pref: TranslatePref = { enabled, targetLang };

    setCachedPref(userId, chatId, pref);

    if (process.env.DATABASE_URL) {
      try {
        const { getDb } = await import("../db");
        const { chatTranslatePrefs } = await import("@shared/schema");
        const db = getDb();
        await db
          .insert(chatTranslatePrefs)
          .values({ userId, chatId, enabled, targetLang })
          .onConflictDoUpdate({
            target: [chatTranslatePrefs.userId, chatTranslatePrefs.chatId],
            set: { enabled, targetLang },
          });
      } catch {}
    }

    res.json(pref);
  });

  // --- Bulk fetch cached translations for a chat ---

  app.get("/api/chats/:chatId/translations", requireAuth, async (req, res) => {
    const userId = getUserId(req)!;
    const chatId = req.params.chatId as string;
    const targetLang = typeof req.query.targetLang === "string" ? req.query.targetLang : "ru";

    const pref = await getPref(userId, chatId);
    if (!pref?.enabled) return res.json({ translations: {} });

    if (!process.env.DATABASE_URL) return res.json({ translations: {} });

    try {
      const { getDb } = await import("../db");
      const { messageTranslations, messages } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = getDb();

      const rows = await db
        .select({
          messageId: messageTranslations.messageId,
          translatedText: messageTranslations.translatedText,
          detectedLang: messageTranslations.detectedLang,
        })
        .from(messageTranslations)
        .innerJoin(messages, eq(messages.id, messageTranslations.messageId))
        .where(
          and(
            eq(messages.chatId, chatId),
            eq(messageTranslations.targetLang, targetLang),
          ),
        )
        .limit(500);

      const map: Record<string, { translatedText: string; detectedLang: string | null }> = {};
      for (const r of rows) {
        map[r.messageId] = { translatedText: r.translatedText, detectedLang: r.detectedLang };
      }
      res.json({ translations: map });
    } catch {
      res.json({ translations: {} });
    }
  });
}
