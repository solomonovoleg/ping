/** Чтобы не дублировать звук: WS-приглашение уже запускает полный рингтон в AppLayout. */
let wsRingStartedForRoomId: string | null = null;
let wsRingStartedAt = 0;

export function markGroupCallInviteRingFromWebSocket(roomId: string): void {
  wsRingStartedForRoomId = roomId;
  wsRingStartedAt = Date.now();
}

export function didWebSocketRecentlyStartGroupCallRing(roomId: string, withinMs = 12_000): boolean {
  return wsRingStartedForRoomId === roomId && Date.now() - wsRingStartedAt < withinMs;
}
