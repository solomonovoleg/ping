export function normalizeOutgoingMessageContent(content: string): string {
  return content.trim();
}

/** Пустая строка после trim → `null` в БД. */
export function normalizeMessageTranscriptForStorage(transcript: string): string | null {
  const t = transcript.trim();
  return t.length > 0 ? t : null;
}
