import { API, apiFetch } from "@/lib/api-base";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function getAiMessages(opts?: { limit?: number; before?: string }): Promise<AiChatMessage[]> {
  const limit = opts?.limit ?? 20;
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.before) params.set("before", opts.before);
  const res = await apiFetch(`${API}/ai-chat/messages?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить историю");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type SendAiMessageResult = {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
};

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
  return res.json();
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
