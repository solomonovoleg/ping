import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { CALL_WS_SUBPROTOCOL, resolveCallHandshakeToken } from "@shared/ws-call-handshake";
import { consumeCallToken } from "./token";
import { sendVoipIncomingToUser } from "../push/apns-voip";
import { sendPushToUser } from "../push/send";
import { recordMissedCall } from "./missed";
import {
  addSubscription,
  removeSubscription,
  removeConnection,
  getChatSubscribers,
  addThreadOpenSubscription,
  removeThreadOpenSubscription,
  getChatThreadOpenSubscribers,
} from "../realtime/chat";
import { storage } from "../storage";
import {
  createSession,
  getSession,
  getActiveCallForUser,
  acceptSession,
  endSession,
  isUserInActiveCall,
  isParticipant,
  findRingingSessionBetween,
  getOtherParticipant,
  setRingTimer,
  markParticipantConnected,
  RING_TIMEOUT_MS,
  type CallSession,
  type CallSessionState,
} from "./session";
import { isUserInGroupCall } from "../group-calls/room-runtime";

type WsWithUserId = WebSocket & {
  userId?: string;
  isAlive?: boolean;
  messageChain?: Promise<void>;
  signalSeqOut?: number;
  lastClientSignalSeqByTypeAndCall?: Map<string, number>;
  /** Гонка mark-chat-read до subscribe-chat-thread: chatId → последний messageId */
  pendingChatReadByChatId?: Map<string, string>;
};

async function applyMarkChatReadFromWs(userId: string, chatId: string, messageId: string): Promise<void> {
  try {
    const { markChatRead } = await import("../chats/service");
    await markChatRead(chatId, userId, messageId);
  } catch (e) {
    console.warn("[calls] mark-chat-read failed", { userId, chatId, messageId, err: String(e) });
  }
}

async function flushPendingChatReadOnSubscribe(ws: WsWithUserId, userId: string, chatId: string): Promise<void> {
  const map = ws.pendingChatReadByChatId;
  const messageId = map?.get(chatId);
  if (!messageId || !map) return;
  map.delete(chatId);
  if (map.size === 0) delete ws.pendingChatReadByChatId;
  await applyMarkChatReadFromWs(userId, chatId, messageId);
}

/** userId -> Set of WebSocket */
const socketsByUser = new Map<string, Set<WsWithUserId>>();
const callRouteByUserAndCall = new Map<string, WsWithUserId>();
const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const callSetupTimesByCallId = new Map<
  string,
  {
    inviteAt: number;
    acceptedAt?: number;
    connectedAt?: number;
  }
>();
const inviteToConnectedDurationsMs: number[] = [];
const RECENT_CALL_EVENTS_MAX = 200;
const recentCallEvents: Array<{ at: number; event: string; callId?: string; details?: Record<string, unknown> }> = [];
const callsReliabilityMetrics = {
  wsReconnectReason: {
    normal: 0,
    abnormal_or_network: 0,
    superseded: 0,
    policy_or_auth: 0,
    other: 0,
  },
  callStateTransition: {
    total: 0,
    toConnected: 0,
    toEnded: 0,
    toMissed: 0,
    toFailed: 0,
  },
  setupFunnel: {
    inviteSent: 0,
    accepted: 0,
    offerForwarded: 0,
    answerForwarded: 0,
    iceForwarded: 0,
    connected: 0,
    setupFailed: 0,
  },
  setupLatencyMs: {
    samples: 0,
    inviteToAcceptedTotal: 0,
    inviteToConnectedTotal: 0,
    p50InviteToConnectedLast: 0,
    p95InviteToConnectedLast: 0,
    p99InviteToConnectedLast: 0,
  },
  setupFailureReason: {
    timeout: 0,
    rejected: 0,
    canceled: 0,
    hungup: 0,
    disconnect_timeout: 0,
    other: 0,
  },
};
const DISCONNECT_GRACE_MS = numEnv("CALLS_DISCONNECT_GRACE_MS", 25_000);
const ENFORCE_SINGLE_CALLS_SOCKET_PER_USER = process.env.CALLS_SINGLE_SOCKET_PER_USER === "1";

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CALLS_DEBUG = process.env.CALLS_DEBUG === "1";

function debugCall(event: string, details: Record<string, unknown>): void {
  if (!CALLS_DEBUG) return;
  console.log(`[calls] ${event}`, details);
}

function getUserSockets(userId: string): Set<WsWithUserId> {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  return set;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx] ?? 0;
}

function pushRecentCallEvent(event: string, callId?: string, details?: Record<string, unknown>): void {
  recentCallEvents.push({ at: Date.now(), event, callId, details });
  if (recentCallEvents.length > RECENT_CALL_EVENTS_MAX) {
    recentCallEvents.splice(0, recentCallEvents.length - RECENT_CALL_EVENTS_MAX);
  }
}

