import { callOpenRouter, isOpenRouterConfigured } from "../lib/openrouter";
import {
  fetchUserChatCatalog,
  searchMessagesAcrossChatsByTags,
  type ChatCatalogItem,
  type TagSearchHit,
} from "./repository";

/** Ответ ассистента с вложенным UI: теги + лучшее совпадение + переход в чат. */
export type AiMemorySearchPayloadV1 = {
  v: 1;
  tags: string[];
  bestMatch: {
    messageId: string;
    chatId: string;
    chatTitle: string;
    excerpt: string;
    createdAt: string;
  } | null;
  alternatives?: Array<{
    messageId: string;
    chatId: string;
    chatTitle: string;
    excerpt: string;
    createdAt: string;
  }>;
};

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForSearch(text)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Копия условий из service.ts — чтобы не импортировать service (цикл). */
function parseChatHintAndQuery(content: string): { chatHint: string; query: string } | null {
  const patterns: Array<{ re: RegExp; queryGroup: number; hintGroup: number }> = [
    { re: /(?:найди|поищи|ищи|найти)\s+(.+?)\s+(?:в|по)\s+чате(?:\s+с)?\s+(.+)/i, queryGroup: 1, hintGroup: 2 },
    { re: /(?:в|по)\s+чате(?:\s+с)?\s+(.+?)\s+(?:найди|поищи|ищи|найти)\s+(.+)/i, queryGroup: 2, hintGroup: 1 },
    { re: /(?:поиск|поискать|найти)\s+по\s+чату(?:\s+с)?\s+(.+?)\s*[:,-]\s*(.+)/i, queryGroup: 2, hintGroup: 1 },
  ];
  for (const { re, queryGroup, hintGroup } of patterns) {
    const match = content.match(re);
    if (!match) continue;
    const query = (match[queryGroup] ?? "").trim();
    const chatHint = (match[hintGroup] ?? "").trim();
    if (query.length >= 2 && chatHint.length >= 2) return { chatHint, query };
  }
  return null;
}

export function looksLikeGlobalMemorySearchIntent(content: string): boolean {
  const q = content.trim();
  if (q.length < 14) return false;
  if (parseChatHintAndQuery(content)) return false;
  const t = content.toLowerCase();
  const findIntent =
    /(найди|найти|поищи|ищи|помоги\s+(мне\s+)?найти|помогите\s+(мне\s+)?найти)/i.test(t) ||
    /где\s+(я|мы|ты)\s+(писал|писала|писали|говорил|говорили|обсуждал|обсуждали)/i.test(t) ||
    /где\s+(же\s+)?(там\s+)?(это\s+)?сообщен/i.test(t) ||
    /поиск\s+(по\s+)?(всем\s+)?(сообщен|чат)/i.test(t) ||
    /напомни(ть)?\s+(про|где|какое)/i.test(t);
  if (!findIntent) return false;
  const memoryScope =
    /(сообщен|переписк|писал|писала|писали|говорил|обсуждал|написал|чатах|чатов|всех\s+чат|по\s+чатам|в\s+чатах|суббот|воскресен|вчера|сегодня|покупк|заказ|магазин)/i.test(
      t,
    );
  return memoryScope || q.length > 24;
}

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

type PlannerJson = {
  tags: string[];
  contactHint: string | null;
  dateFrom: string | null;
  dateTo: string | null;
};

function parsePlannerJson(raw: string): PlannerJson | null {
  try {
    const o = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const tags = Array.isArray(o.tags)
      ? o.tags.filter((x): x is string => typeof x === "string").map((s) => s.trim())
      : [];
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const tag of tags) {
      if (tag.length < 2 || tag.length > 48) continue;
      const k = tag.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(tag);
      if (uniq.length >= 15) break;
    }
    if (uniq.length < 3) return null;
    return {
      tags: uniq,
      contactHint: typeof o.contactHint === "string" && o.contactHint.trim() ? o.contactHint.trim() : null,
      dateFrom: typeof o.dateFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dateFrom) ? o.dateFrom : null,
      dateTo: typeof o.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.dateTo) ? o.dateTo : null,
    };
  } catch {
    return null;
  }
}

