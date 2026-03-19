// ─── Call State Machine ────────────────────────────────────────────

export type CallState =
  | "idle"
  | "outgoing_ringing"
  | "incoming_ringing"
  | "accepting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "rejected"
  | "missed"
  | "busy"
  | "failed";

export type CallMediaType = "audio" | "video";

export type CallDirection = "outgoing" | "incoming";

export interface CallSession {
  callId: string;
  callerId: string;
  calleeId: string;
  chatId: string;
  mediaType: CallMediaType;
  state: CallState;
  direction: CallDirection;
  callerDisplayName?: string;
  createdAt: number;
  acceptedAt?: number;
  connectedAt?: number;
  endedAt?: number;
  endedBy?: string;
  endReason?: CallEndReason;
}

export type CallEndReason =
  | "hangup"
  | "rejected"
  | "busy"
  | "timeout"
  | "canceled"
  | "error"
  | "connection_lost";

// ─── Client → Server events ───────────────────────────────────────

export type ClientCallEvent =
  | {
      type: "call.invite";
      callId: string;
      toUserId: string;
      chatId: string;
      mediaType: CallMediaType;
      fromDisplayName: string;
    }
  | {
      type: "call.accept";
      callId: string;
    }
  | {
      type: "call.reject";
      callId: string;
      reason?: "declined" | "busy";
    }
  | {
      type: "call.cancel";
      callId: string;
    }
  | {
      type: "call.hangup";
      callId: string;
    }
  | {
      type: "call.offer";
      callId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "call.answer";
      callId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "call.ice-candidate";
      callId: string;
      candidate: RTCIceCandidateInit;
    };

// ─── Server → Client events ──────────────────────────────────────

export type ServerCallEvent =
  | {
      type: "call.incoming";
      callId: string;
      fromUserId: string;
      chatId: string;
      mediaType: CallMediaType;
      fromDisplayName: string;
      fromAvatarUrl?: string | null;
    }
  | {
      type: "call.accepted";
      callId: string;
      byUserId: string;
    }
  | {
      type: "call.rejected";
      callId: string;
      byUserId: string;
      reason?: "declined" | "busy";
    }
  | {
      type: "call.canceled";
      callId: string;
      byUserId: string;
    }
  | {
      type: "call.hungup";
      callId: string;
      byUserId: string;
    }
  | {
      type: "call.offer";
      callId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "call.answer";
      callId: string;
      fromUserId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "call.ice-candidate";
      callId: string;
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: "call.timeout";
      callId: string;
    }
  | {
      type: "call.error";
      callId?: string;
      code: string;
      message: string;
    };

// ─── Timeouts ─────────────────────────────────────────────────────

function numFromEnv(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;

export const RING_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_RING_TIMEOUT_MS as string | undefined, 60_000);
export const ACCEPT_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_ACCEPT_TIMEOUT_MS as string | undefined, 15_000);
export const CONNECT_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_CONNECT_TIMEOUT_MS as string | undefined, 20_000);
export const RECONNECT_TIMEOUT_MS = numFromEnv(env?.VITE_CALLS_RECONNECT_TIMEOUT_MS as string | undefined, 8_000);

// ─── WebRTC peer callbacks ────────────────────────────────────────

export type WebRtcPeerHandlers = {
  onLocalCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
};

// ─── Store state exposed to UI ────────────────────────────────────

export interface CallStoreState {
  state: CallState;
  direction: CallDirection;
  callId: string | null;
  mediaType: CallMediaType;
  isMuted: boolean;
  error: string | null;
  statusText: string | null;
  incoming: IncomingCallInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  otherUserId: string | null;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  chatId: string | null;
}

export interface IncomingCallInfo {
  callId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl?: string | null;
  chatId: string;
  mediaType: CallMediaType;
}

export interface CallStoreActions {
  startCall: (otherUserId: string, otherName: string | null, chatId: string, video: boolean, avatarUrl?: string | null) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangup: () => void;
  setMuted: (muted: boolean) => void;
  retryCall: () => void;
}
