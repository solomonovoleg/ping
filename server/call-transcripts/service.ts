import { storage } from "../storage";
import { detectCallIntent } from "./intents";
import { normalizeTranscriptText } from "./normalize";

const recentFinalSegmentsByCall = new Map<string, Array<{ id: string; at: number; text: string }>>();

function rememberFinalSegment(callId: string, segmentId: string, text: string): string[] {
  const now = Date.now();
  const prev = recentFinalSegmentsByCall.get(callId) ?? [];
  const fresh = prev.filter((item) => now - item.at <= 25_000 && item.id !== segmentId);
  const next = [...fresh, { id: segmentId, at: now, text }].slice(-6);
  recentFinalSegmentsByCall.set(callId, next);
  return next
    .filter((item) => item.text.trim().length >= 6)
    .map((item) => item.id);
}

export async function ensureCallHistorySession(params: {
  callId: string;
  chatId: string;
  mediaType: "audio" | "video";
  createdByUserId: string;
}): Promise<void> {
  await storage.createCallSessionHistory({
    id: params.callId,
    chatId: params.chatId,
    mediaType: params.mediaType,
    createdByUserId: params.createdByUserId,
  });
}

export async function joinCallHistoryParticipant(callId: string, userId: string, displayName: string): Promise<void> {
  await storage.upsertCallParticipantHistory(callId, userId, displayName);
}

export async function leaveCallHistoryParticipant(callId: string, userId: string): Promise<void> {
  await storage.markCallParticipantLeft(callId, userId);
}

export async function finishCallHistory(callId: string): Promise<void> {
  await storage.endCallSessionHistory(callId);
  recentFinalSegmentsByCall.delete(callId);
}

export async function upsertTranscriptSegment(params: {
  id: string;
  callId: string;
  speakerUserId: string;
  speakerDisplayName: string;
  sourceStreamId?: string | null;
  language?: string;
  text: string;
  confidence?: number;
  startedAtMs?: number;
  endedAtMs?: number;
  isFinal: boolean;
}) {
  const textNormalized = normalizeTranscriptText(params.text, params.isFinal);
  const segment = await storage.upsertCallTranscriptSegment({
    id: params.id,
    callId: params.callId,
    speakerUserId: params.speakerUserId,
    speakerDisplayName: params.speakerDisplayName,
    sourceStreamId: params.sourceStreamId,
    language: params.language ?? "ru-RU",
    textRaw: params.text,
    textNormalized,
    confidence: Math.max(0, Math.min(100, Math.round(params.confidence ?? 0))),
    startedAtMs: params.startedAtMs ?? 0,
    endedAtMs: params.endedAtMs ?? params.startedAtMs ?? 0,
    isFinal: params.isFinal,
  });
  if (!segment.isFinal) return { segment, suggestion: null };
  const segmentIds = rememberFinalSegment(params.callId, segment.id, segment.textNormalized);
  const intent = detectCallIntent(segment.textNormalized, segment.id);
  if (!intent) return { segment, suggestion: null };
  const suggestion = await storage.createCallCommandSuggestion({
    callId: params.callId,
    segmentId: segment.id,
    intentType: intent.intentType,
    title: intent.title,
    payloadJson: JSON.stringify({ ...intent.payload, segmentIds }),
  });
  return { segment, suggestion };
}

export async function getCallHistoryList(userId: string) {
  return storage.listCallSessionsHistory(userId);
}

export async function getCallHistoryDetail(userId: string, callId: string) {
  const [segments, suggestions] = await Promise.all([
    storage.listCallTranscriptSegments(userId, callId),
    storage.listCallCommandSuggestions(userId, callId),
  ]);
  return { segments, suggestions };
}

export async function resolveCallSuggestion(
  userId: string,
  callId: string,
  suggestionId: string,
  status: "accepted" | "dismissed",
): Promise<void> {
  await storage.resolveCallCommandSuggestion(userId, callId, suggestionId, status);
}