function markSetupStage(callId: string, stage: "invite" | "accepted" | "connected"): void {
  const now = Date.now();
  const rec = callSetupTimesByCallId.get(callId) ?? { inviteAt: now };
  if (stage === "invite") rec.inviteAt = now;
  if (stage === "accepted") rec.acceptedAt = now;
  if (stage === "connected") rec.connectedAt = now;
  callSetupTimesByCallId.set(callId, rec);

  if (stage === "accepted" && rec.inviteAt) {
    callsReliabilityMetrics.setupLatencyMs.samples += 1;
    callsReliabilityMetrics.setupLatencyMs.inviteToAcceptedTotal += Math.max(0, now - rec.inviteAt);
  }
  if (stage === "connected" && rec.inviteAt) {
    const duration = Math.max(0, now - rec.inviteAt);
    callsReliabilityMetrics.setupLatencyMs.inviteToConnectedTotal += duration;
    inviteToConnectedDurationsMs.push(duration);
    if (inviteToConnectedDurationsMs.length > 500) {
      inviteToConnectedDurationsMs.splice(0, inviteToConnectedDurationsMs.length - 500);
    }
    callsReliabilityMetrics.setupLatencyMs.p50InviteToConnectedLast = percentile(inviteToConnectedDurationsMs, 0.5);
    callsReliabilityMetrics.setupLatencyMs.p95InviteToConnectedLast = percentile(inviteToConnectedDurationsMs, 0.95);
    callsReliabilityMetrics.setupLatencyMs.p99InviteToConnectedLast = percentile(inviteToConnectedDurationsMs, 0.99);
  }
}

function closeSetupTracking(
  callId: string,
  opts?: {
    failed?: boolean;
    reason?: "timeout" | "rejected" | "canceled" | "hungup" | "disconnect_timeout" | "other";
  },
): void {
  const rec = callSetupTimesByCallId.get(callId);
  if (opts?.failed === true && rec && !rec.connectedAt) {
    callsReliabilityMetrics.setupFunnel.setupFailed += 1;
    const reason = opts.reason ?? "other";
    callsReliabilityMetrics.setupFailureReason[reason] += 1;
  }
  callSetupTimesByCallId.delete(callId);
}

function getOpenUserSockets(userId: string): WsWithUserId[] {
  const set = socketsByUser.get(userId);
  if (!set) return [];
  const list: WsWithUserId[] = [];
  set.forEach((ws) => {
    if (ws.readyState === 1) {
      list.push(ws);
      return;
    }
    if (ws.readyState === 2 || ws.readyState === 3) set.delete(ws);
  });
  if (set.size === 0) socketsByUser.delete(userId);
  return list;
}

/** Legacy policy: принудительно держать один /calls WS на пользователя. */
function closeExistingCallSocketsForUser(userId: string): void {
  const set = socketsByUser.get(userId);
  if (!set || set.size === 0) return;
  let n = 0;
  for (const old of [...set]) {
    try {
      if (old.readyState === 0 || old.readyState === 1) {
        // Явно сообщаем клиенту, что соединение заменено новым /calls этого же пользователя.
        old.close(4001, "superseded_by_new_connection");
        n += 1;
      }
    } catch {
      /* ignore */
    }
  }
  if (n > 0) {
    console.log("[calls] closed previous /calls socket(s) for user (single connection policy)", { userId, closed: n });
  }
}

/** Уникальные пользователи с открытым /calls WS и число таких соединений (для админ-метрик). */
export function getCallsRealtimeMetrics(): { onlineUsers: number; openConnections: number } {
  let onlineUsers = 0;
  let openConnections = 0;
  for (const [, set] of socketsByUser) {
    let n = 0;
    set.forEach((ws) => {
      if (ws.readyState === 1) n += 1;
    });
    if (n > 0) {
      onlineUsers += 1;
      openConnections += n;
    }
  }
  return { onlineUsers, openConnections };
}

function sendToUser(userId: string, data: Record<string, unknown>): void {
  const set = getOpenUserSockets(userId);
  set.forEach((ws) => {
    const seq = (ws.signalSeqOut ?? 0) + 1;
    ws.signalSeqOut = seq;
    const payload = {
      ...data,
      signalSeq: seq,
      sentAtMs: Date.now(),
      traceId: typeof data.callId === "string" ? data.callId : undefined,
    };
    ws.send(JSON.stringify(payload));
  });
}

/** Произвольный JSON всем открытым /calls WS пользователя (чат-реалтайм вне subscribe-chat, список чатов, звонки). */
export function sendUserRealtimePayload(userId: string, data: Record<string, unknown>): void {
  sendToUser(userId, data);
}

const ANDROID_PUSH_CHANNEL_INCOMING_CALL = "ping_calls";

/**
 * Пуш о входящем всегда в дополнение к WebSocket: при открытом приложении раньше пуш не слался
 * (calleeSockets.length > 0), и при «залипшем» сокете звонок пропадал полностью.
 */
function notifyIncomingCallPush(
  calleeUserId: string,
  callerDisplayName: string,
  meta: { callId: string; chatId: string; fromUserId: string; mediaType: string },
): void {
  void sendPushToUser(
    calleeUserId,
    "Вам звонит " + callerDisplayName,
    "Откройте приложение, чтобы ответить",
    {
      ping_push_kind: "incoming_call",
      callId: meta.callId,
      chatId: meta.chatId,
      fromUserId: meta.fromUserId,
      mediaType: meta.mediaType,
    },
    { androidChannelId: ANDROID_PUSH_CHANNEL_INCOMING_CALL },
  ).then((r) => {
    if (!r.ok && r.reason !== "no_token" && r.reason !== "push_disabled") {
      console.warn("[push] incoming_call: не отправлено", { calleeUserId, reason: r.reason });
    }
  });
  void sendVoipIncomingToUser(calleeUserId, callerDisplayName, meta).catch(() => {});
}

