import type { Scope } from "./config.js";

export type DeliveryState = "sent" | "delivered" | "read";
export type PresenceState = "online" | "offline";
export type ChatChannel = "message" | "receipt" | "presence";
export type MessageKind = "text" | "image" | "voice_note" | "video_note";

export interface PartnerApp {
  id: string;
  name: string;
  apiKey: string;
  webhookUrl?: string;
  webhookSecret?: string;
  rateLimitPerMinute: number;
}

export interface UserProfile {
  pingUserId: string;
  externalUserId?: string;
  phone: string;
  name: string;
  age?: number;
  birthday?: string;
}

export interface SessionTokenPayload {
  sessionId: string;
  partnerId: string;
  pingUserId: string;
  scopes: Scope[];
}

export interface UserLink {
  partnerId: string;
  externalUserId: string;
  pingUserId: string;
}

export interface HubSession {
  id: string;
  partnerId: string;
  pingUserId: string;
  scopes: Scope[];
  encryptedRefreshToken: string;
  revokedAt?: string;
  createdAt: string;
  /** Encrypted PING access token (OIDC) for optional platform proxy calls */
  encryptedPingAccessToken?: string;
  accessExpiresAt?: string;
}

export interface Chat {
  id: string;
  participantIds: string[];
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderPingUserId: string;
  kind: MessageKind;
  text?: string;
  media?: {
    mediaId: string;
    url: string;
    durationMs?: number;
    waveform?: number[];
    posterUrl?: string;
  };
  reactions: Record<string, string[]>;
  statusByUser: Record<string, DeliveryState>;
  createdAt: string;
  idempotencyKey?: string;
}

export interface Presence {
  pingUserId: string;
  state: PresenceState;
  lastSeenAt: string;
}

export interface RealtimeEnvelope<TPayload = unknown> {
  id: string;
  partnerId: string;
  event:
    | "message.created"
    | "message.updated"
    | "message.deleted"
    | "message.reactions.updated"
    | "message.transcript.updated"
    | "message.delivered"
    | "message.read"
    | "presence.updated";
  channel: ChatChannel;
  payload: TPayload;
  emittedAt: string;
}
