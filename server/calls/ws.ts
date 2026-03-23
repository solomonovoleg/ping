import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { CALL_WS_SUBPROTOCOL, resolveCallHandshakeToken } from "@shared/ws-call-handshake";
import { consumeCallToken } from "./token";
import { sendPushToUser } from "../push/send";
import { recordMissedCall } from "./missed";
import { addSubscription, removeSubscription, removeConnection, getChatSubscribers } from "../realtime/chat";
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

type WsWithUserId = WebSocket & { userId?: string; isAlive?: boolean; messageChain?: Promise<void> };

/** userId -> Set of WebSocket */
const socketsByUser = new Map<string, Set<WsWithUserId>>();
const callRouteByUserAndCall = new Map<string, WsWithUserId>();
const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
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
  const raw = JSON.stringify(data);
  set.forEach((ws) => ws.send(raw));
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
  const routed = callRouteByUserAndCall.get(callRouteKey(userId, callId));
  const raw = JSON.stringify(data);
  if (routed && routed.readyState === 1) {
    routed.send(raw);
    return;
  }
  const set = getOpenUserSockets(userId);
  set.forEach((ws) => ws.send(raw));
}

function callTransitionLog(callId: string, from: CallSessionState, to: CallSessionState, meta?: Record<string, unknown>): void {
  callsReliabilityMetrics.callStateTransition.total += 1;
  if (to === "connected") callsReliabilityMetrics.callStateTransition.toConnected += 1;
  if (to === "ended") callsReliabilityMetrics.callStateTransition.toEnded += 1;
  if (to === "missed") callsReliabilityMetrics.callStateTransition.toMissed += 1;
  if (to === "failed") callsReliabilityMetrics.callStateTransition.toFailed += 1;
  console.log("[calls] call.state-transition", { callId, from, to, ...(meta ?? {}) });
}

export function getCallsReliabilityMetrics(): {
  wsReconnectReason: typeof callsReliabilityMetrics.wsReconnectReason;
  callStateTransition: typeof callsReliabilityMetrics.callStateTransition;
} {
  return {
    wsReconnectReason: { ...callsReliabilityMetrics.wsReconnectReason },
    callStateTransition: { ...callsReliabilityMetrics.callStateTransition },
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
    storage.updateUserLastSeen(userId).catch(() => {});
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

        // ── Chat subscriptions (shared transport) ───────────────
        if (type === "subscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (!chatId) return;
          // Только после проверки членства — иначе гонка: сообщения успевают уйти подписчику до removeSubscription.
          try {
            const members = await storage.getChatMemberIds(chatId);
            if (!members.includes(userId)) return;
            addSubscription(chatId, ws);
          } catch {
            // чат не найден / ошибка БД — не подписываем
          }
          return;
        }
        if (type === "unsubscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) removeSubscription(chatId, ws);
          return;
        }
        if (type === "typing") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            const subs = getChatSubscribers(chatId);
            const payload = JSON.stringify({
              type: "typing", chatId, userId,
              displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
            });
            subs.forEach((w) => { if (w !== ws && w.readyState === 1) w.send(payload); });
          }
          return;
        }
        if (type === "voice-recording") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          const recording = parsed.recording === true;
          if (chatId) {
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
              return;
            }
            sendToUser(userId, { type: "call.rejected", callId, byUserId: toUserId, reason: "busy" });
            return;
          }

          const session = createSession({ callId, callerId: userId, calleeId: toUserId, chatId, mediaType, callerDisplayName: fromDisplayName });
          debugCall("call.invite", { callId, from: userId, to: toUserId, chatId, mediaType });

          const calleeSockets = getOpenUserSockets(toUserId);
          if (calleeSockets.length === 0) {
            sendPushToUser(toUserId, "Вам звонит " + fromDisplayName, "Откройте приложение, чтобы ответить").catch(() => {});
          }

          sendToUser(toUserId, {
            type: "call.incoming", callId, fromUserId: userId, chatId, mediaType, fromDisplayName, fromAvatarUrl,
          });

          const ringTimer = setTimeout(() => {
            const s = getSession(callId);
            if (!s || s.state !== "ringing") return;
            const ended = endSession(callId, undefined, "missed", "timeout");
            if (!ended.changed) return;
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
          const forwarded: Record<string, unknown> = { ...parsed, fromUserId: userId };
          delete forwarded.targetUserId;
          sendToUserForCall(target, callId, forwarded);
          debugCall(type + "-forwarded", { callId, from: userId, to: target });
          return;
        }
      } catch (e) {
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
      removeConnection(ws);
      const reason = (() => {
        if (code === 1000) return "normal";
        if (code === 4001) return "superseded";
        if (code === 1008 || code === 4401 || code === 4003) return "policy_or_auth";
        if (code === 1006) return "abnormal_or_network";
        return "other";
      })();
      callsReliabilityMetrics.wsReconnectReason[reason] += 1;
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
