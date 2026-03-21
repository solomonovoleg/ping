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
  getOtherParticipant,
  setRingTimer,
  RING_TIMEOUT_MS,
} from "./session";
import { isUserInGroupCall } from "../group-calls/room-runtime";

type WsWithUserId = WebSocket & { userId?: string; isAlive?: boolean };

/** userId -> Set of WebSocket */
const socketsByUser = new Map<string, Set<WsWithUserId>>();
const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DISCONNECT_GRACE_MS = numEnv("CALLS_DISCONNECT_GRACE_MS", 25_000);

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

function clearDisconnectCleanupTimer(userId: string): void {
  const t = disconnectCleanupTimers.get(userId);
  if (!t) return;
  clearTimeout(t);
  disconnectCleanupTimers.delete(userId);
}

export type ChatListUpdateOptions = {
  /** Подсказка клиенту: воспроизвести звук входящего, если чат не открыт (в т.ч. до подписки на новый чат). */
  incomingMessage?: { chatId: string; senderId: string };
};

/** Notify a user that their chat list changed (new chat, etc.) */
export function notifyChatListUpdate(userId: string, options?: ChatListUpdateOptions): void {
  const payload: Record<string, unknown> = { type: "chat-list-update" };
  if (options?.incomingMessage) {
    payload.incomingMessage = options.incomingMessage;
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
    getUserSockets(userId).add(ws);
    console.log("[calls] ws connected", { userId, totalSockets: getOpenUserSockets(userId).length });
    storage.updateUserLastSeen(userId).catch(() => {});
    const activeSession = getActiveCallForUser(userId);
    if (activeSession) {
      const otherUserId = activeSession.callerId === userId ? activeSession.calleeId : activeSession.callerId;
      const direction = activeSession.callerId === userId ? "outgoing" : "incoming";
      const shouldInitiateOffer = direction === "outgoing";
      Promise.resolve(storage.getUser(otherUserId))
        .then((otherUser) => {
          if (ws.readyState !== 1) return;
          ws.send(JSON.stringify({
            type: "call.resume-available",
            callId: activeSession.callId,
            chatId: activeSession.chatId,
            mediaType: activeSession.mediaType,
            otherUserId,
            otherDisplayName: otherUser?.displayName || otherUser?.phone || "Абонент",
            direction,
            shouldInitiateOffer,
          }));
          sendToUser(otherUserId, { type: "call.peer-reconnected", callId: activeSession.callId, byUserId: userId });
        })
        .catch(() => {});
    }

    ws.on("message", async (raw: Buffer | string) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const type = parsed.type as string | undefined;

        // ── Chat subscriptions (shared transport) ───────────────
        if (type === "subscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            addSubscription(chatId, ws);
            storage.getChatMemberIds(chatId).then((members) => {
              if (!members.includes(userId)) removeSubscription(chatId, ws);
            }).catch(() => removeSubscription(chatId, ws));
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
          const direction = sessionForUser.callerId === userId ? "outgoing" : "incoming";
          const shouldInitiateOffer = direction === "outgoing";
          const otherUser = await storage.getUser(otherUserId);
          ws.send(JSON.stringify({
            type: "call.resume-available",
            callId: sessionForUser.callId,
            chatId: sessionForUser.chatId,
            mediaType: sessionForUser.mediaType,
            otherUserId,
            otherDisplayName: otherUser?.displayName || otherUser?.phone || "Абонент",
            direction,
            shouldInitiateOffer,
          }));
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

          const targetUser = await storage.getUser(toUserId);
          if (!targetUser) {
            sendToUser(userId, { type: "call.error", callId, code: "user_not_found", message: "Пользователь не найден" });
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

          if (isUserInActiveCall(userId)) {
            sendToUser(userId, { type: "call.error", callId, code: "already_in_call", message: "Вы уже в звонке" });
            return;
          }

          if (isUserInGroupCall(userId)) {
            sendToUser(userId, { type: "call.error", callId, code: "in_group_call", message: "Сначала выйдите из группового созвона" });
            return;
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
            endSession(callId, undefined, "missed");
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
          if (!acceptSession(callId)) return;

          console.log("[calls] call.accept", { callId, calleeId: userId, callerId: session.callerId });

          sendToUser(session.callerId, { type: "call.accepted", callId, byUserId: userId });

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
          const reason = parsed.reason === "busy" ? "busy" as const : "declined" as const;
          const target = getOtherParticipant(callId, userId);
          endSession(callId, userId, reason === "busy" ? "busy" : "rejected");
          console.log("[calls] call.reject", { callId, userId, reason });
          if (target) {
            sendToUser(target, { type: "call.rejected", callId, byUserId: userId, reason });
          }
          return;
        }

        // ── call.cancel ─────────────────────────────────────────
        if (type === "call.cancel") {
          if (!session || !isParticipant(callId, userId)) return;
          const target = getOtherParticipant(callId, userId);
          endSession(callId, userId, "ended");
          console.log("[calls] call.cancel", { callId, userId });
          if (target) {
            sendToUser(target, { type: "call.canceled", callId, byUserId: userId });
          }
          return;
        }

        // ── call.hangup ─────────────────────────────────────────
        if (type === "call.hangup") {
          if (!session || !isParticipant(callId, userId)) return;
          const target = getOtherParticipant(callId, userId);
          endSession(callId, userId, "ended");
          console.log("[calls] call.hangup", { callId, userId });
          if (target) {
            sendToUser(target, { type: "call.hungup", callId, byUserId: userId });
          }
          return;
        }

        // ── call.resume-request ────────────────────────────────
        if (type === "call.resume-request") {
          if (!session || !isParticipant(callId, userId)) return;
          const target = getOtherParticipant(callId, userId);
          if (!target) return;
          sendToUser(target, { type: "call.peer-reconnected", callId, byUserId: userId });
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
          const target = getOtherParticipant(callId, userId);
          if (!target) return;
          const forwarded: Record<string, unknown> = { ...parsed, fromUserId: userId };
          delete forwarded.targetUserId;
          sendToUser(target, forwarded);
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

    ws.on("close", () => {
      removeConnection(ws);
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
        endSession(callId, userId, "ended");
        console.log("[calls] call ended (disconnect timeout)", { callId, disconnectedUser: userId, graceMs: DISCONNECT_GRACE_MS });

        if (target) {
          sendToUser(target, { type: "call.hungup", callId, byUserId: userId });
        }
        if (session.state === "ringing") {
          recordMissedCall(session.chatId, session.callerId, session.calleeId, session.mediaType === "video")
            .catch((e) => console.error("[calls] recordMissedCall:", e));
        }
      }, DISCONNECT_GRACE_MS));
    });
  });
}
