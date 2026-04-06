import { previewTrackMessageListContent } from "./db-storage-track-message-preview";

export type TrackListMessageRow = {
  id: string;
  messageId: string;
  chatId: string;
  content: string;
  type: string;
  messageCreatedAt: Date;
  addedAt: Date;
  doneAt: Date | null;
};

export type TrackListCallSegmentRow = {
  id: string;
  callId: string;
  speakerDisplayName: string | null;
  content: string;
  createdAt: Date;
  addedAt: Date;
  doneAt: Date | null;
  chatId: string;
};

export type TrackListItemRow = {
  id: string;
  sourceType: "message" | "call_segment";
  messageId: string | null;
  chatId: string | null;
  callId: string | null;
  chatName: string;
  speakerDisplayName: string | null;
  content: string;
  type: string;
  messageCreatedAt: Date;
  addedAt: Date;
  doneAt: Date | null;
};

export function mapTrackListMessageItem(r: TrackListMessageRow, chatName: string): TrackListItemRow {
  return {
    id: r.id,
    sourceType: "message",
    messageId: r.messageId,
    chatId: r.chatId,
    callId: null,
    chatName: chatName || "Чат",
    speakerDisplayName: null,
    content: previewTrackMessageListContent(r.type, r.content),
    type: r.type,
    messageCreatedAt: r.messageCreatedAt,
    addedAt: r.addedAt,
    doneAt: r.doneAt,
  };
}

export function mapTrackListCallSegmentItem(r: TrackListCallSegmentRow, chatBaseName: string): TrackListItemRow {
  return {
    id: r.id,
    sourceType: "call_segment",
    messageId: null,
    chatId: null,
    callId: r.callId,
    chatName: `Созвон · ${chatBaseName || "Чат"}`,
    speakerDisplayName: r.speakerDisplayName,
    content: r.content,
    type: "call_segment",
    messageCreatedAt: r.createdAt,
    addedAt: r.addedAt,
    doneAt: r.doneAt,
  };
}

export function mergeTrackListItemsSorted(messageItems: TrackListItemRow[], segmentItems: TrackListItemRow[]): TrackListItemRow[] {
  return [...messageItems, ...segmentItems].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
}
