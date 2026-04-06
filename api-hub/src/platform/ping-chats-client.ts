import { config } from "../config.js";

export class PlatformProxyError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown = undefined) {
    super(message);
    this.name = "PlatformProxyError";
    this.status = status;
    this.payload = payload;
  }
}

function platformOrigin(): string | null {
  const raw = config.platformBaseUrl?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

async function platformFetch(
  bearer: string,
  pathWithQuery: string,
  init?: RequestInit,
): Promise<Response> {
  const origin = platformOrigin();
  if (!origin) {
    throw new PlatformProxyError(503, "platform_not_configured");
  }
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${bearer}`);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  let res: Response;
  try {
    res = await fetch(`${origin}${pathWithQuery}`, { ...init, headers });
  } catch (e) {
    throw new PlatformProxyError(502, e instanceof Error ? e.message : "fetch_failed");
  }
  return res;
}

async function parseJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function throwIfNotOk(res: Response, body: unknown): void {
  if (res.ok) return;
  const msg =
    body && typeof body === "object" && body !== null && "message" in body
      ? String((body as { message?: unknown }).message)
      : res.statusText;
  throw new PlatformProxyError(res.status, msg || `HTTP ${res.status}`, body);
}

/** `GET /api/chats` — как в приложении (массив чатов). */
export async function proxyPlatformListChats(bearer: string): Promise<unknown> {
  const res = await platformFetch(bearer, "/api/chats", { method: "GET" });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `GET /api/chats/:chatId/messages` */
export async function proxyPlatformListMessages(
  bearer: string,
  chatId: string,
  query: { limit?: number; before?: string },
): Promise<unknown> {
  const q = new URLSearchParams();
  if (query.limit != null && Number.isFinite(query.limit)) {
    q.set("limit", String(Math.min(200, Math.max(1, Math.floor(query.limit)))));
  }
  if (query.before?.trim()) q.set("before", query.before.trim());
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const path = `/api/chats/${encodeURIComponent(chatId)}/messages${suffix}`;
  const res = await platformFetch(bearer, path, { method: "GET" });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `POST /api/chats/:chatId/messages` */
export async function proxyPlatformSendMessage(
  bearer: string,
  chatId: string,
  payload: { content: string; type?: string },
): Promise<unknown> {
  const res = await platformFetch(bearer, `/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: payload.content,
      type: payload.type ?? "text",
    }),
  });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `POST /api/chats/:chatId/messages/:messageId/reactions` */
export async function proxyPlatformAddReaction(
  bearer: string,
  chatId: string,
  messageId: string,
  emoji: string,
): Promise<unknown> {
  const res = await platformFetch(
    bearer,
    `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji }),
    },
  );
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `PUT /api/chats/:chatId/read` */
export async function proxyPlatformMarkRead(
  bearer: string,
  chatId: string,
  messageId?: string,
): Promise<unknown> {
  const res = await platformFetch(bearer, `/api/chats/${encodeURIComponent(chatId)}/read`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messageId ? { messageId } : {}),
  });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `GET /api/contacts?list=1` — карточки контактов как в приложении. */
export async function proxyPlatformListContacts(bearer: string): Promise<unknown> {
  const res = await platformFetch(bearer, "/api/contacts?list=1", { method: "GET" });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `POST /api/contacts` — добавить пользователя в контакты. */
export async function proxyPlatformAddContact(bearer: string, contactUserId: string): Promise<unknown> {
  const res = await platformFetch(bearer, "/api/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contactUserId }),
  });
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}

/** `POST /api/upload/chat-media` — фото/видео для чата (поле `file`, как в приложении). */
export async function proxyPlatformUploadChatMedia(
  bearer: string,
  file: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<unknown> {
  const origin = platformOrigin();
  if (!origin) {
    throw new PlatformProxyError(503, "platform_not_configured");
  }
  const form = new FormData();
  const blob = new Blob([new Uint8Array(file.buffer)], {
    type: file.mimetype || "application/octet-stream",
  });
  form.append("file", blob, file.originalname || "upload.bin");
  let res: Response;
  try {
    res = await fetch(`${origin}/api/upload/chat-media`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}` },
      body: form,
    });
  } catch (e) {
    throw new PlatformProxyError(502, e instanceof Error ? e.message : "fetch_failed");
  }
  const body = await parseJsonOrText(res);
  throwIfNotOk(res, body);
  return body;
}
