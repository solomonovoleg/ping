import crypto from "crypto";
import { storage } from "../storage";
import { notifyChatListUpdate } from "../calls/ws";
import { notifyNewMessage } from "../realtime/chat";
import { buildChatMessageNotifyPayload } from "../messages/build-chat-message-notify-payload";
import { enrichChatMessagePayloadOwnS3Urls } from "../messages/enrich-message-media-s3-urls";
import { sendChatMessage } from "../messages/service";
import { ensureChatShortCode } from "../chats/chat-short-code";
import { logSecurityAuditEvent } from "../security/security-audit-log";
import { isSsrfRiskUrl } from "../security/ssrf-guard";
import { resolveBusinessContract } from "./constructor/contract-resolver";
import { normalizeBusinessContract } from "./constructor/schema-normalizer";
import { buildUiBlueprintFromDsl } from "./constructor/ui-blueprint-builder";
import type { AutoConnectInput, InboundWebhookPayload } from "./types";
import {
  createBusinessWidget,
  getBusinessActionByChatAndActionId,
  getBusinessWidgetByChatId,
  getBusinessWidgetById,
  getBusinessWidgetByOwnerAndName,
  insertBusinessEvent,
  listBusinessActionsByChatId,
  listBusinessWidgetsByOwner,
  listDueOutboundEvents,
  markBusinessEventDelivered,
  markBusinessEventFailed,
  markBusinessEventRetry,
  replaceBusinessActions,
  saveBusinessContractSnapshot,
  updateBusinessWidget,
} from "./repo";
import {
  createIdempotencyKey,
  isBusinessTimestampFresh,
  verifyBusinessPayloadSignature,
} from "./transport/idempotency";
import { sendBusinessOutbound } from "./transport/outbound-client";
import { calcNextRetryAt } from "./transport/retry-queue";

const MAX_ATTEMPTS = 5;
const WEBHOOK_REPLAY_CACHE_MAX = 5_000;
const webhookReplayCache = new Map<string, number>();

