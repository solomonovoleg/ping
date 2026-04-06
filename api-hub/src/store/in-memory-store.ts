import { createId } from "../lib/ids.js";
import type {
  Chat,
  ChatMessage,
  DeliveryState,
  HubSession,
  PartnerApp,
  Presence,
  UserLink,
  UserProfile,
} from "../types.js";
import type { Scope } from "../config.js";

type MediaRecord = {
  id: string;
  partnerId: string;
  ownerPingUserId: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  status: "pending" | "ready";
  createdAt: string;
};

export class InMemoryStore {
  readonly partners = new Map<string, PartnerApp>();
  readonly sessions = new Map<string, HubSession>();
  readonly links = new Map<string, UserLink>();
  readonly profiles = new Map<string, UserProfile>();
  readonly chats = new Map<string, Chat>();
  readonly messages = new Map<string, ChatMessage[]>();
  readonly presence = new Map<string, Presence>();
  readonly idempotency = new Map<string, string>();
  readonly media = new Map<string, MediaRecord>();
  readonly receipts = new Map<string, { deliveredAt?: string; readAt?: string }>();
  readonly auditLog: Array<Record<string, unknown>> = [];

  constructor() {
    const partner: PartnerApp = {
      id: "partner_demo",
      name: "Demo Partner",
      apiKey: "partner_demo_key",
      webhookSecret: "partner_webhook_secret",
      rateLimitPerMinute: 600,
    };
    this.partners.set(partner.id, partner);

    this.profiles.set("ping_u_alex", {
      pingUserId: "ping_u_alex",
      phone: "+79990000001",
      name: "Alex",
      age: 26,
      birthday: "1999-03-10",
    });
    this.profiles.set("ping_u_olga", {
      pingUserId: "ping_u_olga",
      phone: "+79990000002",
      name: "Olga",
      age: 24,
      birthday: "2001-08-20",
    });

    const chat: Chat = {
      id: "chat_demo_1",
      participantIds: ["ping_u_alex", "ping_u_olga"],
      updatedAt: new Date().toISOString(),
    };
    this.chats.set(chat.id, chat);
    this.messages.set(chat.id, []);
  }

