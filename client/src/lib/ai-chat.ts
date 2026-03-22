import { API, apiFetch } from "@/lib/api-base";

/** Вложение ответа «поиск по перепискам» (сервер `server/ai-chat/memory-search.ts`). */
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

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  payload?: AiMemorySearchPayloadV1 | null;
};

export async function getAiMessages(opts?: { limit?: number; before?: string }): Promise<AiChatMessage[]> {
  const limit = opts?.limit ?? 20;
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.before) params.set("before", opts.before);
  const res = await apiFetch(`${API}/ai-chat/messages?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить историю");
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => normalizeAiMessage(row));
}

export type SendAiMessageResult = {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
};

function normalizeAiMessage(row: Record<string, unknown>): AiChatMessage {
  return {
    id: String(row.id ?? ""),
    role: row.role === "user" || row.role === "assistant" ? row.role : "assistant",
    content: typeof row.content === "string" ? row.content : "",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    payload:
      row.payload && typeof row.payload === "object" && (row.payload as { v?: unknown }).v === 1
        ? (row.payload as AiMemorySearchPayloadV1)
        : (row.payload === null ? null : undefined),
  };
}

export async function sendAiMessage(content: string): Promise<SendAiMessageResult> {
  const res = await apiFetch(`${API}/ai-chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Ошибка при обращении к ИИ");
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const userRow = raw.userMessage as Record<string, unknown> | undefined;
  const asstRow = raw.assistantMessage as Record<string, unknown> | undefined;
  if (!userRow || !asstRow) throw new Error("Некорректный ответ сервера");
  return {
    userMessage: normalizeAiMessage(userRow),
    assistantMessage: normalizeAiMessage(asstRow),
  };
}

export async function proofreadText(content: string): Promise<string> {
  const res = await apiFetch(`${API}/ai-chat/proofread`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Ошибка проверки текста");
  }
  const data = (await res.json().catch(() => ({}))) as { text?: string };
  return typeof data.text === "string" && data.text.trim().length > 0 ? data.text : content;
}
