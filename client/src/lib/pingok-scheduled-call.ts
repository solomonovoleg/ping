import { API, apiFetch } from "@/lib/api-base";

export type PingokScheduledCallActive = {
  id: string;
  fireAt: string;
  title: string;
  createdByUserId: string;
  peerUserId: string;
  iAmInitiator: boolean;
};

export async function fetchPingokScheduledCall(chatId: string): Promise<PingokScheduledCallActive | null> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/pingok-scheduled-call`, {
    suppressSessionExpireOn401: true,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { active: PingokScheduledCallActive | null };
  return data.active ?? null;
}

export async function dismissPingokScheduledCall(
  chatId: string,
  callId: string,
  forBoth: boolean,
): Promise<boolean> {
  const res = await apiFetch(
    `${API}/chats/${encodeURIComponent(chatId)}/pingok-scheduled-call/${encodeURIComponent(callId)}/dismiss`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forBoth }),
    },
  );
  return res.ok;
}
