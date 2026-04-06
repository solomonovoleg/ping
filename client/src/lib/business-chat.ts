import { API, apiFetch } from "@/lib/api-base";

export type BusinessWidgetItem = {
  id: string;
  chatId: string;
  name: string;
  providerType: string;
  endpointUrl: string;
  status: string;
  updatedAt: string;
  lastAutoconfigAt: string | null;
};

export type BusinessActionItem = {
  id: string;
  label: string;
  kind: "button" | "form" | "file_upload";
  inputSchema?: Record<string, unknown> | null;
};

export async function listBusinessWidgets(): Promise<BusinessWidgetItem[]> {
  const res = await apiFetch(`${API}/business-chat/widgets`);
  if (!res.ok) throw new Error("Не удалось загрузить BUSINESS виджеты");
  const data = await res.json();
  return Array.isArray(data) ? (data as BusinessWidgetItem[]) : [];
}

export async function autoConnectBusinessWidget(input: {
  name: string;
  endpointUrl: string;
  apiKey: string;
  providerType?: string;
  contractUrl?: string | null;
}): Promise<{ widgetId: string; chatId: string; chatType: "business"; name: string; actions: BusinessActionItem[] }> {
  const res = await apiFetch(`${API}/business-chat/widgets/autoconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось подключить BUSINESS чат");
  }
  return res.json();
}

export async function listBusinessActionsByChat(chatId: string): Promise<BusinessActionItem[]> {
  const res = await apiFetch(`${API}/business-chat/chats/${encodeURIComponent(chatId)}/actions`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as BusinessActionItem[]) : [];
}

export async function invokeBusinessAction(chatId: string, actionId: string, input?: Record<string, unknown>): Promise<void> {
  const res = await apiFetch(
    `${API}/business-chat/chats/${encodeURIComponent(chatId)}/actions/${encodeURIComponent(actionId)}/invoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось выполнить команду");
  }
}
