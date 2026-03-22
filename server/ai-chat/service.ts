import {
  createAiMessage,
  fetchAiMessages,
  fetchUserChatCatalog,
  MAX_MESSAGES_PAGE,
  searchMessagesInChats,
} from "./repository";
import { tryGlobalMemorySearch } from "./memory-search";
import { toAiMessageDto, type AiMessageDto } from "./serializers";

import { callOpenRouter as callOpenRouterShared } from "../lib/openrouter";

const CONTEXT_MESSAGES_COUNT = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    // Keep ASCII + Cyrillic letters/digits for broad Node/TS target compatibility.
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

function looksLikeScopedSearchIntent(content: string): boolean {
  const normalized = normalizeForSearch(content);
  if (!normalized) return false;
  const hasChatWord = /\bчат(?:е|у|ом|ах)?\b/i.test(normalized);
  const hasSearchWord = /\b(ищи|поищи|найди|найти|поиск|поискать)\b/i.test(normalized);
  return hasChatWord && hasSearchWord;
}

function parseConfirmedSearch(content: string): { chatId: string; query: string } | null {
  const patterns = [
    /(?:ищи|найди|поищи)\s+в\s+([0-9a-f-]{36})\s*:\s*(.+)/i,
    /(?:ищи|найди|поищи)\s+в\s+([0-9a-f-]{36})\s+(.+)/i,
    /(?:подтверждаю|confirm)\s+([0-9a-f-]{36})\s*:\s*(.+)/i,
    /(?:подтверждаю|confirm)\s+([0-9a-f-]{36})\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (!m) continue;
    const chatId = (m[1] ?? "").trim();
    const query = (m[2] ?? "").trim();
    if (UUID_RE.test(chatId) && query.length >= 2) return { chatId, query };
  }
  return null;
}

