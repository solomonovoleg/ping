import { storage } from "../storage";
import { isOpenRouterConfigured } from "../lib/openrouter";
import { extractFromDialogueChunk } from "./extract-model";
import { upsertHotSignal } from "./hot-signals";
import {
  fetchTextBatch,
  getCursor,
  getDmPeerUserId,
  setCursor,
  upsertInterest,
  upsertTag,
  type MsgRow,
} from "./repo";

function slugKey(s: string): string {
  const x = s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return x || "tema";
}

function formatBatch(userId: string, rows: MsgRow[]): string {
  return rows
    .map((m) => {
      const who = m.sender_id === userId ? "Я" : "Собеседник";
      const at = new Date(m.created_at).toISOString().slice(0, 16).replace("T", " ");
      const text = m.content.replace(/\s+/g, " ").trim().slice(0, 480);
      return `[${at}] ${who}: ${text}`;
    })
    .join("\n");
}

function maxCreatedAt(rows: MsgRow[]): Date {
  let d = new Date(0);
  for (const m of rows) {
    const t = new Date(m.created_at);
    if (t > d) d = t;
  }
  return d;
}

/**
 * Инкрементально: только новые (или последние N) текстовые сообщения → модель → таблицы тегов/интересов.
 */
export async function ingestChat(userId: string, chatId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (!isOpenRouterConfigured()) return;
  if (process.env.AI_SEARCH_ENABLED === "0") return;

  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) return;

  const cursor = await getCursor(userId, chatId);
  const batch = await fetchTextBatch(userId, chatId, cursor, 40);
  if (batch.length === 0) return;

  const transcript = formatBatch(userId, batch);
  const extracted = await extractFromDialogueChunk(transcript);

  const chat = await storage.getChatById(chatId);
  const peerUserId = chat?.type === "dm" ? await getDmPeerUserId(chatId, userId) : null;

  for (const t of extracted.tags) {
    const key = slugKey(t.key);
    await upsertTag({
      userId,
      chatId,
      tagKey: key,
      tagLabel: t.label,
      peerUserId,
      snippet: t.snippet ?? null,
    });
  }
  for (const c of extracted.commercial) {
    await upsertInterest({
      userId,
      kind: "commercial",
      labelKey: slugKey(c.key),
      labelDisplay: c.label,
      score: c.score ?? 55,
    });
  }
  for (const b of extracted.behavioral) {
    await upsertInterest({
      userId,
      kind: "behavioral",
      labelKey: slugKey(b.key),
      labelDisplay: b.label,
      score: b.score ?? 55,
    });
  }
  for (const h of extracted.hot_now) {
    await upsertHotSignal({
      userId,
      signalKey: slugKey(h.key),
      labelDisplay: h.label,
      snippet: h.snippet ?? null,
      sourceChatId: chatId,
      score: h.score ?? 78,
    });
  }

  await setCursor(userId, chatId, maxCreatedAt(batch));
}
