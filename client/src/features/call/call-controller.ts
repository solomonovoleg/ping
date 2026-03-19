import type {
  CallState,
  CallMediaType,
  CallDirection,
  IncomingCallInfo,
  ServerCallEvent,
} from "./call-types";
import {
  RING_TIMEOUT_MS,
  ACCEPT_TIMEOUT_MS,
  CONNECT_TIMEOUT_MS,
  RECONNECT_TIMEOUT_MS,
} from "./call-types";
import { tryTransition, forceTransition, isActiveCallState } from "./call-state-machine";
import { WebRtcCallPeer, isWebRtcSupported, mapMediaAccessError } from "./webrtc-peer";
import { getIceServers } from "./call-ice-config";
import { CallSignalingClient } from "./call-signaling";
import { startIncomingCallAlert, startRingbackTone } from "@/lib/incoming-call-alert";

type StateChangeListener = (snapshot: CallControllerSnapshot) => void;

export interface CallControllerSnapshot {
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

/**
 * Call orchestration controller.
 * Coordinates state machine, signaling, and WebRTC peer.
 * Framework-agnostic — notifies listeners on state changes.
 */
export class CallController {
  // ── State ──────────────────────────────────────────────────────
  private _state: CallState = "idle";
  private _direction: CallDirection = "outgoing";
  private _callId: string | null = null;
  private _mediaType: CallMediaType = "audio";
  private _isMuted = false;
  private _error: string | null = null;
  private _statusText: string | null = null;
  private _incoming: IncomingCallInfo | null = null;
  private _otherUserId: string | null = null;
  private _otherDisplayName: string | null = null;
  private _otherAvatarUrl: string | null = null;
  private _chatId: string | null = null;

  // ── Internals ──────────────────────────────────────────────────
  private peer: WebRtcCallPeer | null = null;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private stopIncomingAlert: (() => void) | null = null;
  private stopRingback: (() => void) | null = null;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private acceptTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleResetTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private listeners = new Set<StateChangeListener>();

  constructor(
    private signaling: CallSignalingClient,
    private myUserId: string,
  ) {
    this.signaling.onEvent((ev) => this.onServerEvent(ev));
  }

  // ── Public API ─────────────────────────────────────────────────

  async startCall(
    otherUserId: string,
    otherName: string | null,
    otherAvatarUrl: string | null,
    chatId: string,
    mediaType: CallMediaType,
    callerDisplayName: string,
  ): Promise<void> {
    if (this._state !== "idle") {
      throw new Error("Уже есть активный звонок");
    }
    if (!isWebRtcSupported()) {
      throw Object.assign(
        new Error("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS."),
        { name: "NotSupportedError" },
      );
    }

    const callId = crypto.randomUUID();
    this._callId = callId;
    this._otherUserId = otherUserId;
    this._otherDisplayName = otherName;
    this._otherAvatarUrl = otherAvatarUrl;
    this._chatId = chatId;
    this._mediaType = mediaType;
    this._direction = "outgoing";
    this._error = null;
    this._statusText = null;
    this.setState("outgoing_ringing");

    try {
      await this.ensurePeer(mediaType);

      this.signaling.send({
        type: "call.invite",
        callId,
        toUserId: otherUserId,
        chatId,
        mediaType,
        fromDisplayName: callerDisplayName,
      });

      const offer = await this.peer!.createOffer();
      this.signaling.send({ type: "call.offer", callId, sdp: offer });

      this.stopRingback?.();
      this.stopRingback = startRingbackTone();

      this.ringTimer = setTimeout(() => {
        this.ringTimer = null;
        if (this._state === "outgoing_ringing") {
          this._error = "Абонент не отвечает";
          this.endCallInternal("timeout");
        }
      }, RING_TIMEOUT_MS);
    } catch (e) {
      this._error = e instanceof Error ? (e.name === "NotSupportedError" ? e.message : mapMediaAccessError(e)) : "Не удалось начать звонок";
      if (this._callId) {
        this.signaling.send({ type: "call.cancel", callId: this._callId });
      }
      this.endCallInternal("error");
    }
  }

