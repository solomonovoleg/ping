import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { consumeCallToken } from "./token";
import { sendPushToUser } from "../push/send";
import { recordMissedCall } from "./missed";
import { addSubscription, removeSubscription, removeConnection, getChatSubscribers } from "../realtime/chat";
import { storage } from "../storage";

type WsWithUserId = WebSocket & { userId?: string; isAlive?: boolean };

/** userId -> Set of WebSocket */
const socketsByUser = new Map<string, Set<WsWithUserId>>();

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Входящий звонок для абонента не в сети: доставляем при подключении (как в VK/WhatsApp). */
const PENDING_CALL_TTL_MS = numEnv("CALLS_PENDING_TTL_MS", 60 * 1000);
type PendingCall = {
  fromUserId: string;
  fromDisplayName: string;
  chatId: string;
  video: boolean;
  offer: RTCSessionDescriptionInit | null;
  expiresAt: number;
};
const pendingCallsByCallee = new Map<string, PendingCall>();

/** Таймаут ответа на звонок: если не ответил — пропущенный звонок. В sync с клиентом (VITE_CALLS_RING_TIMEOUT_MS). */
const RING_TIMEOUT_MS = numEnv("CALLS_RING_TIMEOUT_MS", 30 * 1000);
type RingingCall = { callerId: string; calleeId: string; chatId: string; video: boolean; timer: ReturnType<typeof setTimeout> };
const ringingByCallee = new Map<string, RingingCall>();

/** Звонящий ждёт, пока абонент офлайн. Если за это время абонент не зашёл — шлём target-offline. */
const CALLER_WAIT_MS = numEnv("CALLS_CALLER_WAIT_MS", 60 * 1000);
type CallerWait = { calleeId: string; chatId: string; video: boolean; timer: ReturnType<typeof setTimeout> };
const callerWaitByCaller = new Map<string, CallerWait>();

function pruneExpiredPending(): void {
  const now = Date.now();
  Array.from(pendingCallsByCallee.entries()).forEach(([userId, p]) => {
    if (p.expiresAt < now) pendingCallsByCallee.delete(userId);
  });
}

export type CallSignalingMessage =
  | { type: "call-initiate"; video: boolean; chatId: string; fromUserId: string; fromDisplayName?: string }
  | { type: "call-accept"; video: boolean; fromUserId: string }
  | { type: "call-reject"; fromUserId: string }
  | { type: "call-end"; fromUserId: string }
  | { type: "target-offline"; fromUserId: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; fromUserId: string }
  | { type: "chat-list-update" };

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

function sendToUser(userId: string, data: CallSignalingMessage): void {
  const set = getOpenUserSockets(userId);
  const raw = JSON.stringify(data);
  set.forEach((ws) => ws.send(raw));
}

/** Уведомить пользователя, что список чатов изменился (новый чат и т.д.) — получатель обновит список в реальном времени. */
export function notifyChatListUpdate(userId: string): void {
  sendToUser(userId, { type: "chat-list-update" });
}

