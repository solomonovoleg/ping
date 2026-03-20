/** Состояние «комнаты» группового звонка (клиент). Без привязки к WebRTC 1:1. */
export type GroupCallRoomPhase =
  | "idle"
  | "joining"
  | "active"
  | "leaving"
  | "error";

export type GroupCallMediaPreference = "audio" | "video";

export interface GroupCallParticipantRef {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface GroupCallRoomSnapshot {
  roomId: string | null;
  chatId: string | null;
  phase: GroupCallRoomPhase;
  mediaPreference: GroupCallMediaPreference;
  localParticipantId: string | null;
  /** Упорядоченный список для сетки UI; источник истины позже — сервер/SFU. */
  participants: GroupCallParticipantRef[];
  errorMessage: string | null;
  updatedAt: number;
}