function callRouteKey(userId: string, callId: string): string {
  return `${userId}:${callId}`;
}

function bindCallRoute(userId: string, callId: string, ws: WsWithUserId): void {
  callRouteByUserAndCall.set(callRouteKey(userId, callId), ws);
}

function clearRoutesForSocket(ws: WsWithUserId): void {
  for (const [key, socket] of callRouteByUserAndCall) {
    if (socket === ws) callRouteByUserAndCall.delete(key);
  }
}

function sendToUserForCall(userId: string, callId: string, data: Record<string, unknown>): void {
  const key = callRouteKey(userId, callId);
  const routed = callRouteByUserAndCall.get(key);
  if (routed) {
    if (routed.readyState === 1) {
      const seq = (routed.signalSeqOut ?? 0) + 1;
      routed.signalSeqOut = seq;
      routed.send(
        JSON.stringify({
          ...data,
          signalSeq: seq,
          sentAtMs: Date.now(),
          traceId: callId,
        }),
      );
      return;
    }
    /** Маршрут указывал на закрывающийся/мёртвый сокет — иначе answer/ICE теряются, пока ключ не протухнет. */
    callRouteByUserAndCall.delete(key);
  }
  const set = getOpenUserSockets(userId);
  set.forEach((ws) => {
    const seq = (ws.signalSeqOut ?? 0) + 1;
    ws.signalSeqOut = seq;
    ws.send(
      JSON.stringify({
        ...data,
        signalSeq: seq,
        sentAtMs: Date.now(),
        traceId: callId,
      }),
    );
  });
}

function callTransitionLog(callId: string, from: CallSessionState, to: CallSessionState, meta?: Record<string, unknown>): void {
  callsReliabilityMetrics.callStateTransition.total += 1;
  if (to === "connected") callsReliabilityMetrics.callStateTransition.toConnected += 1;
  if (to === "ended") callsReliabilityMetrics.callStateTransition.toEnded += 1;
  if (to === "missed") callsReliabilityMetrics.callStateTransition.toMissed += 1;
  if (to === "failed") callsReliabilityMetrics.callStateTransition.toFailed += 1;
  pushRecentCallEvent("call.state-transition", callId, { from, to, ...(meta ?? {}) });
  console.log("[calls] call.state-transition", { callId, from, to, ...(meta ?? {}) });
}

export function getCallsReliabilityMetrics(): {
  wsReconnectReason: typeof callsReliabilityMetrics.wsReconnectReason;
  callStateTransition: typeof callsReliabilityMetrics.callStateTransition;
  setupFunnel: typeof callsReliabilityMetrics.setupFunnel;
  setupLatencyMs: typeof callsReliabilityMetrics.setupLatencyMs;
  setupFailureReason: typeof callsReliabilityMetrics.setupFailureReason;
  recentCallEvents: typeof recentCallEvents;
} {
  return {
    wsReconnectReason: { ...callsReliabilityMetrics.wsReconnectReason },
    callStateTransition: { ...callsReliabilityMetrics.callStateTransition },
    setupFunnel: { ...callsReliabilityMetrics.setupFunnel },
    setupLatencyMs: { ...callsReliabilityMetrics.setupLatencyMs },
    setupFailureReason: { ...callsReliabilityMetrics.setupFailureReason },
    recentCallEvents: [...recentCallEvents],
  };
}

function resumeAvailablePayload(
  session: CallSession,
  viewerUserId: string,
  otherUser: { displayName?: string | null; surname?: string | null; phone?: string | null; avatarUrl?: string | null } | null | undefined,
): Record<string, unknown> {
  const otherUserId = session.callerId === viewerUserId ? session.calleeId : session.callerId;
  const direction = session.callerId === viewerUserId ? "outgoing" : "incoming";
  const name =
    [otherUser?.displayName, otherUser?.surname].filter(Boolean).join(" ").trim() ||
    otherUser?.phone ||
    "Абонент";
  return {
    type: "call.resume-available",
    callId: session.callId,
    chatId: session.chatId,
    mediaType: session.mediaType,
    otherUserId,
    otherDisplayName: name,
    otherAvatarUrl: otherUser?.avatarUrl ?? null,
    direction,
    shouldInitiateOffer: direction === "outgoing",
    sessionState: session.state,
  };
}

function clearDisconnectCleanupTimer(userId: string): void {
  const t = disconnectCleanupTimers.get(userId);
  if (!t) return;
  clearTimeout(t);
  disconnectCleanupTimers.delete(userId);
}

export type ChatListUpdateOptions = {
  /** Подсказка клиенту: воспроизвести звук входящего, если чат не открыт (в т.ч. до подписки на новый чат). */
  incomingMessage?: { chatId: string; senderId: string };
  /** Новая комната группового созвона — рингтон + уведомление как у личного звонка. */
  groupCallInvite?: {
    chatId: string;
    roomId: string;
    mediaType: "audio" | "video";
    hostUserId: string;
    chatTitle?: string | null;
  };
};

/** Notify a user that their chat list changed (new chat, etc.) */
export function notifyChatListUpdate(userId: string, options?: ChatListUpdateOptions): void {
  const payload: Record<string, unknown> = { type: "chat-list-update" };
  if (options?.incomingMessage) {
    payload.incomingMessage = options.incomingMessage;
  }
  if (options?.groupCallInvite) {
    payload.groupCallInvite = options.groupCallInvite;
  }
  sendToUser(userId, payload);
}

