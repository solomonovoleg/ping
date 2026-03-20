function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function isServerAsrEnabled(): boolean {
  return truthy(process.env.GROUP_CALLS_SERVER_ASR_ENABLED) && !!process.env.CALL_TRANSCRIPTS_ASR_URL?.trim();
}

export async function transcribeAudioChunk(params: {
  audioBase64: string;
  mimeType: string;
  language: string;
  callId: string;
  speakerUserId: string;
}): Promise<{ text: string; confidence: number } | null> {
  const url = process.env.CALL_TRANSCRIPTS_ASR_URL?.trim();
  if (!url) return null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.CALL_TRANSCRIPTS_ASR_API_KEY?.trim()) {
    headers.Authorization = `Bearer ${process.env.CALL_TRANSCRIPTS_ASR_API_KEY.trim()}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      audioBase64: params.audioBase64,
      mimeType: params.mimeType,
      language: params.language,
      callId: params.callId,
      speakerUserId: params.speakerUserId,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { text?: string; confidence?: number };
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) return null;
  return {
    text,
    confidence: typeof data.confidence === "number" ? data.confidence : 82,
  };
}
