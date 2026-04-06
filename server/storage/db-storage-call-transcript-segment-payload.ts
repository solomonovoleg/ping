/** Вход для upsert сегмента транскрипта звонка (как в `DbStorage.upsertCallTranscriptSegment`). */
export type CallTranscriptSegmentUpsertInput = {
  id: string;
  callId: string;
  speakerUserId: string;
  speakerDisplayName: string;
  sourceStreamId?: string | null;
  language?: string;
  textRaw: string;
  textNormalized: string;
  confidence: number;
  startedAtMs: number;
  endedAtMs: number;
  isFinal: boolean;
};

export function resolveCallTranscriptSegmentLanguage(language: string | undefined): string {
  return language ?? "ru-RU";
}

export function buildCallTranscriptSegmentInsertValues(data: CallTranscriptSegmentUpsertInput, updatedAt: Date) {
  return {
    ...data,
    sourceStreamId: data.sourceStreamId ?? null,
    language: resolveCallTranscriptSegmentLanguage(data.language),
    updatedAt,
  };
}

export function buildCallTranscriptSegmentConflictUpdate(data: CallTranscriptSegmentUpsertInput, updatedAt: Date) {
  return {
    speakerDisplayName: data.speakerDisplayName,
    sourceStreamId: data.sourceStreamId ?? null,
    language: resolveCallTranscriptSegmentLanguage(data.language),
    textRaw: data.textRaw,
    textNormalized: data.textNormalized,
    confidence: data.confidence,
    startedAtMs: data.startedAtMs,
    endedAtMs: data.endedAtMs,
    isFinal: data.isFinal,
    updatedAt,
  };
}