export function attachCallWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols(protocols: Set<string>): string | false {
      if (protocols.has(CALL_WS_SUBPROTOCOL)) return CALL_WS_SUBPROTOCOL;
      return false;
    },
  });
  const HEARTBEAT_MS = numEnv("CALLS_WS_HEARTBEAT_MS", 30_000);

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WsWithUserId;
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        return;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch { try { ws.terminate(); } catch {} }
    });
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(heartbeatTimer));

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    if (url.pathname !== "/calls") return;
    const secProto = request.headers["sec-websocket-protocol"];
    const resolved = resolveCallHandshakeToken(secProto, url.searchParams.get("token"));
    if (!resolved) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const userId = consumeCallToken(resolved.token);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, userId);
    });
  });

  wss.on("connection", (ws: WsWithUserId, _req: IncomingMessage, userId: string) => {
    ws.userId = userId;
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    clearDisconnectCleanupTimer(userId);
    // По умолчанию разрешаем несколько сокетов пользователя (мульти-девайс / мульти-вкладки),
    // иначе два активных клиента могут пинг-понгом выбивать друг друга и ломать сигналинг звонка.
    if (ENFORCE_SINGLE_CALLS_SOCKET_PER_USER) {
      closeExistingCallSocketsForUser(userId);
    }
    getUserSockets(userId).add(ws);
    console.log("[calls] ws connected", { userId, totalSockets: getOpenUserSockets(userId).length });
    storage.updateUserLastSeen(userId).catch((err) => {
      console.warn("[lastSeen] calls ws connect failed", {
        userId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
    const activeSession = getActiveCallForUser(userId);
    if (activeSession) {
      const otherUserId = activeSession.callerId === userId ? activeSession.calleeId : activeSession.callerId;
      // Только сигнал собеседнику. resume-available шлём один раз по call.resume-check — иначе дубликат
      // с ответом на check → два renegotiate на клиенте и ICE/SDP ломается.
      sendToUser(otherUserId, { type: "call.peer-reconnected", callId: activeSession.callId, byUserId: userId });
    }

    /** ws не ждёт async-обработчик: без очереди `call.offer` / ICE могут выполниться до `await` внутри `call.invite` → сессии ещё нет, SDP теряется. */
    ws.on("message", (raw: Buffer | string) => {
      const prev = ws.messageChain ?? Promise.resolve();
      ws.messageChain = prev
        .catch((err) => {
          console.error("[calls] ws message queue (recover after error)", { userId, err: String(err) });
        })
        .then(async () => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const type = parsed.type as string | undefined;
        const parsedCallId = typeof parsed.callId === "string" ? parsed.callId : "";
        const parsedSignalSeq =
          typeof parsed.signalSeq === "number" && Number.isFinite(parsed.signalSeq) ? parsed.signalSeq : null;
        if (parsedSignalSeq != null && type && type.startsWith("call.")) {
          const seqMap = ws.lastClientSignalSeqByTypeAndCall ?? new Map<string, number>();
          ws.lastClientSignalSeqByTypeAndCall = seqMap;
          const seqKey = `${parsedCallId || "no-call-id"}:${type}`;
          const prevSeq = seqMap.get(seqKey);
          if (typeof prevSeq === "number" && parsedSignalSeq <= prevSeq) {
            pushRecentCallEvent("call.duplicate-signal-drop", parsedCallId || undefined, {
              userId,
              type,
              signalSeq: parsedSignalSeq,
              prevSeq,
            });
            debugCall("call.duplicate-signal-drop", {
              userId,
              type,
              callId: parsedCallId || null,
              signalSeq: parsedSignalSeq,
              prevSeq,
            });
            return;
          }
          seqMap.set(seqKey, parsedSignalSeq);
        }

        // ── Chat subscriptions (shared transport) ───────────────
        if (type === "subscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (!chatId) return;
          // Только после проверки членства — иначе гонка: сообщения успевают уйти подписчику до removeSubscription.
          try {
            const members = await storage.getChatMemberIds(chatId);
            if (!members.includes(userId)) {
              ws.pendingChatReadByChatId?.delete(chatId);
              return;
            }
            addSubscription(chatId, ws);
          } catch {
            ws.pendingChatReadByChatId?.delete(chatId);
          }
          return;
        }
        if (type === "subscribe-chat-thread") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (!chatId) return;
          try {
            const members = await storage.getChatMemberIds(chatId);
            if (!members.includes(userId)) {
              ws.pendingChatReadByChatId?.delete(chatId);
              return;
            }
            addThreadOpenSubscription(chatId, ws);
            await flushPendingChatReadOnSubscribe(ws, userId, chatId);
          } catch {
            ws.pendingChatReadByChatId?.delete(chatId);
          }
          return;
        }
        if (type === "unsubscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            removeSubscription(chatId, ws);
            removeThreadOpenSubscription(chatId, ws);
            ws.pendingChatReadByChatId?.delete(chatId);
          }
          return;
        }
        if (type === "unsubscribe-chat-thread") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            removeThreadOpenSubscription(chatId, ws);
            ws.pendingChatReadByChatId?.delete(chatId);
          }
          return;
        }
        if (type === "mark-chat-read") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId.trim() : "";
          const messageId = typeof parsed.messageId === "string" ? parsed.messageId.trim() : "";
          if (!chatId || !messageId) return;
          const threadSubs = getChatThreadOpenSubscribers(chatId);
          if (threadSubs.has(ws)) {
            await applyMarkChatReadFromWs(userId, chatId, messageId);
          } else {
            let map = ws.pendingChatReadByChatId;
            if (!map) {
              map = new Map();
              ws.pendingChatReadByChatId = map;
            }
            map.set(chatId, messageId);
          }
          return;
        }
        if (type === "typing") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            const members = await storage.getChatMemberIds(chatId);
            if (!members.includes(userId)) {
              sendToUser(userId, {
                type: "call.error",
                code: "not_in_chat",
                message: "Вы не состоите в этом чате",
              });
              return;
            }
            const subs = getChatSubscribers(chatId);
            const typingActive = parsed.active !== false;
            const payload = JSON.stringify({
              type: "typing", chatId, userId,
              displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
              active: typingActive,
            });
            subs.forEach((w) => { if (w !== ws && w.readyState === 1) w.send(payload); });
          }
          return;
        }
        if (type === "voice-recording") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          const recording = parsed.recording === true;
          if (chatId) {
            const members = await storage.getChatMemberIds(chatId);
            if (!members.includes(userId)) {
              sendToUser(userId, {
                type: "call.error",
                code: "not_in_chat",
                message: "Вы не состоите в этом чате",
              });
              return;
            }
            const subs = getChatSubscribers(chatId);
            const payload = JSON.stringify({
              type: "voice-recording", chatId, userId,
              displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
              recording,
            });
            subs.forEach((w) => { if (w !== ws && w.readyState === 1) w.send(payload); });
          }
          return;
        }
        if (type === "composer-pulse") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId.trim() : "";
          if (!chatId) return;
          const members = await storage.getChatMemberIds(chatId);
          if (!members.includes(userId)) {
            sendToUser(userId, {
              type: "call.error",
              code: "not_in_chat",
              message: "Вы не состоите в этом чате",
            });
            return;
          }
          const { isDmChat, enqueueComposerPulsePending } = await import("../chats/composer-pulse-service");
          if (!(await isDmChat(chatId))) return;
          const subs = getChatSubscribers(chatId);
          const reachedUserIds = new Set<string>();
          subs.forEach((w) => {
            if (w === ws || w.readyState !== 1) return;
            const uid = (w as WsWithUserId).userId;
            if (uid) reachedUserIds.add(uid);
          });
          const payload = JSON.stringify({
            type: "composer-pulse",
            chatId,
            userId,
            displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
            at: Date.now(),
          });
          subs.forEach((w) => {
            if (w !== ws && w.readyState === 1) w.send(payload);
          });
          for (const mid of members) {
            if (mid === userId) continue;
            if (!reachedUserIds.has(mid)) {
              await enqueueComposerPulsePending({ chatId, fromUserId: userId, toUserId: mid });
            }
          }
          return;
        }

        // ── Call events (call.* namespace) ──────────────────────
        if (!type || !type.startsWith("call.")) return;

        if (type === "call.resume-check") {
          const sessionForUser = getActiveCallForUser(userId);
          if (!sessionForUser) {
            debugCall("call.resume-check-miss", { userId, reason: "no_active_session" });
            console.log("[calls] resume-check: no active session (user may have been dropped after disconnect grace or call ended)", {
              userId,
            });
            return;
          }
          const otherUserId = sessionForUser.callerId === userId ? sessionForUser.calleeId : sessionForUser.callerId;
          const otherUser = await storage.getUser(otherUserId);
          ws.send(JSON.stringify(resumeAvailablePayload(sessionForUser, userId, otherUser)));
          return;
        }

        const callId = typeof parsed.callId === "string" ? parsed.callId : "";

        // ── call.invite ─────────────────────────────────────────
        if (type === "call.invite") {
          const toUserId = typeof parsed.toUserId === "string" ? parsed.toUserId : "";
          let chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          const mediaType = parsed.mediaType === "video" ? "video" as const : "audio" as const;
          const fromDisplayName = typeof parsed.fromDisplayName === "string" && parsed.fromDisplayName.trim()
            ? parsed.fromDisplayName.trim() : "Абонент";

          if (!callId || !toUserId || !chatId) return;
          if (toUserId === userId) return;
          bindCallRoute(userId, callId, ws);

          const targetUser = await storage.getUser(toUserId);
          if (!targetUser) {
            sendToUser(userId, { type: "call.error", callId, code: "user_not_found", message: "Пользователь не найден" });
            return;
          }

          const [calleeBlocksCaller, callerBlocksCallee] = await Promise.all([
            storage.getBlockFlags(toUserId, userId),
            storage.getBlockFlags(userId, toUserId),
          ]);
          if (calleeBlocksCaller?.restrictChat) {
            sendToUser(userId, {
              type: "call.error",
              callId,
              code: "blocked_by_peer",
              message: "Собеседник ограничил вам сообщения и звонки",
            });
            return;
          }
          if (callerBlocksCallee?.restrictChat) {
            sendToUser(userId, {
              type: "call.error",
              callId,
              code: "you_blocked_peer",
              message: "Вы ограничили этому пользователю сообщения и звонки",
            });
            return;
          }

          if (chatId) {
            const memberIds = await storage.getChatMemberIds(chatId);
            if (!memberIds.includes(userId) || !memberIds.includes(toUserId)) {
              // Fallback for stale chatId on client:
              // if users have a DM, use it; otherwise keep strict rejection.
              try {
                const dm = await storage.getOrCreateDmChat(userId, toUserId);
                if (dm?.id) {
                  console.warn("[calls] invite with stale chatId, fallback to DM", {
                    fromUserId: userId,
                    toUserId,
                    providedChatId: chatId,
                    fallbackChatId: dm.id,
                  });
                  chatId = dm.id;
                } else {
                  sendToUser(userId, { type: "call.error", callId, code: "not_in_chat", message: "Вы не состоите в этом чате" });
                  return;
                }
              } catch (e) {
                console.warn("[calls] invite fallback DM failed", { fromUserId: userId, toUserId, chatId, error: String(e) });
                sendToUser(userId, { type: "call.error", callId, code: "not_in_chat", message: "Вы не состоите в этом чате" });
                return;
              }
            }
          }

          const existingForInviter = getActiveCallForUser(userId);
          if (
            existingForInviter &&
            existingForInviter.state === "ringing" &&
            existingForInviter.calleeId === userId &&
            existingForInviter.callerId === toUserId
          ) {
            const glareCaller = await storage.getUser(toUserId);
            sendToUser(userId, {
              type: "call.error",
              callId,
              code: "glare_use_incoming",
              message: "Собеседник уже вызывает вас",
            });
            sendToUser(userId, {
              type: "call.incoming",
              callId: existingForInviter.callId,
              fromUserId: toUserId,
              chatId: existingForInviter.chatId,
              mediaType: existingForInviter.mediaType,
              fromDisplayName: existingForInviter.callerDisplayName,
              fromAvatarUrl: glareCaller?.avatarUrl ?? null,
            });
            notifyIncomingCallPush(userId, existingForInviter.callerDisplayName, {
              callId: existingForInviter.callId,
              chatId: existingForInviter.chatId,
              fromUserId: toUserId,
              mediaType: existingForInviter.mediaType,
            });
            return;
          }

          // Защита от "залипшей" 1:1-сессии: если пользователь повторно звонит тому же
          // собеседнику, считаем предыдущую сессию этой пары завершённой и начинаем новую.
          // Это покрывает кейс, когда call.hangup/call.cancel потерялся из-за перезахода WS.
          if (existingForInviter && isParticipant(existingForInviter.callId, toUserId)) {
            const staleCallId = existingForInviter.callId;
            if (staleCallId !== callId) {
              endSession(staleCallId, userId, "ended", "superseded");
              console.warn("[calls] force-ended previous pair session before redial", {
                userId,
                toUserId,
                staleCallId,
                newCallId: callId,
                staleState: existingForInviter.state,
              });
              sendToUser(toUserId, { type: "call.hungup", callId: staleCallId, byUserId: userId });
            }
          }

          if (isUserInActiveCall(userId)) {
            sendToUser(userId, { type: "call.error", callId, code: "already_in_call", message: "Вы уже в звонке" });
            return;
          }

          if (isUserInGroupCall(userId)) {
            sendToUser(userId, { type: "call.error", callId, code: "in_group_call", message: "Сначала выйдите из группового созвона" });
            return;
          }

          // Callee может «висеть» в активной 1:1 с тем же caller (потерянный hangup / обрыв WS) —
          // тогда новый invite получит busy и второй дозвон не состоится. Симметрично сбросу у inviter.
          const existingForCallee = getActiveCallForUser(toUserId);
          if (existingForCallee && isParticipant(existingForCallee.callId, userId)) {
            const staleCallId = existingForCallee.callId;
            if (staleCallId !== callId) {
              endSession(staleCallId, userId, "ended", "superseded");
              console.warn("[calls] force-ended callee stale pair session before redial", {
                callerId: userId,
                calleeId: toUserId,
                staleCallId,
                newCallId: callId,
                staleState: existingForCallee.state,
              });
              sendToUser(userId, { type: "call.hungup", callId: staleCallId, byUserId: toUserId });
              sendToUser(toUserId, { type: "call.hungup", callId: staleCallId, byUserId: userId });
            }
          }

          if (isUserInActiveCall(toUserId)) {
            sendToUser(userId, { type: "call.rejected", callId, byUserId: toUserId, reason: "busy" });
            return;
          }

          if (isUserInGroupCall(toUserId)) {
            sendToUser(userId, { type: "call.rejected", callId, byUserId: toUserId, reason: "busy" });
            return;
          }

          const callerUser = await storage.getUser(userId);
          const fromAvatarUrl = callerUser?.avatarUrl ?? null;

          // После await другой клиент мог создать сессию — без этого два почти одновременных invite → две сессии / «сироты» в Map.
          const raced = findRingingSessionBetween(userId, toUserId);
          if (raced) {
            if (raced.callerId === userId && raced.calleeId === toUserId) {
              sendToUser(toUserId, {
                type: "call.incoming",
                callId: raced.callId,
                fromUserId: userId,
                chatId: raced.chatId,
                mediaType: raced.mediaType,
                fromDisplayName: raced.callerDisplayName,
                fromAvatarUrl,
              });
              notifyIncomingCallPush(toUserId, raced.callerDisplayName, {
                callId: raced.callId,
                chatId: raced.chatId,
                fromUserId: userId,
                mediaType: raced.mediaType,
              });
              return;
            }
            if (raced.callerId === toUserId && raced.calleeId === userId) {
              const glareCaller = await storage.getUser(toUserId);
              sendToUser(userId, {
                type: "call.error",
                callId,
                code: "glare_use_incoming",
                message: "Собеседник уже вызывает вас",
              });
              sendToUser(userId, {
                type: "call.incoming",
                callId: raced.callId,
                fromUserId: toUserId,
                chatId: raced.chatId,
                mediaType: raced.mediaType,
                fromDisplayName: raced.callerDisplayName,
                fromAvatarUrl: glareCaller?.avatarUrl ?? null,
              });
              notifyIncomingCallPush(userId, raced.callerDisplayName, {
                callId: raced.callId,
                chatId: raced.chatId,
                fromUserId: toUserId,
                mediaType: raced.mediaType,
              });
              return;
            }
            sendToUser(userId, { type: "call.rejected", callId, byUserId: toUserId, reason: "busy" });
            return;
          }

          const session = createSession({ callId, callerId: userId, calleeId: toUserId, chatId, mediaType, callerDisplayName: fromDisplayName });
          callsReliabilityMetrics.setupFunnel.inviteSent += 1;
          markSetupStage(callId, "invite");
          debugCall("call.invite", { callId, from: userId, to: toUserId, chatId, mediaType });

          notifyIncomingCallPush(toUserId, fromDisplayName, {
            callId,
            chatId,
            fromUserId: userId,
            mediaType,
          });

          sendToUser(toUserId, {
            type: "call.incoming", callId, fromUserId: userId, chatId, mediaType, fromDisplayName, fromAvatarUrl,
          });

          const ringTimer = setTimeout(() => {
            const s = getSession(callId);
            if (!s || s.state !== "ringing") return;
            const ended = endSession(callId, undefined, "missed", "timeout");
            if (!ended.changed) return;
            closeSetupTracking(callId, { failed: true, reason: "timeout" });
            callTransitionLog(callId, "ringing", "missed", { reason: "ring-timeout" });
            console.log("[calls] ring timeout", { callId, callerId: userId, calleeId: toUserId });
            recordMissedCall(chatId, userId, toUserId, mediaType === "video").catch((e) => console.error("[calls] recordMissedCall:", e));
            sendToUser(userId, { type: "call.timeout", callId });
            sendToUser(toUserId, { type: "call.timeout", callId });
          }, RING_TIMEOUT_MS);
          setRingTimer(callId, ringTimer);
          return;
        }

        // ── All other call events require valid callId ──────────
        if (!callId) return;
        const session = getSession(callId);

        // ── call.accept ─────────────────────────────────────────
        if (type === "call.accept") {
          if (!session || !isParticipant(callId, userId)) return;
          if (session.calleeId !== userId) return;
          bindCallRoute(userId, callId, ws);
          if (!acceptSession(callId)) return;
          callsReliabilityMetrics.setupFunnel.accepted += 1;
          markSetupStage(callId, "accepted");

          callTransitionLog(callId, "ringing", "accepted", { byUserId: userId });
          console.log("[calls] call.accept", { callId, calleeId: userId, callerId: session.callerId });

          sendToUserForCall(session.callerId, callId, { type: "call.accepted", callId, byUserId: userId });

          getUserSockets(userId).forEach((s) => {
            if (s !== ws && s.readyState === 1) {
              s.send(JSON.stringify({ type: "call.canceled", callId, byUserId: userId }));
            }
          });
          return;
        }

        // ── call.reject ─────────────────────────────────────────
        if (type === "call.reject") {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const prevState = session.state;
          const reason = parsed.reason === "busy" ? "busy" as const : "declined" as const;
          const target = getOtherParticipant(callId, userId);
          const nextState = reason === "busy" ? "busy" : "rejected";
          const ended = endSession(callId, userId, nextState, reason === "busy" ? "busy" : "rejected");
          if (!ended.changed) return;
          closeSetupTracking(callId, { failed: true, reason: "rejected" });
          callTransitionLog(callId, prevState, nextState, { byUserId: userId, reason });
          console.log("[calls] call.reject", { callId, userId, reason });
          if (target) {
            sendToUserForCall(target, callId, { type: "call.rejected", callId, byUserId: userId, reason });
          }
          return;
        }

        // ── call.cancel ─────────────────────────────────────────
        if (type === "call.cancel") {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const target = getOtherParticipant(callId, userId);
          const prevState = session.state;
          const ended = endSession(callId, userId, "ended", "cancel");
          if (!ended.changed) return;
          closeSetupTracking(callId, { failed: true, reason: "canceled" });
          callTransitionLog(callId, prevState, "ended", { byUserId: userId, reason: "cancel" });
          console.log("[calls] call.cancel", { callId, userId });
          if (target) {
            sendToUserForCall(target, callId, { type: "call.canceled", callId, byUserId: userId });
          }
          return;
        }

        // ── call.hangup ─────────────────────────────────────────
        if (type === "call.hangup") {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const target = getOtherParticipant(callId, userId);
          const prevState = session.state;
          const ended = endSession(callId, userId, "ended", "hangup");
          if (!ended.changed) return;
          closeSetupTracking(callId, { failed: true, reason: "hungup" });
          callTransitionLog(callId, prevState, "ended", { byUserId: userId, reason: "hangup" });
          console.log("[calls] call.hangup", { callId, userId });
          if (target) {
            sendToUserForCall(target, callId, { type: "call.hungup", callId, byUserId: userId });
          }
          return;
        }

        // ── call.resume-request ────────────────────────────────
        if (type === "call.resume-request") {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const target = getOtherParticipant(callId, userId);
          if (!target) return;
          sendToUserForCall(target, callId, { type: "call.peer-reconnected", callId, byUserId: userId });
          return;
        }

        // ── call.connected (двустороннее подтверждение media-connected) ───────
        if (type === "call.connected") {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const marked = markParticipantConnected(callId, userId);
          if (!marked.session || !marked.changed) return;
          callsReliabilityMetrics.setupFunnel.connected += 1;
          markSetupStage(callId, "connected");
          const target = getOtherParticipant(callId, userId);
          sendToUserForCall(userId, callId, { type: "call.connected", callId, byUserId: userId, confirmedByBoth: marked.bothConnected });
          if (target) {
            sendToUserForCall(target, callId, { type: "call.connected", callId, byUserId: userId, confirmedByBoth: marked.bothConnected });
          }
          console.log("[calls] call.connected", {
            callId,
            byUserId: userId,
            bothConnected: marked.bothConnected,
            state: marked.session.state,
          });
          return;
        }

        // ── call.offer / call.answer / call.ice-candidate / extensions ───────
        if (
          type === "call.offer" ||
          type === "call.answer" ||
          type === "call.ice-candidate" ||
          type === "call.reaction" ||
          type === "call.caption" ||
          type === "call.screen-share-state"
        ) {
          if (!session || !isParticipant(callId, userId)) return;
          bindCallRoute(userId, callId, ws);
          const target = getOtherParticipant(callId, userId);
          if (!target) return;
          if (type === "call.offer") callsReliabilityMetrics.setupFunnel.offerForwarded += 1;
          if (type === "call.answer") callsReliabilityMetrics.setupFunnel.answerForwarded += 1;
          if (type === "call.ice-candidate") callsReliabilityMetrics.setupFunnel.iceForwarded += 1;
          const forwarded: Record<string, unknown> = { ...parsed, fromUserId: userId };
          delete forwarded.targetUserId;
          sendToUserForCall(target, callId, forwarded);
          debugCall(type + "-forwarded", { callId, from: userId, to: target });
          return;
        }
      } catch (e) {
        sendToUser(userId, {
          type: "call.error",
          code: "bad_payload",
          message: "Некорректный формат события",
        });
        if (typeof raw === "string" && raw.length < 500) {
          console.warn("[calls] invalid JSON from user:", userId, raw.slice(0, 200));
        } else {
          console.warn("[calls] invalid JSON from user:", userId, "(too long or binary)");
        }
      }
        });
    });

    ws.on("close", (code: number, reasonRaw: Buffer) => {
      clearRoutesForSocket(ws);
      delete ws.pendingChatReadByChatId;
      removeConnection(ws);
      const reason = (() => {
        if (code === 1000) return "normal";
        if (code === 4001) return "superseded";
        if (code === 1008 || code === 4401 || code === 4003) return "policy_or_auth";
        if (code === 1006) return "abnormal_or_network";
        return "other";
      })();
      callsReliabilityMetrics.wsReconnectReason[reason] += 1;
      pushRecentCallEvent("ws.closed", undefined, { userId, code, reason });
      console.log("[calls] ws closed", {
        userId,
        code,
        reasonText: reasonRaw?.toString?.("utf8") ?? "",
        classifiedReason: reason,
      });
      const set = socketsByUser.get(userId);
      let hasOtherActive = false;
      if (set) {
        set.delete(ws);
        hasOtherActive = Array.from(set.values()).some((s) => s.readyState === 1);
        if (set.size === 0) socketsByUser.delete(userId);
      }

      if (hasOtherActive) return;
      clearDisconnectCleanupTimer(userId);
      disconnectCleanupTimers.set(userId, setTimeout(() => {
        disconnectCleanupTimers.delete(userId);
        if (getOpenUserSockets(userId).length > 0) return;
        const session = getActiveCallForUser(userId);
        if (!session) return;
        const callId = session.callId;
        const target = getOtherParticipant(callId, userId);
        const prevState = session.state;
        const wasRinging = session.state === "ringing";
        const ended = endSession(callId, userId, "ended", "connection_lost");
        if (!ended.changed) return;
        closeSetupTracking(callId, { failed: true, reason: "disconnect_timeout" });
        callTransitionLog(callId, prevState, "ended", {
          byUserId: userId,
          reason: "disconnect-timeout",
          graceMs: DISCONNECT_GRACE_MS,
        });
        console.log("[calls] call ended (disconnect timeout)", { callId, disconnectedUser: userId, graceMs: DISCONNECT_GRACE_MS });

        if (target) {
          sendToUserForCall(target, callId, { type: "call.hungup", callId, byUserId: userId });
        }
        if (wasRinging) {
          recordMissedCall(session.chatId, session.callerId, session.calleeId, session.mediaType === "video")
            .catch((e) => console.error("[calls] recordMissedCall:", e));
        }
      }, DISCONNECT_GRACE_MS));
    });
  });
}