export class BusinessChatError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function encryptionKey(): Buffer {
  const raw =
    process.env.BUSINESS_CHAT_MASTER_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.API_HUB_BRIDGE_SECRET?.trim();
  if (!raw || raw.length < 24) {
    if (process.env.ALLOW_INSECURE_SECRETS === "1") {
      console.warn("[security] BUSINESS_CHAT_MASTER_KEY/SESSION_SECRET is weak or missing, using insecure dev fallback.");
      return crypto.createHash("sha256").update("dev-only-business-chat-secret-change-me").digest();
    }
    throw new BusinessChatError(
      500,
      "Server secret for BUSINESS chat is not configured (need BUSINESS_CHAT_MASTER_KEY or strong SESSION_SECRET).",
    );
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(cipherText: string): string {
  const [ivHex, tagHex, dataHex] = cipherText.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return plain.toString("utf8");
}

async function ensureBusinessChatAccess(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new BusinessChatError(404, "Чат не найден");
  if (chat.type !== "business") throw new BusinessChatError(400, "Это не BUSINESS чат");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new BusinessChatError(403, "Нет доступа");
  const widget = await getBusinessWidgetByChatId(chatId);
  if (!widget) throw new BusinessChatError(404, "Виджет BUSINESS не найден");
  return { chat, memberIds, widget };
}

async function createInboundMessage(chatId: string, type: "text" | "file" | "system", content: string): Promise<void> {
  const created = await storage.createMessage({
    chatId,
    senderId: null,
    type,
    content,
  });
  const members = await storage.getChatMemberIds(chatId);
  const payload = await enrichChatMessagePayloadOwnS3Urls(buildChatMessageNotifyPayload(created));
  notifyNewMessage(chatId, payload);
  for (const memberId of members) {
    notifyChatListUpdate(memberId);
  }
}

function normalizeInboundActionKind(raw: unknown): "button" | "form" | "file_upload" {
  if (raw === "form" || raw === "file_upload" || raw === "button") return raw;
  return "button";
}

function normalizeInboundActionMethod(raw: unknown): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" {
  if (raw === "GET" || raw === "POST" || raw === "PUT" || raw === "PATCH" || raw === "DELETE") return raw;
  return "POST";
}

function validateAutoConnectInput(input: AutoConnectInput): AutoConnectInput {
  const name = input.name.trim();
  const endpointUrl = input.endpointUrl.trim();
  const apiKey = input.apiKey.trim();
  if (!name) throw new BusinessChatError(400, "Укажите название BUSINESS чата");
  if (!endpointUrl || !/^https?:\/\//i.test(endpointUrl)) throw new BusinessChatError(400, "Некорректный endpoint URL");
  if (!apiKey) throw new BusinessChatError(400, "API key обязателен");

  let endpointParsed: URL;
  try {
    endpointParsed = new URL(endpointUrl);
  } catch {
    throw new BusinessChatError(400, "Некорректный endpoint URL");
  }
  if (isSsrfRiskUrl(endpointParsed)) {
    throw new BusinessChatError(400, "Endpoint URL указывает на небезопасный адрес");
  }
  const allowedHosts = String(process.env.BUSINESS_CHAT_ALLOWED_HOSTS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length > 0) {
    const host = endpointParsed.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    if (!hostAllowed) {
      throw new BusinessChatError(400, "Endpoint URL не входит в список разрешённых доменов");
    }
  }

  const contractUrl = input.contractUrl?.trim() || null;
  if (contractUrl) {
    let contractParsed: URL;
    try {
      contractParsed = new URL(contractUrl);
    } catch {
      throw new BusinessChatError(400, "Некорректный contract URL");
    }
    if (!/^https?:$/i.test(contractParsed.protocol)) {
      throw new BusinessChatError(400, "Некорректный contract URL");
    }
    if (isSsrfRiskUrl(contractParsed)) {
      throw new BusinessChatError(400, "Contract URL указывает на небезопасный адрес");
    }
  }

  return {
    ...input,
    name,
    endpointUrl,
    apiKey,
    providerType: (input.providerType || "custom").trim() || "custom",
    contractUrl,
  };
}

function pruneWebhookReplayCache(nowSec: number): void {
  for (const [k, exp] of webhookReplayCache.entries()) {
    if (exp <= nowSec) webhookReplayCache.delete(k);
  }
  if (webhookReplayCache.size <= WEBHOOK_REPLAY_CACHE_MAX) return;
  const entries = Array.from(webhookReplayCache.entries()).sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < entries.length - WEBHOOK_REPLAY_CACHE_MAX; i++) {
    webhookReplayCache.delete(entries[i][0]);
  }
}

async function upsertWidgetAndChat(userId: string, input: AutoConnectInput) {
  const existing = await getBusinessWidgetByOwnerAndName(userId, input.name);
  if (existing) {
    return { widget: existing, chatId: existing.chatId, existed: true };
  }
  const chat = await storage.createChat({
    type: "business",
    name: input.name,
  });
  if (!chat.shortCode) {
    await ensureChatShortCode(chat.id);
  }
  await storage.addChatMember({ chatId: chat.id, userId, role: "admin" });
  const widget = await createBusinessWidget({
    ownerUserId: userId,
    chatId: chat.id,
    name: input.name,
    providerType: input.providerType || "custom",
    endpointUrl: input.endpointUrl,
    contractUrl: input.contractUrl ?? null,
    apiKeyEnc: encryptSecret(input.apiKey),
    status: "active",
  });
  return { widget, chatId: chat.id, existed: false };
}

export async function autoConnectBusinessWidgetForUser(userId: string, raw: AutoConnectInput) {
  const input = validateAutoConnectInput(raw);
  const { widget, chatId, existed } = await upsertWidgetAndChat(userId, input);
  const contract = await resolveBusinessContract(input);
  const normalized = normalizeBusinessContract(contract);
  const uiBlueprint = buildUiBlueprintFromDsl(normalized);

  await updateBusinessWidget(widget.id, {
    endpointUrl: input.endpointUrl,
    contractUrl: input.contractUrl ?? null,
    providerType: input.providerType || "custom",
    apiKeyEnc: encryptSecret(input.apiKey),
    status: "active",
    lastError: null,
  });

  await saveBusinessContractSnapshot({
    widgetId: widget.id,
    rawJson: JSON.stringify(contract),
    normalizedDslJson: JSON.stringify(normalized),
    uiBlueprintJson: JSON.stringify(uiBlueprint),
  });
  await replaceBusinessActions(widget.id, normalized.actions);

  if (!existed) {
    await sendChatMessage({
      userId,
      chatId,
      type: "system",
      content: `BUSINESS чат «${input.name}» подключен. Команд: ${normalized.actions.length}.`,
    });
  } else {
    await sendChatMessage({
      userId,
      chatId,
      type: "system",
      content: `BUSINESS чат «${input.name}» обновлён. Команд: ${normalized.actions.length}.`,
    });
  }

  return {
    widgetId: widget.id,
    chatId,
    chatType: "business" as const,
    name: input.name,
    actions: uiBlueprint.actions,
    created: !existed,
  };
}

export async function listBusinessWidgetsForUser(userId: string) {
  const rows = await listBusinessWidgetsByOwner(userId);
  return rows.map((row) => ({
    id: row.id,
    chatId: row.chatId,
    name: row.name,
    providerType: row.providerType,
    endpointUrl: row.endpointUrl,
    status: row.status,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    lastAutoconfigAt: row.lastAutoconfigAt ? row.lastAutoconfigAt.toISOString() : null,
  }));
}

export async function listBusinessActionsForChat(userId: string, chatId: string) {
  await ensureBusinessChatAccess(userId, chatId);
  const actions = await listBusinessActionsByChatId(chatId);
  return actions.map((action) => ({
    id: action.actionId,
    label: action.label,
    kind: action.kind,
    inputSchema: action.inputSchemaJson ? JSON.parse(action.inputSchemaJson) : null,
  }));
}

export async function invokeBusinessActionFromChat(
  userId: string,
  chatId: string,
  actionId: string,
  input: Record<string, unknown> | null,
) {
  const { widget } = await ensureBusinessChatAccess(userId, chatId);
  const action = await getBusinessActionByChatAndActionId(chatId, actionId);
  if (!action) throw new BusinessChatError(404, "Команда не найдена");
  await sendChatMessage({
    userId,
    chatId,
    type: "text",
    content: `/cmd ${action.actionId}`,
  });
  await enqueueOutboundBusinessEvent(widget.id, "action_invoke", {
    chatId,
    actionId: action.actionId,
    label: action.label,
    input: input ?? {},
    transport: {
      method: action.requestMethod || "POST",
      path: action.requestPath || "/",
      payloadTemplate: action.payloadJson ? JSON.parse(action.payloadJson) : null,
    },
  });
  return { ok: true };
}

export async function enqueueOutboundBusinessEvent(widgetId: string, eventType: string, payload: unknown): Promise<void> {
  const idempotencyKey = createIdempotencyKey([widgetId, eventType, JSON.stringify(payload)]);
  await insertBusinessEvent({
    widgetId,
    direction: "outbound",
    eventType,
    idempotencyKey,
    payloadJson: JSON.stringify(payload),
    nextAttemptAt: new Date(),
  });
  void processDueBusinessOutboundQueue().catch((err) => {
    console.error("[business-chat] processDueBusinessOutboundQueue (after enqueue) failed", err instanceof Error ? err.message : String(err));
  });
}

export async function processDueBusinessOutboundQueue(): Promise<number> {
  const due = await listDueOutboundEvents(20);
  let delivered = 0;
  for (const row of due) {
    const attempt = Number(row.attemptCount ?? 0) + 1;
    try {
      const apiKey = decryptSecret(row.widget.apiKeyEnc);
      const payload = JSON.parse(row.payloadJson);
      const res = await sendBusinessOutbound({
        endpointUrl: row.widget.endpointUrl,
        apiKey,
        payload: {
          eventType: row.eventType,
          idempotencyKey: row.idempotencyKey,
          payload,
        },
      });
      if (res.status >= 200 && res.status < 300) {
        await markBusinessEventDelivered(row.id, JSON.stringify({ status: res.status, body: res.body }));
        delivered += 1;
      } else if (attempt >= MAX_ATTEMPTS) {
        await markBusinessEventFailed(row.id, attempt, `HTTP ${res.status}`);
      } else {
        await markBusinessEventRetry(row.id, attempt, calcNextRetryAt(attempt), `HTTP ${res.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown outbound error";
      if (attempt >= MAX_ATTEMPTS) {
        await markBusinessEventFailed(row.id, attempt, message);
      } else {
        await markBusinessEventRetry(row.id, attempt, calcNextRetryAt(attempt), message);
      }
    }
  }
  return delivered;
}

export async function onBusinessChatUserMessage(input: {
  chatId: string;
  senderId: string | null;
  messageId: string;
  type: string;
  content: string;
  createdAt: string;
}): Promise<void> {
  if (!input.senderId) return;
  const widget = await getBusinessWidgetByChatId(input.chatId);
  if (!widget) return;
  await enqueueOutboundBusinessEvent(widget.id, "user_message", {
    chatId: input.chatId,
    senderId: input.senderId,
    messageId: input.messageId,
    type: input.type,
    content: input.content,
    createdAt: input.createdAt,
  });
}

function parseInboundPayload(rawBody: unknown): InboundWebhookPayload[] {
  if (!rawBody || typeof rawBody !== "object") return [];
  const payload = rawBody as Record<string, unknown>;
  const list = Array.isArray(payload.events) ? payload.events : [payload];
  const out: InboundWebhookPayload[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "message_text" && typeof row.text === "string") {
      out.push({ type: "message_text", text: row.text, eventId: typeof row.eventId === "string" ? row.eventId : undefined });
      continue;
    }
    if (row.type === "message_file" && typeof row.fileUrl === "string") {
      out.push({
        type: "message_file",
        fileUrl: row.fileUrl,
        fileName: typeof row.fileName === "string" ? row.fileName : null,
        mimeType: typeof row.mimeType === "string" ? row.mimeType : null,
        eventId: typeof row.eventId === "string" ? row.eventId : undefined,
      });
      continue;
    }
    if (row.type === "command_set" && Array.isArray(row.commands)) {
      out.push({
        type: "command_set",
        eventId: typeof row.eventId === "string" ? row.eventId : undefined,
        commands: row.commands
          .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
          .map((x) => ({
            id: typeof x.id === "string" ? x.id : "",
            label: typeof x.label === "string" ? x.label : "",
            kind: normalizeInboundActionKind(x.kind),
            method: normalizeInboundActionMethod(x.method),
            path: typeof x.path === "string" ? x.path : "/",
            inputSchema: (x.inputSchema as Record<string, unknown> | null | undefined) ?? null,
            payload: (x.payload as Record<string, unknown> | null | undefined) ?? null,
          }))
          .filter((x) => x.id && x.label),
      });
    }
  }
  return out;
}

export async function handleBusinessInboundWebhook(input: {
  widgetId: string;
  rawBody: unknown;
  rawBodyText: string;
  signature: string;
  timestamp: string;
}): Promise<{ accepted: number }> {
  const widget = await getBusinessWidgetById(input.widgetId);
  if (!widget) throw new BusinessChatError(404, "Виджет не найден");
  const apiKey = decryptSecret(widget.apiKeyEnc);
  if (!input.signature || !input.timestamp) {
    throw new BusinessChatError(401, "Подпись webhook обязательна");
  }
  const maxSkewSecRaw = Number.parseInt(String(process.env.BUSINESS_WEBHOOK_MAX_SKEW_SEC || "300"), 10);
  const maxSkewSec = Number.isFinite(maxSkewSecRaw) && maxSkewSecRaw > 0 ? maxSkewSecRaw : 300;
  if (!isBusinessTimestampFresh(input.timestamp, maxSkewSec)) {
    logSecurityAuditEvent("business_webhook_bad_timestamp", {
      widgetId: input.widgetId,
      timestamp: input.timestamp,
      maxSkewSec,
    });
    throw new BusinessChatError(401, "Просроченный или некорректный timestamp webhook");
  }
  const nowSec = Math.floor(Date.now() / 1000);
  pruneWebhookReplayCache(nowSec);
  const replayKey = createIdempotencyKey([widget.id, input.timestamp, input.signature]);
  const replayExpiresAt = webhookReplayCache.get(replayKey);
  if (replayExpiresAt && replayExpiresAt > nowSec) {
    logSecurityAuditEvent("business_webhook_replay", {
      widgetId: widget.id,
      timestamp: input.timestamp,
      replayKey,
    });
    throw new BusinessChatError(409, "Повтор webhook отклонён");
  }
  const valid = verifyBusinessPayloadSignature(input.rawBodyText, input.timestamp, input.signature, apiKey);
  if (!valid) {
    logSecurityAuditEvent("business_webhook_bad_signature", {
      widgetId: widget.id,
      timestamp: input.timestamp,
    });
    throw new BusinessChatError(401, "Некорректная подпись webhook");
  }
  webhookReplayCache.set(replayKey, nowSec + maxSkewSec + 5);
  const events = parseInboundPayload(input.rawBody);
  let accepted = 0;
  for (const event of events) {
    await insertBusinessEvent({
      widgetId: widget.id,
      direction: "inbound",
      eventType: event.type,
      externalEventId: event.eventId ?? null,
      idempotencyKey: createIdempotencyKey([widget.id, event.type, event.eventId ?? ""]),
      payloadJson: JSON.stringify(event),
      status: "delivered",
    }).catch(() => null);
    if (event.type === "message_text") {
      await createInboundMessage(widget.chatId, "text", event.text);
      accepted += 1;
      continue;
    }
    if (event.type === "message_file") {
      const payload = JSON.stringify({
        url: event.fileUrl,
        name: event.fileName || "file",
        mime: event.mimeType || "application/octet-stream",
      });
      await createInboundMessage(widget.chatId, "file", payload);
      accepted += 1;
      continue;
    }
    if (event.type === "command_set") {
      await replaceBusinessActions(
        widget.id,
        event.commands.map((cmd, index) => ({
          id: cmd.id,
          label: cmd.label,
          kind: cmd.kind || "button",
          method: cmd.method || "POST",
          path: cmd.path || "/",
          inputSchema: cmd.inputSchema ?? null,
          payload: cmd.payload ?? null,
          orderIndex: index,
        })),
      );
      await createInboundMessage(widget.chatId, "system", `Обновлены команды: ${event.commands.map((c) => c.label).join(", ")}`);
      accepted += 1;
    }
  }
  return { accepted };
}