  async acceptCall(): Promise<void> {
    const info = this._incoming;
    if (!info || this._state !== "incoming_ringing") return;

    if (!isWebRtcSupported()) {
      this._error = "Звонки не поддерживаются в этом браузере.";
      this.signaling.send({ type: "call.reject", callId: info.callId, reason: "declined" });
      this.endCallInternal("error");
      return;
    }

    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;

    this._callId = info.callId;
    this._otherUserId = info.fromUserId;
    this._otherDisplayName = info.fromDisplayName;
    this._otherAvatarUrl = info.fromAvatarUrl ?? null;
    this._chatId = info.chatId;
    this._mediaType = info.mediaType;
    this._direction = "incoming";
    this._incoming = null;
    this._error = null;
    this._statusText = null;
    this.setState("accepting");

    try {
      this.signaling.send({ type: "call.accept", callId: info.callId });
      await this.ensurePeer(info.mediaType);
      this.setState("connecting");

      // Apply buffered offer/ICE that arrived while we had no peer
      await this.applyPendingOfferAndIce(info.callId);

      this.connectTimer = setTimeout(() => {
        this.connectTimer = null;
        if (this._state === "connecting") {
          this._error = "Таймаут подключения. Попробуйте позвонить снова.";
          this.endCallInternal("error");
        }
      }, CONNECT_TIMEOUT_MS);
    } catch (e) {
      this._error = e instanceof Error ? mapMediaAccessError(e) : "Ошибка";
      this.endCallInternal("error");
    }
  }

  rejectCall(): void {
    const info = this._incoming;
    if (!info) return;

    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;

    this.signaling.send({ type: "call.reject", callId: info.callId, reason: "declined" });
    this._incoming = null;
    this.setState("idle");
    this.notify();
  }

  hangup(): void {
    if (!this._callId) {
      this.cleanupFull();
      return;
    }

    const eventType = this._state === "outgoing_ringing" ? "call.cancel" as const : "call.hangup" as const;
    this.signaling.send({ type: eventType, callId: this._callId });
    this.endCallInternal("hangup");
  }

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    this.peer?.setMicEnabled(!muted);
    this.notify();
  }

  retryCall(): void {
    const userId = this._otherUserId;
    const name = this._otherDisplayName;
    const avatar = this._otherAvatarUrl;
    const chatId = this._chatId;
    const mediaType = this._mediaType;
    if (!userId || !chatId) return;
    this.cleanupFull();
    this.startCall(userId, name, avatar, chatId, mediaType, "").catch(() => {});
  }

  /** Call this when the WebSocket disconnects. */
  onTransportDisconnected(): void {
    if (!isActiveCallState(this._state)) return;
    this._error = "Соединение прервано";
    this.endCallInternal("connection_lost");
  }

  // ── Snapshot / Subscription ────────────────────────────────────

  getSnapshot(): CallControllerSnapshot {
    return {
      state: this._state,
      direction: this._direction,
      callId: this._callId,
      mediaType: this._mediaType,
      isMuted: this._isMuted,
      error: this._error,
      statusText: this._statusText,
      incoming: this._incoming,
      localStream: this.peer?.getLocalStream() ?? null,
      remoteStream: this.peer?.getRemoteStream() ?? null,
      connectionState: this.peer?.getConnectionState() ?? null,
      otherUserId: this._otherUserId,
      otherDisplayName: this._otherDisplayName,
      otherAvatarUrl: this._otherAvatarUrl,
      chatId: this._chatId,
    };
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanupFull();
    this.listeners.clear();
  }

  // ── Server event handler ───────────────────────────────────────

  private onServerEvent(event: ServerCallEvent): void {
    if (this.destroyed) return;

    switch (event.type) {
      case "call.incoming":
        this.handleIncoming(event);
        break;
      case "call.accepted":
        this.handleAccepted(event);
        break;
      case "call.offer":
        this.handleOffer(event);
        break;
      case "call.answer":
        this.handleAnswer(event);
        break;
      case "call.ice-candidate":
        this.handleIceCandidate(event);
        break;
      case "call.rejected":
        this.handleRejected(event);
        break;
      case "call.canceled":
      case "call.hungup":
        this.handleRemoteEnd(event);
        break;
      case "call.timeout":
        this.handleTimeout(event);
        break;
      case "call.error":
        this.handleServerError(event);
        break;
    }
  }

  private handleIncoming(event: Extract<ServerCallEvent, { type: "call.incoming" }>): void {
    if (isActiveCallState(this._state)) {
      this.signaling.send({ type: "call.reject", callId: event.callId, reason: "busy" });
      return;
    }

    this.stopIncomingAlert?.();
    this.stopIncomingAlert = startIncomingCallAlert(event.fromDisplayName);

    this._incoming = {
      callId: event.callId,
      fromUserId: event.fromUserId,
      fromDisplayName: event.fromDisplayName,
      fromAvatarUrl: event.fromAvatarUrl ?? null,
      chatId: event.chatId,
      mediaType: event.mediaType,
    };
    this.setState("incoming_ringing");
  }

