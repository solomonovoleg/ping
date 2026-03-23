/**
 * In-memory call session store.
 * Manages active call sessions, tracks state, enforces one-active-call-per-user.
 */

export type CallSessionState =
  | "ringing"
  | "accepted"
  | "connecting"
  | "connected"
  | "ended"
  | "rejected"
  | "missed"
  | "busy"
  | "failed";

export type CallMediaType = "audio" | "video";
export type CallSessionEndReason =
  | "hangup"
  | "cancel"
  | "timeout"
  | "rejected"
  | "busy"
  | "connection_lost"
  | "superseded"
  | "system";

export interface CallSession {
  callId: string;
  callerId: string;
  calleeId: string;
  chatId: string;
  mediaType: CallMediaType;
  state: CallSessionState;
  callerDisplayName: string;
  createdAt: number;
  acceptedAt?: number;
  connectedAt?: number;
  endedAt?: number;
  endedBy?: string;
  endReason?: CallSessionEndReason;
  ringTimer?: ReturnType<typeof setTimeout>;
  /** Участники, подтвердившие media-connected локально. */
  connectedParticipantIds: Set<string>;
}

const sessions = new Map<string, CallSession>();
const activeCallByUser = new Map<string, string>();

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const RING_TIMEOUT_MS = numEnv("CALLS_RING_TIMEOUT_MS", 60_000);
export const PENDING_CALL_TTL_MS = numEnv("CALLS_PENDING_TTL_MS", 90_000);
export const CALLER_WAIT_MS = numEnv("CALLS_CALLER_WAIT_MS", 60_000);

export function createSession(params: {
  callId: string;
  callerId: string;
  calleeId: string;
  chatId: string;
  mediaType: CallMediaType;
  callerDisplayName: string;
}): CallSession {
  const session: CallSession = {
    ...params,
    state: "ringing",
    createdAt: Date.now(),
    connectedParticipantIds: new Set<string>(),
  };
  sessions.set(params.callId, session);
  activeCallByUser.set(params.callerId, params.callId);
  activeCallByUser.set(params.calleeId, params.callId);
  return session;
}

export function getSession(callId: string): CallSession | undefined {
  return sessions.get(callId);
}

export function getActiveCallForUser(userId: string): CallSession | undefined {
  const callId = activeCallByUser.get(userId);
  if (!callId) return undefined;
  const session = sessions.get(callId);
  if (!session || isTerminal(session.state)) {
    activeCallByUser.delete(userId);
    return undefined;
  }
  return session;
}

export function isUserInActiveCall(userId: string): boolean {
  return getActiveCallForUser(userId) !== undefined;
}

export function isParticipant(callId: string, userId: string): boolean {
  const session = sessions.get(callId);
  if (!session) return false;
  return session.callerId === userId || session.calleeId === userId;
}

/**
 * Активная **ringing**-сессия именно между двумя пользователями (после await в invite — защита от гонки A↔B).
 */
export function findRingingSessionBetween(userA: string, userB: string): CallSession | undefined {
  const sa = getActiveCallForUser(userA);
  if (sa?.state === "ringing" && isParticipant(sa.callId, userB)) return sa;
  const sb = getActiveCallForUser(userB);
  if (sb?.state === "ringing" && isParticipant(sb.callId, userA)) return sb;
  return undefined;
}

export function getOtherParticipant(callId: string, userId: string): string | null {
  const session = sessions.get(callId);
  if (!session) return null;
  return session.callerId === userId ? session.calleeId : session.callerId;
}

export function acceptSession(callId: string): boolean {
  const session = sessions.get(callId);
  if (!session || session.state !== "ringing") return false;
  session.state = "accepted";
  session.acceptedAt = Date.now();
  if (session.ringTimer) {
    clearTimeout(session.ringTimer);
    session.ringTimer = undefined;
  }
  return true;
}

export function endSession(
  callId: string,
  endedBy?: string,
  state?: CallSessionState,
  endReason: CallSessionEndReason = "system",
): { changed: boolean; session: CallSession | null } {
  const session = sessions.get(callId);
  if (!session) return { changed: false, session: null };
  if (isTerminal(session.state)) {
    return { changed: false, session };
  }
  if (session.ringTimer) {
    clearTimeout(session.ringTimer);
    session.ringTimer = undefined;
  }
  session.state = state ?? "ended";
  session.endedAt = Date.now();
  session.endedBy = endedBy;
  session.endReason = endReason;
  session.connectedParticipantIds.clear();
  activeCallByUser.delete(session.callerId);
  activeCallByUser.delete(session.calleeId);

  // Garbage-collect session after 60 seconds
  setTimeout(() => { sessions.delete(callId); }, 60_000);
  return { changed: true, session };
}

export function markParticipantConnected(
  callId: string,
  userId: string,
): { changed: boolean; bothConnected: boolean; session: CallSession | null } {
  const session = sessions.get(callId);
  if (!session) return { changed: false, bothConnected: false, session: null };
  if (session.state === "ended" || session.state === "rejected" || session.state === "missed" || session.state === "busy" || session.state === "failed") {
    return { changed: false, bothConnected: false, session };
  }
  const wasKnown = session.connectedParticipantIds.has(userId);
  if (!wasKnown) {
    session.connectedParticipantIds.add(userId);
  }
  const bothConnected =
    session.connectedParticipantIds.has(session.callerId) &&
    session.connectedParticipantIds.has(session.calleeId);
  if (bothConnected) {
    session.state = "connected";
    if (!session.connectedAt) session.connectedAt = Date.now();
  } else if (session.state === "accepted" || session.state === "ringing") {
    session.state = "connecting";
  }
  return { changed: !wasKnown, bothConnected, session };
}

export function setRingTimer(callId: string, timer: ReturnType<typeof setTimeout>): void {
  const session = sessions.get(callId);
  if (session) {
    session.ringTimer = timer;
  }
}

function isTerminal(state: CallSessionState): boolean {
  return state === "ended" || state === "rejected" || state === "missed" || state === "busy" || state === "failed";
}

/** Clean up sessions for a disconnected user (no more sockets). */
export function cleanupForDisconnectedUser(userId: string): string | null {
  const callId = activeCallByUser.get(userId);
  if (!callId) return null;
  const session = sessions.get(callId);
  if (!session || isTerminal(session.state)) {
    activeCallByUser.delete(userId);
    return null;
  }
  return callId;
}
