import { randomUUID } from "crypto";
import { isUserInActiveCall } from "../calls/session";

export type GroupRoomMedia = "audio" | "video";

export interface GroupRoomLive {
  roomId: string;
  chatId: string;
  mediaType: GroupRoomMedia;
  createdByUserId: string;
  createdAt: number;
  /** WS-подключённые участники */
  connected: Set<string>;
  displayNameByUser: Map<string, string>;
}

const rooms = new Map<string, GroupRoomLive>();
const activeRoomIdByChatId = new Map<string, string>();
/** Пользователь сейчас в групповом созвоне (WS join) */
const userActiveGroupRoom = new Map<string, string>();

export const MAX_GROUP_MESH_PEERS = 12;

export function isUserInGroupCall(userId: string): boolean {
  return userActiveGroupRoom.has(userId);
}

export function getGroupRoomIdForUser(userId: string): string | undefined {
  return userActiveGroupRoom.get(userId);
}

export function getRoom(roomId: string): GroupRoomLive | undefined {
  return rooms.get(roomId);
}

export function getActiveRoomIdForChat(chatId: string): string | undefined {
  const id = activeRoomIdByChatId.get(chatId);
  if (!id) return undefined;
  const r = rooms.get(id);
  if (!r || r.connected.size === 0) {
    activeRoomIdByChatId.delete(chatId);
    return undefined;
  }
  return id;
}

export function createOrReuseRoom(params: {
  chatId: string;
  mediaType: GroupRoomMedia;
  userId: string;
}): { room: GroupRoomLive; reused: boolean } {
  const existingId = activeRoomIdByChatId.get(params.chatId);
  if (existingId) {
    const existing = rooms.get(existingId);
    if (existing && existing.connected.size > 0) {
      return { room: existing, reused: true };
    }
    rooms.delete(existingId);
    activeRoomIdByChatId.delete(params.chatId);
  }

  const roomId = randomUUID();
  const room: GroupRoomLive = {
    roomId,
    chatId: params.chatId,
    mediaType: params.mediaType,
    createdByUserId: params.userId,
    createdAt: Date.now(),
    connected: new Set(),
    displayNameByUser: new Map(),
  };
  rooms.set(roomId, room);
  activeRoomIdByChatId.set(params.chatId, roomId);
  return { room, reused: false };
}

export function removeRoomIfEmpty(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room || room.connected.size > 0) return;
  rooms.delete(roomId);
  if (activeRoomIdByChatId.get(room.chatId) === roomId) {
    activeRoomIdByChatId.delete(room.chatId);
  }
}

export function roomAttachUser(
  roomId: string,
  userId: string,
  displayName: string,
): { ok: true; room: GroupRoomLive } | { ok: false; code: string; message: string } {
  if (isUserInActiveCall(userId)) {
    return { ok: false, code: "in_duo_call", message: "Завершите личный звонок, чтобы войти в групповой" };
  }
  const room = rooms.get(roomId);
  if (!room) return { ok: false, code: "room_not_found", message: "Комната не найдена" };
  if (room.connected.size >= MAX_GROUP_MESH_PEERS && !room.connected.has(userId)) {
    return { ok: false, code: "room_full", message: "В комнате максимум участников" };
  }
  room.displayNameByUser.set(userId, displayName);
  room.connected.add(userId);
  userActiveGroupRoom.set(userId, roomId);
  return { ok: true, room };
}

export function roomDetachUser(roomId: string, userId: string): GroupRoomLive | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  room.connected.delete(userId);
  room.displayNameByUser.delete(userId);
  userActiveGroupRoom.delete(userId);
  removeRoomIfEmpty(roomId);
  return room;
}

export function rosterPayload(room: GroupRoomLive): {
  roomId: string;
  mediaType: GroupRoomMedia;
  participants: { userId: string; displayName: string }[];
} {
  const participants = Array.from(room.connected).map((userId) => ({
    userId,
    displayName: room.displayNameByUser.get(userId) || "Участник",
  }));
  participants.sort((a, b) => a.userId.localeCompare(b.userId));
  return { roomId: room.roomId, mediaType: room.mediaType, participants };
}
