import crypto from "node:crypto";

export type {
  HubPingPlatformMessageCreatedPayload,
  HubPingPlatformMessageDeletedPayload,
  HubPingPlatformMessageUpdatedPayload,
  HubPingPlatformPayloadBase,
  HubPingPlatformReactionsPayload,
  HubPingPlatformTranscriptPayload,
  HubRealtimeChannel,
  HubRealtimeEnvelope,
  HubRealtimeEvent,
} from "./realtime-types.js";
export { isPingPlatformBridgePayload } from "./realtime-types.js";

export type ApiHubClientOptions = {
  baseUrl: string;
  partnerApiKey: string;
  accessToken?: string;
};

export type SendMessagePayload = {
  kind?: "text" | "image" | "voice_note" | "video_note";
  text?: string;
  media?: {
    mediaId: string;
    url: string;
    durationMs?: number;
    waveform?: number[];
    posterUrl?: string;
  };
};

export class ApiHubClient {
  private readonly baseUrl: string;
  private readonly partnerApiKey: string;
  private accessToken?: string;

  constructor(options: ApiHubClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.partnerApiKey = options.partnerApiKey;
    this.accessToken = options.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request(path: string, init?: RequestInit): Promise<any> {
    const headers = new Headers(init?.headers);
    headers.set("x-partner-api-key", this.partnerApiKey);
    headers.set("content-type", "application/json");
    if (this.accessToken) headers.set("authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error?.message ?? "API request failed");
    }
    return json;
  }

  startOAuth(input?: { pingUserId?: string; externalUserId?: string }) {
    const query = new URLSearchParams();
    if (input?.pingUserId) query.set("pingUserId", input.pingUserId);
    if (input?.externalUserId) query.set("externalUserId", input.externalUserId);
    return this.request(`/v1/auth/ping/start?${query.toString()}`, { method: "GET" });
  }

  /** Для OIDC передайте `state` из ответа `startOAuth`. */
  completeOAuth(code: string, state?: string) {
    const q = new URLSearchParams();
    q.set("code", code);
    if (state) q.set("state", state);
    return this.request(`/v1/auth/ping/callback?${q.toString()}`, { method: "GET" });
  }

  refresh() {
    return this.request("/v1/auth/refresh", { method: "POST", body: "{}" });
  }

  logout() {
    return this.request("/v1/auth/logout", { method: "POST", body: "{}" });
  }

  me() {
    return this.request("/v1/me", { method: "GET" });
  }

  contacts() {
    return this.request("/v1/contacts", { method: "GET" });
  }

  /** Только при сессии с платформой (`pm.*`); см. scope `chat.write`. */
  addContact(contactUserId: string) {
    return this.request("/v1/contacts", {
      method: "POST",
      body: JSON.stringify({ contactUserId }),
    });
  }

  /**
   * Multipart загрузка в чат PING (`POST /api/upload/chat-media`). Не задаёт JSON Content-Type.
   * Вернёт `url` (часто относительный) и `pingPlatformOrigin` для сборки абсолютной ссылки.
   */
  async uploadPlatformChatMedia(file: Blob, fileName: string): Promise<{
    ok: boolean;
    source?: string;
    url?: string;
    posterUrl?: string;
    pingPlatformOrigin?: string;
  }> {
    const form = new FormData();
    form.append("file", file, fileName);
    const headers = new Headers();
    headers.set("x-partner-api-key", this.partnerApiKey);
    if (this.accessToken) headers.set("authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}/v1/platform/chat-media`, {
      method: "POST",
      headers,
      body: form,
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(
        (json?.error as { message?: string } | undefined)?.message ?? "uploadPlatformChatMedia failed"
      );
    }
    return json as {
      ok: boolean;
      source?: string;
      url?: string;
      posterUrl?: string;
      pingPlatformOrigin?: string;
    };
  }

  chats() {
    return this.request("/v1/chats", { method: "GET" });
  }

  messages(chatId: string) {
    return this.request(`/v1/chats/${encodeURIComponent(chatId)}/messages`, { method: "GET" });
  }

  sendMessage(chatId: string, payload: SendMessagePayload, idempotencyKey?: string) {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers["idempotency-key"] = idempotencyKey;
    }
    return this.request(`/v1/chats/${encodeURIComponent(chatId)}/messages:send`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  /** `chatId` обязателен, если сессия проксирует на платформу (Bearer `pm.*`). */
  addReaction(messageId: string, emoji: string, chatId?: string) {
    return this.request(`/v1/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: "POST",
      body: JSON.stringify(chatId ? { emoji, chatId } : { emoji }),
    });
  }

  /** Для `read` на платформе передайте `chatId` (как у реакций). */
  updateStatus(messageId: string, status: "delivered" | "read", chatId?: string) {
    return this.request(`/v1/messages/${encodeURIComponent(messageId)}/status`, {
      method: "POST",
      body: JSON.stringify(chatId ? { status, chatId } : { status }),
    });
  }

  updatePresence(state: "online" | "offline") {
    return this.request("/v1/presence", {
      method: "POST",
      body: JSON.stringify({ state }),
    });
  }

  async createRealtimeSocket(): Promise<WebSocket> {
    const tokenResult = await this.request("/v1/realtime/token", { method: "GET" });
    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    return new WebSocket(`${wsUrl}/v1/realtime?token=${encodeURIComponent(tokenResult.token)}`);
  }
}

const replayWindow = new Set<string>();

export function verifyWebhookSignature(input: {
  body: string;
  secret: string;
  timestamp: string;
  signature: string;
  maxAgeMs?: number;
}): boolean {
  const now = Date.now();
  const ts = Number(input.timestamp);
  const maxAge = input.maxAgeMs ?? 5 * 60 * 1000;
  if (Number.isNaN(ts)) return false;
  if (Math.abs(now - ts) > maxAge) return false;
  const replayKey = `${input.timestamp}:${input.signature}`;
  if (replayWindow.has(replayKey)) return false;
  const raw = `${input.timestamp}.${input.body}`;
  const computed = crypto.createHmac("sha256", input.secret).update(raw).digest("hex");
  if (computed !== input.signature) return false;
  replayWindow.add(replayKey);
  setTimeout(() => replayWindow.delete(replayKey), maxAge);
  return true;
}
