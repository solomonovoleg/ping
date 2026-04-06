import { randomUUID } from "crypto";
import { MAX_GROUP_MESH_PEERS } from "@shared/group-call-limits";
import { isUserInActiveCall } from "../calls/session";

export { MAX_GROUP_MESH_PEERS };

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
  /** Поднятая рука (синхронизируется с клиентами и входящим roster) */
  handRaised: Set<string>;
}

const rooms = new Map<string, GroupRoomLive>();
const activeRoomIdByChatId = new Map<string, string>();
/** Пользователь сейчас в групповом созвоне (WS join) */
const userActiveGroupRoom = new Map<string, string>();

export function isUserInGroupCall(userId: string): boolean {
  return userActiveGroupRoom.has(userId);
}

export function getGroupRoomIdForUser(userId: string): string | undefined {
  return userActiveGroupRoom.get(userId);
}

export function getRoom(roomId: string): GroupRoomLive | undefined {
  return rooms.get(roomId);
}

/**
 * Только чтение: «есть ли живой созвон» для UI.
 * Не трогаем activeRoomIdByChatId при connected=0 — иначе гонка: клиент после POST
 * долго ждёт getUserMedia, параллельно поллинг /active сбрасывает маппинг, и после
 * group.join комната живая, но чат уже не указывает на неё (/active всегда false).
 */
/** Активная комната для чата: пока запись в activeRoomIdByChatId и объект в памяти есть — даже при 0 в WS (организатор ещё в getUserMedia). */
export function getActiveRoomIdForChat(chatId: string): string | undefined {
  const id = activeRoomIdByChatId.get(chatId);
  if (!id) return undefined;
  const r = rooms.get(id);
  if (!r) return undefined;
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
    handRaised: new Set(),
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
  activeRoomIdByChatId.set(room.chatId, roomId);
  return { ok: true, room };
}

export function roomDetachUser(roomId: string, userId: string): GroupRoomLive | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  room.connected.delete(userId);
  room.displayNameByUser.delete(userId);
  room.handRaised.delete(userId);
  userActiveGroupRoom.delete(userId);
  removeRoomIfEmpty(roomId);
  return room;
}

export function setUserHandRaised(roomId: string, userId: string, raised: boolean): GroupRoomLive | undefined {
  const room = rooms.get(roomId);
  if (!room || !room.connected.has(userId)) return undefined;
  if (raised) room.handRaised.add(userId);
  else room.handRaised.delete(userId);
  return room;
}

export function rosterPayload(room: GroupRoomLive): {
  roomId: string;
  mediaType: GroupRoomMedia;
  hostUserId: string;
  maxMeshPeers: number;
  participants: { userId: string; displayName: string }[];
  handRaisedUserIds: string[];
} {
  const participants = Array.from(room.connected).map((userId) => ({
    userId,
    displayName: room.displayNameByUser.get(userId) || "Участник",
  }));
  participants.sort((a, b) => a.userId.localeCompare(b.userId));
  const handRaisedUserIds = Array.from(room.handRaised).filter((id) => room.connected.has(id));
  handRaisedUserIds.sort((a, b) => a.localeCompare(b));
  return {
    roomId: room.roomId,
    mediaType: room.mediaType,
    hostUserId: room.createdByUserId,
    maxMeshPeers: MAX_GROUP_MESH_PEERS,
    participants,
    handRaisedUserIds,
  };
}