  private handleAccepted(event: Extract<ServerCallEvent, { type: "call.accepted" }>): void {
    if (event.callId !== this._callId) return;

    this.stopRingback?.();
    this.stopRingback = null;
    this.clearTimer("ringTimer");

    if (this._state === "outgoing_ringing") {
      this.setState("connecting");
      this.connectTimer = setTimeout(() => {
        this.connectTimer = null;
        if (this._state === "connecting") {
          this._error = "Таймаут подключения";
          this.endCallInternal("error");
        }
      }, CONNECT_TIMEOUT_MS);
    }
  }

  private async handleOffer(event: Extract<ServerCallEvent, { type: "call.offer" }>): Promise<void> {
    // Offer may arrive for a pending incoming call (before accept) or for the active callId
    const isForIncoming = this._incoming && this._incoming.callId === event.callId;
    const isForActive = event.callId === this._callId;
    if (!isForIncoming && !isForActive) return;

    if (!this.peer) {
      // Peer not created yet (callee hasn't accepted). Buffer for later.
      this.pendingOffer = event.sdp;
      return;
    }

    try {
      const answer = await this.peer.handleRemoteOffer(event.sdp);
      this.signaling.send({ type: "call.answer", callId: event.callId, sdp: answer });
    } catch (e) {
      console.error("[call-ctrl] handleOffer error:", e);
      this._error = "Ошибка при установке соединения";
      this.endCallInternal("error");
    }
  }

  private async handleAnswer(event: Extract<ServerCallEvent, { type: "call.answer" }>): Promise<void> {
    if (event.callId !== this._callId) return;
    if (!this.peer) return;

    try {
      await this.peer.handleRemoteAnswer(event.sdp);
    } catch (e) {
      console.error("[call-ctrl] handleAnswer error:", e);
      this._error = "Ошибка при установке соединения";
      this.endCallInternal("error");
    }
  }

  private async handleIceCandidate(event: Extract<ServerCallEvent, { type: "call.ice-candidate" }>): Promise<void> {
    const isForIncoming = this._incoming && this._incoming.callId === event.callId;
    const isForActive = event.callId === this._callId;
    if (!isForIncoming && !isForActive) return;

    if (!this.peer) {
      // Peer not created yet — buffer ICE candidates until accept + peer creation.
      this.pendingIceCandidates.push(event.candidate);
      return;
    }

    await this.peer.addRemoteIceCandidate(event.candidate);
  }

  private handleRejected(event: Extract<ServerCallEvent, { type: "call.rejected" }>): void {
    if (event.callId !== this._callId) return;
    this.stopRingback?.();
    this.stopRingback = null;
    this.clearTimer("ringTimer");

    if (event.reason === "busy") {
      this._statusText = "Абонент занят";
      this.endCallInternal("busy");
    } else {
      this._statusText = "Звонок отклонён";
      this.endCallInternal("rejected");
    }
  }

  private handleRemoteEnd(event: Extract<ServerCallEvent, { type: "call.canceled" | "call.hungup" }>): void {
    if (event.callId !== this._callId && !(this._incoming && this._incoming.callId === event.callId)) return;

    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    this.stopRingback?.();
    this.stopRingback = null;

    if (this._incoming?.callId === event.callId) {
      this._incoming = null;
    }

    this.endCallInternal("hangup");
  }

  private handleTimeout(event: Extract<ServerCallEvent, { type: "call.timeout" }>): void {
    if (event.callId !== this._callId && !(this._incoming && this._incoming.callId === event.callId)) return;

    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    this.stopRingback?.();
    this.stopRingback = null;

    if (this._incoming?.callId === event.callId) {
      this._incoming = null;
    }

    this._error = this._direction === "outgoing" ? "Абонент не отвечает" : null;
    this.endCallInternal("timeout");
  }

  private handleServerError(event: Extract<ServerCallEvent, { type: "call.error" }>): void {
    if (event.callId && event.callId !== this._callId) return;
    this._error = event.message;
    this.endCallInternal("error");
  }

  // ── WebRTC connection state → call state ───────────────────────

