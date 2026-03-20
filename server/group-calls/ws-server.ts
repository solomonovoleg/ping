import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { consumeCallToken } from "../calls/token";
import {
  finishCallHistory,
  joinCallHistoryParticipant,
  leaveCallHistoryParticipant,
  upsertTranscriptSegment,
} from "../call-transcripts/service";
import { isServerAsrEnabled, transcribeAudioChunk } from "../call-transcripts/asr-provider";
import {
  closeStreamingAsrRoom,
  closeStreamingAsrSession,
  pushStreamingAsrChunk,
} from "../call-transcripts/asr-stream-registry";
import { isStreamingAsrEnabled } from "../call-transcripts/asr-stream-session";
import { storage } from "../storage";
import { isGroupCallsServerEnabled } from "./flags";
import {
  getRoom,
  roomAttachUser,
  roomDetachUser,
  rosterPayload,
  getGroupRoomIdForUser,
} from "./room-runtime";

type WsG = WebSocket & { userId?: string; roomId?: string; isAlive?: boolean };

const socketsByUser = new Map<string, Set<WsG>>();

function getOpenUserSockets(userId: string): WsG[] {
  const set = socketsByUser.get(userId);
  if (!set) return [];
  const list: WsG[] = [];
  set.forEach((ws) => {
    if (ws.readyState === 1) list.push(ws);
    else if (ws.readyState === 2 || ws.readyState === 3) set.delete(ws);
  });
  if (set.size === 0) socketsByUser.delete(userId);
  return list;
}

function sendToUser(userId: string, data: Record<string, unknown>): void {
  const raw = JSON.stringify(data);
  getOpenUserSockets(userId).forEach((ws) => {
    try {
      ws.send(raw);
    } catch { /* ignore */ }
  });
}

function broadcastRoom(roomId: string, data: Record<string, unknown>, exceptUserId?: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  const raw = JSON.stringify(data);
  room.connected.forEach((uid) => {
    if (uid === exceptUserId) return;
    getOpenUserSockets(uid).forEach((ws) => {
      try {
        ws.send(raw);
      } catch { /* ignore */ }
    });
  });
}

function addUserSocket(userId: string, ws: WsG): void {
  let set = socketsByUser.get(userId);
  if (!set) {
    set = new Set();
    socketsByUser.set(userId, set);
  }
  set.add(ws);
}