export function attachCallWebSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const HEARTBEAT_MS = numEnv("CALLS_WS_HEARTBEAT_MS", 30 * 1000);
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WsWithUserId;
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {}
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        try {
          ws.terminate();
        } catch {}
      }
    });
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(heartbeatTimer));

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    if (url.pathname !== "/calls") return;
    const token = url.searchParams.get("token");
    if (!token) {
      console.warn("[calls] upgrade rejected: no token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const userId = consumeCallToken(token);
    if (!userId) {
      console.warn("[calls] upgrade rejected: invalid or used token");
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
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    getUserSockets(userId).add(ws);
    console.log("[calls] ws connected", { userId, totalSocketsForUser: getOpenUserSockets(userId).length });
    storage.updateUserLastSeen(userId).catch(() => {});

    pruneExpiredPending();
    const pending = pendingCallsByCallee.get(userId);
    if (pending && pending.expiresAt > Date.now()) {
      const callerId = pending.fromUserId;
      const calleeId = userId;
      pendingCallsByCallee.delete(userId);
      const wait = callerWaitByCaller.get(callerId);
      if (wait) {
        clearTimeout(wait.timer);
        callerWaitByCaller.delete(callerId);
      }
      const timer = setTimeout(() => {
        ringingByCallee.delete(calleeId);
        recordMissedCall(pending.chatId, callerId, calleeId, pending.video).catch((e) => console.error("[calls] recordMissedCall:", e));
        sendToUser(callerId, { type: "call-end", fromUserId: calleeId });
      }, RING_TIMEOUT_MS);
      ringingByCallee.set(calleeId, { callerId, calleeId, chatId: pending.chatId, video: pending.video, timer });
      sendToUser(userId, {
        type: "call-initiate",
        video: pending.video,
        chatId: pending.chatId,
        fromUserId: pending.fromUserId,
        fromDisplayName: pending.fromDisplayName,
      });
      if (pending.offer) {
        sendToUser(userId, { type: "offer", fromUserId: pending.fromUserId, sdp: pending.offer });
      }
    }

    ws.on("message", async (raw: Buffer | string) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as Record<string, unknown> & { targetUserId?: string; type?: string; fromDisplayName?: string; chatId?: string };
        if (parsed.type === "subscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            addSubscription(chatId, ws);
            storage.getChatMemberIds(chatId).then((members) => {
              if (!members.includes(userId)) removeSubscription(chatId, ws);
            }).catch(() => removeSubscription(chatId, ws));
          }
          return;
        }
        if (parsed.type === "unsubscribe-chat") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) removeSubscription(chatId, ws);
          return;
        }
        if (parsed.type === "typing") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            const subs = getChatSubscribers(chatId);
            const payload = JSON.stringify({
              type: "typing",
              chatId,
              userId,
              displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
            });
            subs.forEach((w) => {
              if (w !== ws && w.readyState === 1) w.send(payload);
            });
          }
          return;
        }
        if (parsed.type === "voice-recording") {
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          const recording = parsed.recording === true;
          if (chatId) {
            const subs = getChatSubscribers(chatId);
            const payload = JSON.stringify({
              type: "voice-recording",
              chatId,
              userId,
              displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
              recording,
            });
            subs.forEach((w) => {
              if (w !== ws && w.readyState === 1) w.send(payload);
            });
          }
          return;
        }
        const targetUserId = parsed.targetUserId;
        if (!targetUserId || targetUserId === userId) return;
        const fromUserId = ws.userId ?? userId;

        if (parsed.type === "call-initiate") {
          const targetUser = await storage.getUser(targetUserId);
          if (!targetUser) {
            console.warn("[calls] call-initiate to unknown user:", targetUserId);
            return;
          }
          const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
          if (chatId) {
            const memberIds = await storage.getChatMemberIds(chatId);
            const bothInChat = memberIds.includes(fromUserId) && memberIds.includes(targetUserId);
            if (!bothInChat) {
              console.warn("[calls] call-initiate: caller or callee not in chat", { chatId, fromUserId, targetUserId });
              sendToUser(fromUserId, { type: "call-end", fromUserId: targetUserId });
              return;
            }
          }
          parsed.fromUserId = fromUserId;
          delete parsed.targetUserId;
          const calleeSockets = getOpenUserSockets(targetUserId);
          const calleeOnline = calleeSockets.length > 0;
          console.log("[calls] call-initiate", { from: fromUserId, to: targetUserId, calleeOnline, calleeSocketsCount: calleeSockets.length });
          if (!calleeOnline) {
            const callerName = typeof parsed.fromDisplayName === "string" && parsed.fromDisplayName.trim() ? parsed.fromDisplayName.trim() : "Абонент";
            const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
            const video = Boolean(parsed.video);
            pendingCallsByCallee.set(targetUserId, {
              fromUserId,
              fromDisplayName: callerName,
              chatId,
              video,
              offer: null,
              expiresAt: Date.now() + PENDING_CALL_TTL_MS,
            });
            sendPushToUser(targetUserId, "Вам звонит " + callerName, "Откройте приложение, чтобы ответить").catch(() => {});
            const waitTimer = setTimeout(() => {
              callerWaitByCaller.delete(fromUserId);
              pendingCallsByCallee.delete(targetUserId);
              sendToUser(fromUserId, { type: "target-offline", fromUserId: targetUserId });
              recordMissedCall(chatId, fromUserId, targetUserId, video).catch((e) => console.error("[calls] recordMissedCall:", e));
            }, CALLER_WAIT_MS);
            callerWaitByCaller.set(fromUserId, { calleeId: targetUserId, chatId, video, timer: waitTimer });
          } else {
            const callerName = typeof parsed.fromDisplayName === "string" && parsed.fromDisplayName.trim() ? parsed.fromDisplayName.trim() : "Абонент";
            const chatId = typeof parsed.chatId === "string" ? parsed.chatId : "";
            const video = Boolean(parsed.video);
            // Даже если абонент "онлайн", сохраняем pending на время ringing:
            // если его сокет кратко отвалится, звонок можно доставить после reconnect.
            pendingCallsByCallee.set(targetUserId, {
              fromUserId,
              fromDisplayName: callerName,
              chatId,
              video,
              offer: null,
              expiresAt: Date.now() + RING_TIMEOUT_MS,
            });
            const existing = ringingByCallee.get(targetUserId);
            if (existing) {
              clearTimeout(existing.timer);
              ringingByCallee.delete(targetUserId);
            }
            const timer = setTimeout(() => {
              ringingByCallee.delete(targetUserId);
              pendingCallsByCallee.delete(targetUserId);
              console.log("[calls] call-end (ring timeout)", { callerId: fromUserId, calleeId: targetUserId });
              recordMissedCall(chatId, fromUserId, targetUserId, video).catch((e) => console.error("[calls] recordMissedCall:", e));
              sendToUser(fromUserId, { type: "call-end", fromUserId: targetUserId });
              sendToUser(targetUserId, { type: "call-end", fromUserId: fromUserId });
            }, RING_TIMEOUT_MS);
            ringingByCallee.set(targetUserId, { callerId: fromUserId, calleeId: targetUserId, chatId, video, timer });
            sendToUser(targetUserId, parsed as CallSignalingMessage);
          }
          return;
        }

        parsed.fromUserId = fromUserId;
        delete parsed.targetUserId;
        const calleeSockets = getOpenUserSockets(targetUserId);
        const calleeOnline = calleeSockets.length > 0;

        if (parsed.type === "call-accept" || parsed.type === "call-reject" || parsed.type === "call-end") {
          pendingCallsByCallee.delete(userId);
          pendingCallsByCallee.delete(targetUserId);
          const ring = ringingByCallee.get(userId) ?? ringingByCallee.get(targetUserId);
          if (ring && (ring.callerId === userId || ring.callerId === targetUserId)) {
            clearTimeout(ring.timer);
            ringingByCallee.delete(ring.calleeId);
          }
          if (parsed.type === "call-accept") {
            console.log("[calls] call-accept", { calleeId: userId, callerId: targetUserId });
            getUserSockets(userId).forEach((s) => {
              if (s !== ws && s.readyState === 1) {
                s.send(JSON.stringify({ type: "call-end", fromUserId: targetUserId }));
              }
            });
          }
          if (parsed.type === "call-end") {
            console.log("[calls] call-end", { fromUserId: userId, targetUserId });
          }
          sendToUser(targetUserId, parsed as CallSignalingMessage);
        } else if (parsed.type === "offer") {
          const pending = pendingCallsByCallee.get(targetUserId);
          if (pending && pending.fromUserId === fromUserId && pending.expiresAt > Date.now()) {
            pending.offer = parsed.sdp as RTCSessionDescriptionInit;
          }
          if (calleeOnline) {
            console.log("[calls] forwarding offer to", targetUserId);
            sendToUser(targetUserId, parsed as CallSignalingMessage);
          }
        } else if (parsed.type === "answer") {
          console.log("[calls] forwarding answer to", targetUserId);
          sendToUser(targetUserId, parsed as CallSignalingMessage);
        } else {
          sendToUser(targetUserId, parsed as CallSignalingMessage);
        }
      } catch (e) {
        if (typeof raw === "string" && raw.length < 500) {
          console.warn("[calls] invalid JSON from user:", userId, raw.slice(0, 200));
        } else {
          console.warn("[calls] invalid JSON from user:", userId, "(payload too long or binary)");
        }
      }
    });

    ws.on("close", () => {
      removeConnection(ws);
      const set = socketsByUser.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) socketsByUser.delete(userId);
      }

      const ringAsCallee = ringingByCallee.get(userId);
      if (ringAsCallee) {
        clearTimeout(ringAsCallee.timer);
        ringingByCallee.delete(userId);
        pendingCallsByCallee.delete(userId);
        console.log("[calls] call-end (callee disconnected)", { callerId: ringAsCallee.callerId, calleeId: userId });
        sendToUser(ringAsCallee.callerId, { type: "call-end", fromUserId: userId });
      }
      for (const [calleeId, ring] of ringingByCallee.entries()) {
        if (ring.callerId === userId) {
          clearTimeout(ring.timer);
          ringingByCallee.delete(calleeId);
          console.log("[calls] call-end (caller disconnected)", { callerId: userId, calleeId });
          sendToUser(calleeId, { type: "call-end", fromUserId: userId });
          break;
        }
      }
      const wait = callerWaitByCaller.get(userId);
      if (wait) {
        clearTimeout(wait.timer);
        callerWaitByCaller.delete(userId);
        pendingCallsByCallee.delete(wait.calleeId);
      }
    });
  });
}