function rankChatsByContactHint(catalog: ChatCatalogItem[], hint: string): ChatCatalogItem[] {
  const hintNorm = normalizeForSearch(hint);
  const hintTokens = new Set(tokenize(hint));
  return catalog
    .map((chat) => {
      const titleNorm = normalizeForSearch(chat.title);
      let score = 0;
      if (hintNorm.length >= 2 && titleNorm.includes(hintNorm)) score += 100;
      hintTokens.forEach((tok) => {
        if (titleNorm.includes(tok)) score += 18;
      });
      return { chat, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(b.chat.lastActivityIso) - Date.parse(a.chat.lastActivityIso);
    })
    .map((row) => row.chat);
}

type PickerJson = {
  bestIndex: number | null;
  userText: string;
};

function parsePickerJson(raw: string): PickerJson | null {
  try {
    const o = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const userText = typeof o.userText === "string" ? o.userText.trim() : "";
    if (!userText) return null;
    const bi = o.bestIndex;
    const bestIndex =
      typeof bi === "number" && Number.isFinite(bi) ? Math.floor(bi) : bi === null ? null : null;
    return { bestIndex: bestIndex != null && bestIndex >= 1 ? bestIndex : null, userText };
  } catch {
    return null;
  }
}

function titleByChatId(catalog: ChatCatalogItem[], chatId: string): string {
  return catalog.find((c) => c.chatId === chatId)?.title ?? "Чат";
}

function hitToAlt(
  hit: TagSearchHit,
  catalog: ChatCatalogItem[],
): AiMemorySearchPayloadV1["bestMatch"] {
  return {
    messageId: hit.messageId,
    chatId: hit.chatId,
    chatTitle: titleByChatId(catalog, hit.chatId),
    excerpt: hit.snippet,
    createdAt: hit.createdAt,
  };
}

/**
 * Поиск по всем доступным чатам: теги от модели → SQL → выбор лучшего кандидата моделью.
 */
export async function tryGlobalMemorySearch(
  userId: string,
  userQuestion: string,
): Promise<{ summary: string; payload: AiMemorySearchPayloadV1 } | null> {
  if (!looksLikeGlobalMemorySearchIntent(userQuestion)) return null;

  if (!isOpenRouterConfigured()) {
    return {
      summary:
        "Поиск по вашим перепискам сейчас недоступен: на сервере не настроен OPENROUTER_API_KEY. Обратитесь к администратору.",
      payload: {
        v: 1,
        tags: [],
        bestMatch: null,
      },
    };
  }

  const plannerRaw = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "Ты помощник для поиска по истории мессенджера. По запросу пользователя верни ТОЛЬКО JSON без markdown и пояснений.\n" +
          "Схема: {\"tags\": string[], \"contactHint\": string|null, \"dateFrom\": string|null, \"dateTo\": string|null}\n" +
          "tags: 10–15 коротких поисковых тегов на русском (существительные, темы, дни недели, действия). Включай синонимы и опечатки пользователя.\n" +
          "contactHint: имя/ник собеседника или название группы, если в запросе явно указано с кем переписка; иначе null.\n" +
          "dateFrom/dateTo: границы даты в формате YYYY-MM-DD если в запросе есть конкретные даты или однозначный день; иначе null.",
      },
      { role: "user", content: userQuestion.slice(0, 2000) },
    ],
    { temperature: 0.35, maxTokens: 600 },
  );

  const plan = parsePlannerJson(plannerRaw);
  if (!plan) {
    return {
      summary:
        "Не удалось разобрать запрос для поиска по чатам. Переформулируйте: например «найди сообщение про покупки в субботу» или «где я писал про доставку».",
      payload: { v: 1, tags: [], bestMatch: null },
    };
  }

  const catalog = await fetchUserChatCatalog(userId);
  if (catalog.length === 0) {
    return {
      summary: "У вас пока нет чатов, в которых можно искать.",
      payload: { v: 1, tags: plan.tags, bestMatch: null },
    };
  }

  let chatIds: string[];
  if (plan.contactHint) {
    const ranked = rankChatsByContactHint(catalog, plan.contactHint);
    chatIds = (ranked.length ? ranked : catalog).slice(0, 12).map((c) => c.chatId);
  } else {
    chatIds = catalog.map((c) => c.chatId);
  }

  const hits = await searchMessagesAcrossChatsByTags(userId, chatIds, plan.tags, {
    dateFromIso: plan.dateFrom,
    dateToIso: plan.dateTo,
    limit: 72,
  });

  if (hits.length === 0) {
    return {
      summary:
        "По подобранным тегам в доступных чатах ничего не нашлось. Уточните дату, собеседника или другие слова из сообщения.",
      payload: {
        v: 1,
        tags: plan.tags,
        bestMatch: null,
      },
    };
  }

  const top = hits.slice(0, 14);
  const lines = top.map((h, i) => {
    const title = titleByChatId(catalog, h.chatId);
    const at = new Date(h.createdAt).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${i + 1}) [${title}] ${at} (совпадений тегов: ${h.tagHits}) — ${h.snippet}`;
  });

  const pickerRaw = await callOpenRouter(
    [
      {
        role: "system",
        content:
          "Ты выбираешь одно сообщение, которое лучше всего отвечает на вопрос пользователя о поиске в переписке.\n" +
          "Верни ТОЛЬКО JSON: {\"bestIndex\": number|null, \"userText\": string}\n" +
          "bestIndex — номер кандидата 1..N из списка, либо null если ни один не подходит.\n" +
          "userText — короткий ответ пользователю на русском (1–4 предложения): что нашлось, в каком чате, цитата по смыслу.",
      },
      {
        role: "user",
        content: `Вопрос пользователя:\n${userQuestion.slice(0, 1500)}\n\nКандидаты:\n${lines.join("\n")}`,
      },
    ],
    { temperature: 0.2, maxTokens: 700 },
  );

  const picked = parsePickerJson(pickerRaw);
  const summary =
    picked?.userText ??
    "Нашёл несколько сообщений по тегам — откройте чат по кнопке ниже или уточните запрос.";

  let best: AiMemorySearchPayloadV1["bestMatch"] = null;
  if (picked?.bestIndex != null && picked.bestIndex >= 1 && picked.bestIndex <= top.length) {
    best = hitToAlt(top[picked.bestIndex - 1]!, catalog);
  } else {
    best = hitToAlt(top[0]!, catalog);
  }

  const alternatives = top
    .filter((h) => h.messageId !== best?.messageId)
    .slice(0, 4)
    .map((h) => hitToAlt(h, catalog));

  return {
    summary,
    payload: {
      v: 1,
      tags: plan.tags,
      bestMatch: best,
      alternatives,
    },
  };
}