export function attachGroupCallTransport(httpServer: HttpServer): void {
  if (!isGroupCallsServerEnabled()) return;

  const wss = new WebSocketServer({ noServer: true });
  const HEARTBEAT_MS = 30_000;

  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WsG;
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch { /* ignore */ }
        return;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        try {
          ws.terminate();
        } catch { /* ignore */ }
      }
    });
  }, HEARTBEAT_MS);
  wss.on("close", () => clearInterval(heartbeatTimer));

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "", `http://${request.headers.host}`);
    if (url.pathname !== "/group-calls") return;
    const token = url.searchParams.get("token");
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    const userId = consumeCallToken(token);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, userId);
    });
  });

  wss.on("connection", (ws: WsG, _req: IncomingMessage, userId: string) => {
    ws.userId = userId;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    addUserSocket(userId, ws);

    ws.on("message", async (raw: Buffer | string) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const type = parsed.type as string | undefined;

        if (type === "group.join") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : "";
          const displayName =
            typeof parsed.displayName === "string" && parsed.displayName.trim()
              ? parsed.displayName.trim().slice(0, 120)
              : "Участник";
          if (!roomId) return;

          const room = getRoom(roomId);
          if (!room) {
            ws.send(JSON.stringify({ type: "group.error", code: "room_not_found", message: "Комната не найдена" }));
            return;
          }
          const members = await storage.getChatMemberIds(room.chatId);
          if (!members.includes(userId)) {
            ws.send(JSON.stringify({ type: "group.error", code: "not_in_chat", message: "Нет доступа к чату" }));
            return;
          }

          const alreadyRoom = getGroupRoomIdForUser(userId);
          if (alreadyRoom && alreadyRoom !== roomId) {
            ws.send(JSON.stringify({ type: "group.error", code: "already_in_group", message: "Уже в другом созвоне" }));
            return;
          }

          const prevAttached = ws.roomId;
          if (prevAttached && prevAttached !== roomId) {
            roomDetachUser(prevAttached, userId);
            const rPrev = getRoom(prevAttached);
            if (rPrev) {
              broadcastRoom(prevAttached, { type: "group.roster", ...rosterPayload(rPrev) });
            }
          }

          const result = roomAttachUser(roomId, userId, displayName);
          if (!result.ok) {
            ws.send(JSON.stringify({ type: "group.error", code: result.code, message: result.message }));
            return;
          }
          ws.roomId = roomId;
          await joinCallHistoryParticipant(roomId, userId, displayName);

          const payload = rosterPayload(result.room);
          result.room.connected.forEach((uid) => {
            sendToUser(uid, { type: "group.roster", ...payload });
          });
          return;
        }

        if (type === "group.leave") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : ws.roomId;
          if (!roomId || !ws.userId) return;
          roomDetachUser(roomId, ws.userId);
          ws.roomId = undefined;
          closeStreamingAsrSession(roomId, ws.userId);
          await leaveCallHistoryParticipant(roomId, ws.userId);
          const roomAfter = getRoom(roomId);
          if (roomAfter) {
            broadcastRoom(roomId, { type: "group.roster", ...rosterPayload(roomAfter) });
          } else {
            closeStreamingAsrRoom(roomId);
            await finishCallHistory(roomId);
          }
          return;
        }

        if (type === "group.transcript-segment") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : "";
          if (!roomId || !ws.userId || ws.roomId !== roomId) return;
          const room = getRoom(roomId);
          if (!room || !room.connected.has(ws.userId)) return;
          const segmentId = typeof parsed.segmentId === "string" ? parsed.segmentId : "";
          const text = typeof parsed.text === "string" ? parsed.text : "";
          if (!segmentId || !text.trim()) return;
          const result = await upsertTranscriptSegment({
            id: segmentId,
            callId: roomId,
            speakerUserId: ws.userId,
            speakerDisplayName: room.displayNameByUser.get(ws.userId) || "Участник",
            sourceStreamId: typeof parsed.sourceStreamId === "string" ? parsed.sourceStreamId : null,
            language: typeof parsed.language === "string" ? parsed.language : "ru-RU",
            text,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
            startedAtMs: typeof parsed.startedAtMs === "number" ? parsed.startedAtMs : 0,
            endedAtMs: typeof parsed.endedAtMs === "number" ? parsed.endedAtMs : 0,
            isFinal: parsed.isFinal === true,
          });
          broadcastRoom(roomId, {
            type: "group.transcript-segment",
            segment: {
              ...result.segment,
              createdAt: result.segment.createdAt.toISOString(),
              updatedAt: result.segment.updatedAt.toISOString(),
            },
          });
          if (result.suggestion) {
            broadcastRoom(roomId, {
              type: "group.command-suggestion",
              suggestion: {
                ...result.suggestion,
                createdAt: result.suggestion.createdAt.toISOString(),
                resolvedAt: result.suggestion.resolvedAt?.toISOString() ?? null,
              },
            });
          }
          return;
        }

        if (type === "group.asr-pcm") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : "";
          if (!roomId || !ws.userId || ws.roomId !== roomId || !isStreamingAsrEnabled()) return;
          const room = getRoom(roomId);
          if (!room || !room.connected.has(ws.userId)) return;
          const audioBase64 = typeof parsed.audioBase64 === "string" ? parsed.audioBase64 : "";
          if (!audioBase64) return;
          pushStreamingAsrChunk({
            callId: roomId,
            userId: ws.userId,
            language: typeof parsed.language === "string" ? parsed.language : "ru-RU",
            audioBase64,
            onTranscript: async ({ segmentId, isFinal, text, confidence }) => {
              const result = await upsertTranscriptSegment({
                id: segmentId,
                callId: roomId,
                speakerUserId: ws.userId!,
                speakerDisplayName: room.displayNameByUser.get(ws.userId!) || "Участник",
                sourceStreamId: "streaming-asr",
                language: typeof parsed.language === "string" ? parsed.language : "ru-RU",
                text,
                confidence,
                startedAtMs: typeof parsed.startedAtMs === "number" ? parsed.startedAtMs : 0,
                endedAtMs: typeof parsed.endedAtMs === "number" ? parsed.endedAtMs : 0,
                isFinal,
              });
              broadcastRoom(roomId, {
                type: "group.transcript-segment",
                segment: {
                  ...result.segment,
                  createdAt: result.segment.createdAt.toISOString(),
                  updatedAt: result.segment.updatedAt.toISOString(),
                },
              });
              if (result.suggestion) {
                broadcastRoom(roomId, {
                  type: "group.command-suggestion",
                  suggestion: {
                    ...result.suggestion,
                    createdAt: result.suggestion.createdAt.toISOString(),
                    resolvedAt: result.suggestion.resolvedAt?.toISOString() ?? null,
                  },
                });
              }
            },
          });
          return;
        }

        if (type === "group.asr-audio") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : "";
          if (!roomId || !ws.userId || ws.roomId !== roomId || !isServerAsrEnabled()) return;
          const room = getRoom(roomId);
          if (!room || !room.connected.has(ws.userId)) return;
          const audioBase64 = typeof parsed.audioBase64 === "string" ? parsed.audioBase64 : "";
          if (!audioBase64) return;
          const asr = await transcribeAudioChunk({
            audioBase64,
            mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : "audio/webm",
            language: typeof parsed.language === "string" ? parsed.language : "ru-RU",
            callId: roomId,
            speakerUserId: ws.userId,
          });
          if (!asr) return;
          const result = await upsertTranscriptSegment({
            id: typeof parsed.segmentId === "string" && parsed.segmentId ? parsed.segmentId : randomUUID(),
            callId: roomId,
            speakerUserId: ws.userId,
            speakerDisplayName: room.displayNameByUser.get(ws.userId) || "Участник",
            sourceStreamId: typeof parsed.sourceStreamId === "string" ? parsed.sourceStreamId : null,
            language: typeof parsed.language === "string" ? parsed.language : "ru-RU",
            text: asr.text,
            confidence: asr.confidence,
            startedAtMs: typeof parsed.startedAtMs === "number" ? parsed.startedAtMs : 0,
            endedAtMs: typeof parsed.endedAtMs === "number" ? parsed.endedAtMs : 0,
            isFinal: true,
          });
          broadcastRoom(roomId, {
            type: "group.transcript-segment",
            segment: {
              ...result.segment,
              createdAt: result.segment.createdAt.toISOString(),
              updatedAt: result.segment.updatedAt.toISOString(),
            },
          });
          if (result.suggestion) {
            broadcastRoom(roomId, {
              type: "group.command-suggestion",
              suggestion: {
                ...result.suggestion,
                createdAt: result.suggestion.createdAt.toISOString(),
                resolvedAt: result.suggestion.resolvedAt?.toISOString() ?? null,
              },
            });
          }
          return;
        }

        if (type === "group.signal") {
          const roomId = typeof parsed.roomId === "string" ? parsed.roomId : "";
          const toUserId = typeof parsed.toUserId === "string" ? parsed.toUserId : "";
          if (!roomId || !toUserId || !ws.userId || ws.roomId !== roomId) return;
          const room = getRoom(roomId);
          if (!room || !room.connected.has(ws.userId) || !room.connected.has(toUserId)) return;

          const forward: Record<string, unknown> = {
            type: "group.signal",
            roomId,
            fromUserId: ws.userId,
            signalType: parsed.signalType,
            sdp: parsed.sdp,
            candidate: parsed.candidate,
          };
          sendToUser(toUserId, forward);
          return;
        }
      } catch {
        /* invalid json */
      }
    });

    ws.on("close", () => {
      const uid = ws.userId;
      const roomId = ws.roomId;
      if (uid) {
        const set = socketsByUser.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) socketsByUser.delete(uid);
        }
      }
      if (uid && roomId) {
        roomDetachUser(roomId, uid);
        closeStreamingAsrSession(roomId, uid);
        void leaveCallHistoryParticipant(roomId, uid);
        const roomAfter = getRoom(roomId);
        if (roomAfter) {
          broadcastRoom(roomId, { type: "group.roster", ...rosterPayload(roomAfter) });
        } else {
          closeStreamingAsrRoom(roomId);
          void finishCallHistory(roomId);
        }
      }
    });
  });
}