  private onConnectionStateChange(pcState: RTCPeerConnectionState): void {
    if (this.destroyed) return;

    if (pcState === "connected") {
      this.clearTimer("connectTimer");
      this.clearTimer("reconnectTimer");
      if (this._state === "connecting" || this._state === "reconnecting") {
        this.setState("connected");
      }
    } else if (pcState === "disconnected" && this._state === "connected") {
      this.setState("reconnecting");
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this._state === "reconnecting") {
          this._error = "Соединение потеряно";
          this.endCallInternal("connection_lost");
        }
      }, RECONNECT_TIMEOUT_MS);
    } else if (pcState === "failed") {
      this._error = "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова.";
      this.endCallInternal("error");
    }

    this.notify();
  }

  // ── Internal helpers ───────────────────────────────────────────

  private async applyPendingOfferAndIce(callId: string): Promise<void> {
    if (!this.peer) return;

    // Apply buffered offer → creates answer → sends it
    const offer = this.pendingOffer;
    this.pendingOffer = null;
    if (offer) {
      try {
        const answer = await this.peer.handleRemoteOffer(offer);
        this.signaling.send({ type: "call.answer", callId, sdp: answer });
      } catch (e) {
        console.error("[call-ctrl] applyPendingOffer error:", e);
        this._error = "Ошибка при установке соединения";
        this.endCallInternal("error");
        return;
      }
    }

    // Flush buffered ICE candidates
    const candidates = this.pendingIceCandidates.splice(0);
    for (const c of candidates) {
      await this.peer.addRemoteIceCandidate(c);
    }
  }

  private async ensurePeer(mediaType: CallMediaType): Promise<void> {
    if (this.peer) return;

    this.peer = new WebRtcCallPeer(getIceServers(), {
      onLocalCandidate: (candidate) => {
        if (this._callId) {
          this.signaling.send({ type: "call.ice-candidate", callId: this._callId, candidate });
        }
      },
      onRemoteStream: () => this.notify(),
      onConnectionStateChange: (s) => this.onConnectionStateChange(s),
      onIceConnectionStateChange: () => this.notify(),
    });

    await this.peer.initLocalMedia(mediaType);
    this.peer.createPeerConnection();
    this.notify();
  }

  private endCallInternal(reason: string): void {
    this.stopRingback?.();
    this.stopRingback = null;
    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    this.clearAllTimers();

    this.peer?.destroy();
    this.peer = null;
    this.pendingOffer = null;
    this.pendingIceCandidates = [];
    this._isMuted = false;

    let targetState: CallState;
    switch (reason) {
      case "hangup": targetState = "ended"; break;
      case "rejected": targetState = "rejected"; break;
      case "busy": targetState = "busy"; break;
      case "timeout": targetState = this._direction === "outgoing" ? "missed" : "ended"; break;
      case "canceled": targetState = "ended"; break;
      default: targetState = "failed"; break;
    }

    const result = tryTransition(this._state, targetState);
    if (result) {
      this._state = result;
    } else {
      this._state = forceTransition(this._state, targetState);
    }

    this.notify();

    // Auto-reset to idle after terminal states — except "failed" (user must explicitly close or retry)
    if (targetState !== "failed") {
      this.idleResetTimer = setTimeout(() => {
        this.idleResetTimer = null;
        this.cleanupFull();
        this.notify();
      }, 3000);
    }
  }

  private cleanupFull(): void {
    this.stopRingback?.();
    this.stopRingback = null;
    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    this.clearAllTimers();

    this.peer?.destroy();
    this.peer = null;
    this.pendingOffer = null;
    this.pendingIceCandidates = [];

    this._state = "idle";
    this._callId = null;
    this._otherUserId = null;
    this._otherDisplayName = null;
    this._otherAvatarUrl = null;
    this._chatId = null;
    this._error = null;
    this._statusText = null;
    this._incoming = null;
    this._isMuted = false;
  }

  private setState(next: CallState): void {
    const result = tryTransition(this._state, next);
    if (result) {
      this._state = result;
      this.notify();
    }
  }

  private notify(): void {
    if (this.destroyed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try { fn(snapshot); } catch (e) { console.error("[call-ctrl] listener error", e); }
    });
  }

  private clearTimer(name: "ringTimer" | "acceptTimer" | "connectTimer" | "reconnectTimer" | "idleResetTimer"): void {
    if (this[name]) {
      clearTimeout(this[name]!);
      this[name] = null;
    }
  }

  private clearAllTimers(): void {
    this.clearTimer("ringTimer");
    this.clearTimer("acceptTimer");
    this.clearTimer("connectTimer");
    this.clearTimer("reconnectTimer");
    this.clearTimer("idleResetTimer");
  }
}
