import { API, apiFetch } from "@/lib/api-base";

export type CallHistoryItem = {
  id: string;
  chatId: string;
  mediaType: "audio" | "video";
  createdByUserId: string;
  createdAt: string;
  endedAt: string | null;
  participantCount: number;
  chatName: string;
};

export type CallTranscriptSegmentDto = {
  id: string;
  callId: string;
  speakerUserId: string;
  speakerDisplayName: string;
  sourceStreamId: string | null;
  language: string;
  textRaw: string;
  textNormalized: string;
  confidence: number;
  startedAtMs: number;
  endedAtMs: number;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CallCommandSuggestionDto = {
  id: string;
  callId: string;
  segmentId: string | null;
  intentType: string;
  title: string;
  payloadJson: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
};

export async function getCallHistory(): Promise<CallHistoryItem[]> {
  const res = await apiFetch(`${API}/call-history`);
  if (!res.ok) throw new Error("Не удалось загрузить историю звонков");
  return res.json();
}

export async function getCallHistoryDetail(callId: string): Promise<{
  segments: CallTranscriptSegmentDto[];
  suggestions: CallCommandSuggestionDto[];
}> {
  const res = await apiFetch(`${API}/call-history/${encodeURIComponent(callId)}`);
  if (!res.ok) throw new Error("Не удалось загрузить детали звонка");
  return res.json();
}

export async function resolveCallSuggestion(callId: string, suggestionId: string, status: "accepted" | "dismissed"): Promise<void> {
  const res = await apiFetch(`${API}/call-history/${encodeURIComponent(callId)}/suggestions/${encodeURIComponent(suggestionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось обновить команду");
  }
}