async function buildScopedChatSearchReply(userId: string, content: string): Promise<string | null> {
  const confirmed = parseConfirmedSearch(content);
  if (confirmed) {
    const chatCatalog = await fetchUserChatCatalog(userId);
    const selected = chatCatalog.find((c) => c.chatId === confirmed.chatId);
    if (!selected) {
      return "Не могу искать в этом чате: он не найден в вашем списке. Пришлите chatId из моего списка кандидатов.";
    }
    const hits = await searchMessagesInChats(userId, [confirmed.chatId], confirmed.query, 20);
    if (hits.length === 0) {
      return `Ничего не нашёл в чате «${selected.title}» по запросу «${confirmed.query}». Уточните фразу или период.`;
    }
    const lines = hits.slice(0, 8).map((hit, index) => {
      const at = new Date(hit.createdAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${index + 1}) ${at} — ${hit.snippet}`;
    });
    return `Нашёл в чате «${selected.title}» по запросу «${confirmed.query}»:\n${lines.join("\n")}`;
  }

  const scopedRequest = parseChatHintAndQuery(content);
  if (!scopedRequest) {
    if (looksLikeScopedSearchIntent(content)) {
      return [
        "Я умею искать по вашим чатам, но мне нужен запрос и ориентир по чату.",
        "Напишите, например:",
        "• «найди <фраза> в чате с <имя>»",
        "• «поиск по чату с <имя>: <фраза>»",
      ].join("\n");
    }
    return null;
  }

  const chatCatalog = await fetchUserChatCatalog(userId);
  if (chatCatalog.length === 0) {
    return "У вас пока нет чатов для поиска.";
  }

  const hintNorm = normalizeForSearch(scopedRequest.chatHint);
  const hintTokens = new Set(tokenize(scopedRequest.chatHint));
  const ranked = chatCatalog
    .map((chat) => {
      const titleNorm = normalizeForSearch(chat.title);
      let score = 0;
      if (titleNorm.includes(hintNorm) && hintNorm.length >= 2) score += 100;
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
    .slice(0, 5);

  if (ranked.length === 0) {
    return `Не нашёл похожие чаты по «${scopedRequest.chatHint}». Уточните имя собеседника или название группы.`;
  }

  const list = ranked
    .map((row, index) => `${index + 1}) ${row.chat.title} — chatId: ${row.chat.chatId}`)
    .join("\n");
  return `Нашёл похожие чаты по «${scopedRequest.chatHint}»:\n${list}\n\nПодтвердите нужный чат командой:\n«ищи в <chatId>: ${scopedRequest.query}»`;
}

async function callOpenRouter(messages: { role: "user" | "assistant" | "system"; content: string }[]): Promise<string> {
  return callOpenRouterShared(messages);
}

function buildCapabilityHelpReply(userInput: string): string {
  const input = userInput.trim();
  const prefix = input ? `Понял запрос: «${input.slice(0, 180)}${input.length > 180 ? "..." : ""}».\n` : "";
  return [
    `${prefix}Я могу это сделать через доступный функционал, давайте уточним команду.`,
    "Что умею прямо сейчас:",
    "• искать по всем вашим чатам по смыслу (напишите: «найди сообщение про …», «где я писал про …»);",
    "• искать фразу в одном чате: «найди <фраза> в чате с <имя>»;",
    "• подбирать чат по имени и показывать найденные фрагменты с датой.",
    "• по темам, которые система накопила из переписок (малые порции, без загрузки всего архива в модель).",
    "",
    "Примеры:",
    "• «найди сообщение про покупки в субботу»",
    "• «найди договор в чате с Олег»",
  ].join("\n");
}

function needsCapabilityFallback(assistantReply: string): boolean {
  const normalized = normalizeForSearch(assistantReply);
  if (!normalized) return false;
  const refusalPatterns = [
    /\bне умею\b/i,
    /\bне могу\b/i,
    /\bнет доступа\b/i,
    /\bне имею доступа\b/i,
    /\bне могу получить доступ\b/i,
    /\bне могу искать\b/i,
  ];
  return refusalPatterns.some((p) => p.test(normalized));
}

export async function listAiMessages(
  userId: string,
  limit: number,
  beforeId: string | null,
): Promise<AiMessageDto[]> {
  const rows = await fetchAiMessages(userId, limit, beforeId);
  return rows.map(toAiMessageDto);
}

export async function proofreadText(content: string): Promise<string> {
  const checked = await callOpenRouter([
    {
      role: "system",
      content:
        "Ты языковой редактор русского текста. Исправь только орфографию, пунктуацию и явные опечатки. " +
        "Не меняй стиль, смысл, структуру, эмодзи и markdown-разметку (#, ##, ###). " +
        "Верни только исправленный текст, без комментариев.",
    },
    { role: "user", content },
  ]);
  return (checked || content).trim() || content;
}

export type SendAiMessageResult = {
  userMessage: AiMessageDto;
  assistantMessage: AiMessageDto;
};

export async function sendAiMessage(userId: string, content: string): Promise<SendAiMessageResult> {
  const userMsg = await createAiMessage(userId, "user", content);

  const scopedSearchReply = await buildScopedChatSearchReply(userId, content);
  if (scopedSearchReply) {
    const assistantMsg = await createAiMessage(userId, "assistant", scopedSearchReply);
    return {
      userMessage: { id: userMsg.id, role: "user", content, createdAt: userMsg.createdAt },
      assistantMessage: {
        id: assistantMsg.id,
        role: "assistant",
        content: scopedSearchReply,
        createdAt: assistantMsg.createdAt,
        payload: null,
      },
    };
  }

  const memorySearch = await tryGlobalMemorySearch(userId, content);
  if (memorySearch) {
    const assistantMsg = await createAiMessage(
      userId,
      "assistant",
      memorySearch.summary,
      memorySearch.payload,
    );
    return {
      userMessage: { id: userMsg.id, role: "user", content, createdAt: userMsg.createdAt },
      assistantMessage: {
        id: assistantMsg.id,
        role: "assistant",
        content: memorySearch.summary,
        createdAt: assistantMsg.createdAt,
        payload: memorySearch.payload,
      },
    };
  }

  const assistantContent = await (async () => {
    const recent = await fetchAiMessages(userId, CONTEXT_MESSAGES_COUNT, null);
    const openRouterMessages: { role: "user" | "assistant" | "system"; content: string }[] = [
      {
        role: "system",
        content:
          "Ты AI OVER внутри PING MOOT. Никогда не отвечай в стиле «не умею/нет доступа», если запрос частично решаем. " +
          "Если не хватает точности, предложи ближайший рабочий формат команды и следующий шаг. " +
          "Для поиска по одному чату: «найди <фраза> в чате с <имя>». " +
          "Для поиска сразу по всем перепискам пользователь может написать, например: «найди сообщение про …» или «где я писал про …». " +
          "Отвечай кратко, по-русски, с практичным предложением действий.",
      },
    ];
    openRouterMessages.push(...recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    openRouterMessages.push({ role: "user" as const, content });
    const raw = await callOpenRouter(openRouterMessages);
    return needsCapabilityFallback(raw) ? buildCapabilityHelpReply(content) : raw;
  })();
  const assistantMsg = await createAiMessage(userId, "assistant", assistantContent);

  return {
    userMessage: { id: userMsg.id, role: "user", content, createdAt: userMsg.createdAt },
    assistantMessage: {
      id: assistantMsg.id,
      role: "assistant",
      content: assistantContent,
      createdAt: assistantMsg.createdAt,
      payload: null,
    },
  };
}

export { MAX_MESSAGES_PAGE };
