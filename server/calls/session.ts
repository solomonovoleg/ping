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
  ringTimer?: ReturnType<typeof setTimeout>;
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

export function endSession(callId: string, endedBy?: string, state?: CallSessionState): void {
  const session = sessions.get(callId);
  if (!session) return;
  if (session.ringTimer) {
    clearTimeout(session.ringTimer);
    session.ringTimer = undefined;
  }
  session.state = state ?? "ended";
  session.endedAt = Date.now();
  session.endedBy = endedBy;
  activeCallByUser.delete(session.callerId);
  activeCallByUser.delete(session.calleeId);

  // Garbage-collect session after 60 seconds
  setTimeout(() => { sessions.delete(callId); }, 60_000);
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