  createSession(input: {
    partnerId: string;
    pingUserId: string;
    scopes: Scope[];
    encryptedRefreshToken: string;
    encryptedPingAccessToken?: string;
    accessExpiresAt?: string;
  }): HubSession {
    const session: HubSession = {
      id: createId("sess"),
      partnerId: input.partnerId,
      pingUserId: input.pingUserId,
      scopes: input.scopes,
      encryptedRefreshToken: input.encryptedRefreshToken,
      createdAt: new Date().toISOString(),
      encryptedPingAccessToken: input.encryptedPingAccessToken,
      accessExpiresAt: input.accessExpiresAt,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  revokeSession(sessionId: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) return;
    existing.revokedAt = new Date().toISOString();
    this.sessions.set(sessionId, existing);
  }

  getProfile(pingUserId: string): UserProfile | undefined {
    return this.profiles.get(pingUserId);
  }

  addOrUpdateLink(link: UserLink): void {
    this.links.set(`${link.partnerId}:${link.externalUserId}`, link);
  }

  listContacts(forUserId: string): UserProfile[] {
    const contacts: UserProfile[] = [];
    for (const chat of this.chats.values()) {
      if (!chat.participantIds.includes(forUserId)) continue;
      for (const participantId of chat.participantIds) {
        if (participantId === forUserId) continue;
        const profile = this.profiles.get(participantId);
        if (profile) contacts.push(profile);
      }
    }
    return contacts;
  }

  listChats(forUserId: string): Chat[] {
    return Array.from(this.chats.values()).filter((chat) => chat.participantIds.includes(forUserId));
  }

  listMessages(chatId: string): ChatMessage[] {
    return this.messages.get(chatId) ?? [];
  }

  createMessage(input: {
    chatId: string;
    senderPingUserId: string;
    kind: ChatMessage["kind"];
    text?: string;
    media?: ChatMessage["media"];
    idempotencyKey?: string;
  }): ChatMessage {
    if (input.idempotencyKey) {
      const existing = this.idempotency.get(input.idempotencyKey);
      if (existing) {
        const previous = this.findMessage(existing);
        if (previous) return previous;
      }
    }
    const chatMessages = this.messages.get(input.chatId) ?? [];
    const message: ChatMessage = {
      id: createId("msg"),
      chatId: input.chatId,
      senderPingUserId: input.senderPingUserId,
      kind: input.kind,
      text: input.text,
      media: input.media,
      reactions: {},
      statusByUser: {},
      createdAt: new Date().toISOString(),
      idempotencyKey: input.idempotencyKey,
    };

    const chat = this.chats.get(input.chatId);
    if (chat) {
      for (const userId of chat.participantIds) {
        message.statusByUser[userId] = userId === input.senderPingUserId ? "read" : "sent";
      }
    }

    chatMessages.push(message);
    this.messages.set(input.chatId, chatMessages);
    if (chat) {
      chat.updatedAt = message.createdAt;
      this.chats.set(chat.id, chat);
    }
    if (input.idempotencyKey) {
      this.idempotency.set(input.idempotencyKey, message.id);
    }
    return message;
  }

  findMessage(messageId: string): ChatMessage | undefined {
    for (const list of this.messages.values()) {
      const found = list.find((item) => item.id === messageId);
      if (found) return found;
    }
    return undefined;
  }

  addReaction(messageId: string, emoji: string, actorPingUserId: string): ChatMessage | undefined {
    const message = this.findMessage(messageId);
    if (!message) return undefined;
    const actors = message.reactions[emoji] ?? [];
    if (!actors.includes(actorPingUserId)) {
      actors.push(actorPingUserId);
      message.reactions[emoji] = actors;
    }
    return message;
  }

  setDeliveryStatus(
    messageId: string,
    actorPingUserId: string,
    status: DeliveryState,
  ): ChatMessage | undefined {
    const message = this.findMessage(messageId);
    if (!message) return undefined;
    message.statusByUser[actorPingUserId] = status;
    const current = this.receipts.get(messageId) ?? {};
    if (status === "delivered") current.deliveredAt = new Date().toISOString();
    if (status === "read") current.readAt = new Date().toISOString();
    this.receipts.set(messageId, current);
    return message;
  }

  setPresence(pingUserId: string, state: Presence["state"]): Presence {
    const presence: Presence = {
      pingUserId,
      state,
      lastSeenAt: new Date().toISOString(),
    };
    this.presence.set(pingUserId, presence);
    return presence;
  }

  getPresence(pingUserId: string): Presence {
    return (
      this.presence.get(pingUserId) ?? {
        pingUserId,
        state: "offline",
        lastSeenAt: new Date(0).toISOString(),
      }
    );
  }

  addAudit(event: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      id: createId("audit"),
      event,
      details,
      createdAt: new Date().toISOString(),
    });
  }

  createMedia(input: {
    partnerId: string;
    ownerPingUserId: string;
    contentType: string;
    sizeBytes: number;
    storagePath: string;
  }): MediaRecord {
    const media: MediaRecord = {
      id: createId("media"),
      partnerId: input.partnerId,
      ownerPingUserId: input.ownerPingUserId,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.media.set(media.id, media);
    return media;
  }

  markMediaReady(mediaId: string): MediaRecord | undefined {
    const media = this.media.get(mediaId);
    if (!media) return undefined;
    media.status = "ready";
    this.media.set(mediaId, media);
    return media;
  }

  getMedia(mediaId: string): MediaRecord | undefined {
    return this.media.get(mediaId);
  }

  mediaBytesForPartner(partnerId: string): number {
    let total = 0;
    for (const media of this.media.values()) {
      if (media.partnerId === partnerId && media.status === "ready") {
        total += media.sizeBytes;
      }
    }
    return total;
  }

  cleanupMediaBefore(olderThanIso: string): string[] {
    const deleted: string[] = [];
    for (const [id, media] of this.media.entries()) {
      if (media.createdAt < olderThanIso) {
        this.media.delete(id);
        deleted.push(media.storagePath);
      }
    }
    return deleted;
  }
}

export const store = new InMemoryStore();
