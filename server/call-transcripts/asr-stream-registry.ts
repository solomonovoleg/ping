import { AsrStreamSession } from "./asr-stream-session";

const sessions = new Map<string, AsrStreamSession>();

function key(callId: string, userId: string): string {
  return `${callId}:${userId}`;
}

export function pushStreamingAsrChunk(params: {
  callId: string;
  userId: string;
  language: string;
  audioBase64: string;
  onTranscript: (event: { segmentId: string; isFinal: boolean; text: string; confidence: number }) => void;
}): void {
  const k = key(params.callId, params.userId);
  let session = sessions.get(k);
  if (!session) {
    session = new AsrStreamSession(params.language, params.onTranscript);
    sessions.set(k, session);
  }
  session.pushPcmChunk(params.audioBase64);
}

export function closeStreamingAsrSession(callId: string, userId: string): void {
  const k = key(callId, userId);
  const session = sessions.get(k);
  if (!session) return;
  session.close();
  sessions.delete(k);
}

export function closeStreamingAsrRoom(callId: string): void {
  const prefix = `${callId}:`;
  Array.from(sessions.keys()).forEach((k) => {
    if (!k.startsWith(prefix)) return;
    sessions.get(k)?.close();
    sessions.delete(k);
  });
}
