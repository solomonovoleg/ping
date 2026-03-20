import type {
  CallState,
  CallMediaType,
  CallDirection,
  IncomingCallInfo,
  ServerCallEvent,
  CallNetworkQualityLevel,
  CallCameraFacingMode,
  CallReactionEvent,
  CallCaptionEvent,
  CallReactionKind,
  CallFeatureSupport,
  CallMessageListContext,
} from "./call-types";
import {
  RING_TIMEOUT_MS,
  ACCEPT_TIMEOUT_MS,
  CONNECT_TIMEOUT_MS,
  RECONNECT_TIMEOUT_MS,
} from "./call-types";
import { tryTransition, forceTransition, isActiveCallState, isTerminalState } from "./call-state-machine";
import { WebRtcCallPeer, isWebRtcSupported, mapMediaAccessError, tuneOutgoingVideoSenders } from "./webrtc-peer";
import { getIceServers } from "./call-ice-config";
import { CallSignalingClient } from "./call-signaling";
import { startIncomingCallAlert, startRingbackTone } from "@/lib/incoming-call-alert";
import { getCallFeatureFlags } from "./call-feature-flags";
import { getCallFeatureSupport } from "./call-capabilities";
import { CallNetworkQualityMonitor } from "./utils/network-quality";
import { switchCameraTrack } from "./utils/camera-switch";
import { startScreenShare, type ScreenShareSession } from "./utils/screen-share";
import { LocalRecordingController } from "./utils/local-recording";
import { createReaction, trimReactionQueue } from "./utils/live-reactions";
import { LiveCaptionsController } from "./utils/live-captions";
import { DISABLED_CALL_FEATURE_SUPPORT } from "./call-feature-modules";

type StateChangeListener = (snapshot: CallControllerSnapshot) => void;
const RESUME_REJOIN_TIMEOUT_MS = 45_000;

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
  networkQuality: CallNetworkQualityLevel;
  cameraFacingMode: CallCameraFacingMode;
  isScreenShareActive: boolean;
  isCameraEnabled: boolean;
  localRecordingState: "idle" | "recording" | "paused" | "stopping" | "error";
  localRecordingElapsedMs: number;
  captionsEnabled: boolean;
  supports: CallFeatureSupport;
  localReactions: CallReactionEvent[];
  remoteReactions: CallReactionEvent[];
  captions: CallCaptionEvent[];
  otherUserId: string | null;
  otherDisplayName: string | null;
  otherAvatarUrl: string | null;
  chatId: string | null;
  callMessageContext: CallMessageListContext;
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
  private _callMessageContext: CallMessageListContext = { kind: "unknown" };
  private _networkQuality: CallNetworkQualityLevel = "unknown";
  private _cameraFacingMode: CallCameraFacingMode = "user";
  private _isScreenShareActive = false;
  private _isCameraEnabled = true;
  private _localRecordingState: "idle" | "recording" | "paused" | "stopping" | "error" = "idle";
  private _localRecordingElapsedMs = 0;
  private _captionsEnabled = false;
  private _localReactions: CallReactionEvent[] = [];
  private _remoteReactions: CallReactionEvent[] = [];
  private _captions: CallCaptionEvent[] = [];
  private readonly featureFlags = getCallFeatureFlags();
  private readonly supports = getCallFeatureSupport(this.featureFlags);

  // ── Internals ──────────────────────────────────────────────────
  private peer: WebRtcCallPeer | null = null;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private stopIncomingAlert: (() => void) | null = null;
  private stopRingback: (() => void) | null = null;
  private networkMonitor: CallNetworkQualityMonitor | null = null;
  private screenShareSession: ScreenShareSession | null = null;
  private recordingController = new LocalRecordingController((state) => {
    this._localRecordingState = state;
    if (state === "idle") this._localRecordingElapsedMs = 0;
    this.updateRecordingTicker();
    this.notify();
  });
  private recordingTicker: ReturnType<typeof setInterval> | null = null;
  private captionsController = new LiveCaptionsController(
    (text) => this.onLocalCaption(text),
    () => {
      this._statusText = "Не удалось продолжить титры";
      this.notify();
    },
  );
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
    messageContext: CallMessageListContext = { kind: "unknown" },
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
    this._callMessageContext = messageContext;
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
    if (!info || (this._state !== "incoming_ringing" && this._state !== "reconnecting")) return;

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
    this._callMessageContext = { kind: "unknown" };
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
    this.endCallInternal("rejected");
  }

  hangup(): void {
    if (isTerminalState(this._state)) {
      this.cleanupFull();
      this.notify();
      return;
    }
    if (this._incoming && (this._state === "incoming_ringing" || this._state === "reconnecting")) {
      this.rejectCall();
      return;
    }
    if (!this._callId) {
      this.cleanupFull();
      this.notify();
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

  toggleCameraEnabled(): void {
    this._isCameraEnabled = !this._isCameraEnabled;
    this.peer?.setCameraEnabled(this._isCameraEnabled);
    this.notify();
  }

  async switchCamera(): Promise<void> {
    if (!this.supports.cameraFlip || !this.peer) return;
    const pc = this.peer.getPeerConnection();
    const local = this.peer.getLocalStream();
    if (!pc || !local) return;
    const result = await switchCameraTrack(pc, local, this._cameraFacingMode);
    this._cameraFacingMode = result.facingMode;
    void tuneOutgoingVideoSenders(pc, { screenShare: this._isScreenShareActive });
    this.notify();
  }

  async toggleScreenShare(): Promise<void> {
    if (!this.supports.screenShare || !this.peer || this._mediaType !== "video") return;
    const local = this.peer.getLocalStream();
    const pc = this.peer.getPeerConnection();
    if (!local || !pc) return;

    if (this.screenShareSession) {
      await this.screenShareSession.stop();
      this.screenShareSession = null;
      this._isScreenShareActive = false;
      if (this._callId) {
        this.signaling.send({ type: "call.screen-share-state", callId: this._callId, active: false });
      }
      this.notify();
      void tuneOutgoingVideoSenders(pc, { screenShare: false });
      return;
    }

    this.screenShareSession = await startScreenShare(pc, local);
    this._isScreenShareActive = true;
    if (this._callId) {
      this.signaling.send({ type: "call.screen-share-state", callId: this._callId, active: true });
    }
    this.notify();
    void tuneOutgoingVideoSenders(pc, { screenShare: true });
  }

  async toggleRecording(): Promise<void> {
    if (!this.supports.localRecording || !this.peer) return;
    const local = this.peer.getLocalStream();
    const remote = this.peer.getRemoteStream();
    if (!local || !remote) return;
    const state = this.recordingController.getState();
    if (state === "recording" || state === "paused") {
      await this.recordingController.stop();
      return;
    }
    await this.recordingController.start(local, remote);
    this.updateRecordingTicker();
  }

  async toggleRecordingPause(): Promise<void> {
    if (!this.supports.localRecording) return;
    const state = this.recordingController.getState();
    if (state === "recording") {
      await this.recordingController.pause();
    } else if (state === "paused") {
      await this.recordingController.resume();
    }
    this._localRecordingElapsedMs = this.recordingController.getElapsedMs();
    this.updateRecordingTicker();
    this.notify();
  }

  sendReaction(kind: CallReactionKind): void {
    if (!this.supports.reactions || !this._callId) return;
    const reaction = createReaction(kind, "local");
    this._localReactions = trimReactionQueue([...this._localReactions, reaction]);
    this.signaling.send({
      type: "call.reaction",
      callId: this._callId,
      reaction: kind,
      sentAt: reaction.sentAt,
      id: reaction.id,
    });
    this.notify();
  }

  toggleCaptions(): void {
    if (!this.supports.captionsRelay) return;
    this._captionsEnabled = !this._captionsEnabled;
    if (!this._captionsEnabled) {
      this._captions = [];
    }
    if (this.supports.captionsLocalSTT) {
      if (this._captionsEnabled) {
        this.captionsController.start();
      } else {
        this.captionsController.stop();
      }
    }
    this.notify();
  }

  retryCall(): void {
    const userId = this._otherUserId;
    const name = this._otherDisplayName;
    const avatar = this._otherAvatarUrl;
    const chatId = this._chatId;
    const mediaType = this._mediaType;
    const messageContext = this._callMessageContext;
    if (!userId || !chatId) return;
    this.cleanupFull();
    this.startCall(userId, name, avatar, chatId, mediaType, "", messageContext).catch(() => {});
  }

  /** Call this when the WebSocket disconnects. */
  onTransportDisconnected(): void {
    if (!isActiveCallState(this._state)) return;
    const pcState = this.peer?.getConnectionState() ?? null;
    console.warn("[call-reconnect] ws closed during call", { uiState: this._state, peerConnectionState: pcState });
    this._statusText = "Связь потеряна. Пытаемся вернуть звонок…";
    if (this._state !== "reconnecting") {
      this._state = forceTransition(this._state, "reconnecting");
    }
    this.clearTimer("reconnectTimer");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this._state === "reconnecting") {
        console.warn("[call-reconnect] timeout while ws down — ending call");
        this._error = "Не удалось восстановить связь. Завершите звонок или попробуйте снова.";
        this.endCallInternal("connection_lost");
      }
    }, RESUME_REJOIN_TIMEOUT_MS);
    this.notify();
  }

  onTransportConnected(): void {
    this.clearTimer("reconnectTimer");
    if (this._state === "reconnecting") {
      this._statusText = "Соединение восстановлено. Возвращаем в звонок…";
      this.notify();
    }
    console.info("[call-reconnect] ws open → resume-check");
    this.signaling.send({ type: "call.resume-check" });
    if (this._state === "reconnecting") {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this._state === "reconnecting") {
          console.warn("[call-reconnect] timeout: still reconnecting after", RESUME_REJOIN_TIMEOUT_MS, "ms");
          this._error = "Не удалось восстановить звонок после восстановления сети.";
          this.endCallInternal("connection_lost");
        }
      }, RESUME_REJOIN_TIMEOUT_MS);
    }
    queueMicrotask(() => this.syncCallUiWithPeerIfStable());
    setTimeout(() => this.syncCallUiWithPeerIfStable(), 150);
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
      networkQuality: this._networkQuality,
      cameraFacingMode: this._cameraFacingMode,
      isScreenShareActive: this._isScreenShareActive,
      isCameraEnabled: this._isCameraEnabled,
      localRecordingState: this._localRecordingState,
      localRecordingElapsedMs: this._localRecordingElapsedMs,
      captionsEnabled: this._captionsEnabled,
      supports: this.supports ?? DISABLED_CALL_FEATURE_SUPPORT,
      localReactions: this._localReactions,
      remoteReactions: this._remoteReactions,
      captions: this._captions,
      otherUserId: this._otherUserId,
      otherDisplayName: this._otherDisplayName,
      otherAvatarUrl: this._otherAvatarUrl,
      chatId: this._chatId,
      callMessageContext: this._callMessageContext,
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
      case "call.reaction":
        this.handleReaction(event);
        break;
      case "call.caption":
        this.handleCaption(event);
        break;
      case "call.screen-share-state":
        this.handleRemoteScreenShareState(event);
        break;
      case "call.resume-available":
        this.handleResumeAvailable(event);
        break;
      case "call.peer-reconnected":
        this.handlePeerReconnected(event);
        break;
    }
  }

  private handleIncoming(event: Extract<ServerCallEvent, { type: "call.incoming" }>): void {
    if (isActiveCallState(this._state)) {
      if (this._state === "outgoing_ringing" && event.fromUserId === this._otherUserId) {
        this.mergeOutgoingGlareToIncoming(event);
        return;
      }
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
      console.warn("[call-ctrl] handleOffer first attempt failed, recreating peer", e);
      try {
        await this.recreatePeer(this._mediaType);
        const answer = await this.peer!.handleRemoteOffer(event.sdp);
        this.signaling.send({ type: "call.answer", callId: event.callId, sdp: answer });
      } catch (e2) {
        console.error("[call-ctrl] handleOffer error:", e2);
        this._error = "Ошибка при установке соединения";
        this.endCallInternal("error");
      }
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
    if (event.code === "glare_use_incoming" && this._state === "outgoing_ringing") {
      this._statusText = event.message || "Собеседник уже звонит вам — ждём входящий…";
      this.notify();
      return;
    }
    if (event.callId && event.callId !== this._callId) return;
    this._error = event.message;
    this.endCallInternal("error");
  }

  private handleReaction(event: Extract<ServerCallEvent, { type: "call.reaction" }>): void {
    if (event.callId !== this._callId) return;
    this._remoteReactions = trimReactionQueue([
      ...this._remoteReactions,
      { id: event.id, kind: event.reaction, from: "remote", sentAt: event.sentAt },
    ]);
    this.notify();
  }

  private handleCaption(event: Extract<ServerCallEvent, { type: "call.caption" }>): void {
    if (event.callId !== this._callId) return;
    if (!this._captionsEnabled) return;
    if (typeof event.fromUserId === "string" && event.fromUserId === this.myUserId) return;
    const text = typeof event.text === "string" ? event.text.trim() : "";
    if (!text) return;
    const id = typeof event.id === "string" && event.id.length > 0 ? event.id : crypto.randomUUID();
    const sentAt =
      typeof event.sentAt === "number" && Number.isFinite(event.sentAt) ? event.sentAt : Date.now();
    this._captions = [...this._captions.slice(-35), { id, text, from: "remote", sentAt }];
    this.notify();
  }

  private handleRemoteScreenShareState(event: Extract<ServerCallEvent, { type: "call.screen-share-state" }>): void {
    if (event.callId !== this._callId) return;
    this._statusText = event.active ? "Собеседник делится экраном" : null;
    this.notify();
  }

  private mergeOutgoingGlareToIncoming(event: Extract<ServerCallEvent, { type: "call.incoming" }>): void {
    if (!this._callId) return;
    this.stopRingback?.();
    this.stopRingback = null;
    this.clearTimer("ringTimer");
    this.signaling.send({ type: "call.cancel", callId: this._callId });
    this.peer?.destroy();
    this.peer = null;
    this.pendingOffer = null;
    this.pendingIceCandidates = [];
    this._callId = null;
    this._incoming = {
      callId: event.callId,
      fromUserId: event.fromUserId,
      fromDisplayName: event.fromDisplayName,
      fromAvatarUrl: event.fromAvatarUrl ?? null,
      chatId: event.chatId,
      mediaType: event.mediaType,
    };
    this._otherUserId = event.fromUserId;
    this._otherDisplayName = event.fromDisplayName;
    this._otherAvatarUrl = event.fromAvatarUrl ?? null;
    this._chatId = event.chatId;
    this._mediaType = event.mediaType;
    this._direction = "incoming";
    this._error = null;
    this._statusText = null;
    this._state = forceTransition(this._state, "incoming_ringing");
    this.stopIncomingAlert?.();
    this.stopIncomingAlert = startIncomingCallAlert(event.fromDisplayName);
    this.notify();
  }

  /**
   * WS мог отвалиться, а WebRTC остаться connected — тогда нет нового connectionstatechange,
   * и UI залипает в reconnecting до таймаута. Синхронизируем с реальным состоянием peer.
   */
  private syncCallUiWithPeerIfStable(): void {
    if (this.destroyed) return;
    if (this._state !== "reconnecting") return;
    if (this.peer?.getConnectionState() !== "connected") return;
    console.info("[call-reconnect] peer still connected → UI back to connected (no full reneg)");
    this.clearTimer("reconnectTimer");
    this._statusText = null;
    this._error = null;
    const next = tryTransition(this._state, "connected");
    this._state = next ?? forceTransition(this._state, "connected");
    this.notify();
  }

  private handleResumeAvailable(event: Extract<ServerCallEvent, { type: "call.resume-available" }>): void {
    // После сброса/отклонения `_callId` ещё секунды висит до cleanup — нельзя снова «въезжать» в звонок по resume.
    if (isTerminalState(this._state)) return;
    if (this._callId && this._callId !== event.callId && isActiveCallState(this._state)) return;

    console.info("[call-reconnect] resume-available", {
      callId: event.callId,
      shouldOffer: event.shouldInitiateOffer,
      uiState: this._state,
      peerState: this.peer?.getConnectionState() ?? null,
    });

    if (this._incoming && !this._callId && event.callId === this._incoming.callId) {
      this._statusText = null;
      this.clearTimer("reconnectTimer");
      if (this._state === "reconnecting") {
        this._state = forceTransition(this._state, "incoming_ringing");
      }
      this.notify();
      return;
    }

    if (this._state === "idle") {
      this._callId = event.callId;
      this._chatId = event.chatId;
      this._callMessageContext = { kind: "unknown" };
      this._mediaType = event.mediaType;
      this._otherUserId = event.otherUserId;
      this._otherDisplayName = event.otherDisplayName;
      this._direction = event.direction;
      this._error = null;
      this._statusText = "Возвращаем в активный звонок…";
      this._state = forceTransition(this._state, "reconnecting");
      this.notify();
    }
    this.ensurePeer(event.mediaType)
      .then(async () => {
        if (this._callId !== event.callId) return;
        if (event.shouldInitiateOffer) {
          if (this.peer?.getConnectionState() === "connected") {
            this.syncCallUiWithPeerIfStable();
            return;
          }
          await this.renegotiateAsCaller(event.callId);
        } else {
          this.signaling.send({ type: "call.resume-request", callId: event.callId });
        }
      })
      .catch((e) => {
        console.error("[call-ctrl] resume ensurePeer error", e);
      })
      .finally(() => {
        this.syncCallUiWithPeerIfStable();
      });
  }

  private handlePeerReconnected(event: Extract<ServerCallEvent, { type: "call.peer-reconnected" }>): void {
    if (!this._callId || event.callId !== this._callId) return;
    if (this._direction !== "outgoing") return;
    if (!isActiveCallState(this._state)) return;
    const pc = this.peer?.getConnectionState();
    if (this._state === "connected" && pc === "connected") {
      return;
    }
    if (this._state === "reconnecting" && pc === "connected") {
      console.info("[call-reconnect] peer-reconnected but media OK — skip reneg");
      this.syncCallUiWithPeerIfStable();
      return;
    }
    console.info("[call-reconnect] peer-reconnected → renegotiate as caller");
    this.renegotiateAsCaller(event.callId).catch((e) => {
      console.error("[call-ctrl] renegotiate on peer reconnect failed", e);
    });
  }

  // ── WebRTC connection state → call state ───────────────────────

  private onConnectionStateChange(pcState: RTCPeerConnectionState): void {
    if (this.destroyed) return;

    if (pcState === "connected") {
      this.clearTimer("connectTimer");
      this.clearTimer("reconnectTimer");
      if (this.supports.networkQuality) {
        this.networkMonitor?.start();
      }
      if (this._state === "connecting" || this._state === "reconnecting") {
        this.setState("connected");
      }
      const pc = this.peer?.getPeerConnection();
      if (pc) {
        void tuneOutgoingVideoSenders(pc, { screenShare: this._isScreenShareActive });
      }
    } else if (pcState === "disconnected" && this._state === "connected") {
      this.setState("reconnecting");
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this._state === "reconnecting") {
          this._error = "Соединение потеряно";
          this.endCallInternal("connection_lost");
        }
      }, Math.max(RECONNECT_TIMEOUT_MS, RESUME_REJOIN_TIMEOUT_MS));
    } else if (pcState === "failed") {
      this._error = "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова.";
      this.endCallInternal("error");
    } else if (pcState === "closed") {
      this.networkMonitor?.stop();
      this._networkQuality = "unknown";
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
    const pc = this.peer.getPeerConnection();
    if (pc && this.supports.networkQuality) {
      this.networkMonitor = new CallNetworkQualityMonitor(pc, (level) => {
        this._networkQuality = level;
        this.notify();
      });
    }
    this.notify();
  }

  private updateRecordingTicker(): void {
    if (this.recordingTicker) {
      clearInterval(this.recordingTicker);
      this.recordingTicker = null;
    }
    if (this._localRecordingState === "recording" || this._localRecordingState === "paused") {
      this.recordingTicker = setInterval(() => {
        this._localRecordingElapsedMs = this.recordingController.getElapsedMs();
        this.notify();
      }, 250);
    }
  }

  private async recreatePeer(mediaType: CallMediaType): Promise<void> {
    this.networkMonitor?.stop();
    this.networkMonitor = null;
    this.peer?.destroy();
    this.peer = null;
    await this.ensurePeer(mediaType);
  }

  private async renegotiateAsCaller(callId: string): Promise<void> {
    if (this._callId !== callId) return;
    await this.recreatePeer(this._mediaType);
    const offer = await this.peer!.createOffer();
    this.signaling.send({ type: "call.offer", callId, sdp: offer });
  }

  private onLocalCaption(text: string): void {
    if (!this._callId || !this._captionsEnabled || !this.supports.captionsRelay || !this.supports.captionsLocalSTT) {
      return;
    }
    const item: CallCaptionEvent = {
      id: crypto.randomUUID(),
      text,
      from: "local",
      sentAt: Date.now(),
    };
    this._captions = [...this._captions.slice(-35), item];
    this.signaling.send({
      type: "call.caption",
      callId: this._callId,
      text,
      sentAt: item.sentAt,
      id: item.id,
    });
    this.notify();
  }

  private endCallInternal(reason: string): void {
    this.stopRingback?.();
    this.stopRingback = null;
    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    this.clearAllTimers();
    this.networkMonitor?.stop();
    this.networkMonitor = null;
    this.screenShareSession?.stop().catch(() => {});
    this.screenShareSession = null;
    this.recordingController.reset();
    this.updateRecordingTicker();
    this.captionsController.stop();

    this.peer?.destroy();
    this.peer = null;
    this.pendingOffer = null;
    this.pendingIceCandidates = [];
    this._isMuted = false;
    this._isScreenShareActive = false;
    this._isCameraEnabled = true;
    this._networkQuality = "unknown";
    this._cameraFacingMode = "user";
    this._captionsEnabled = false;
    this._localRecordingElapsedMs = 0;

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
    this.networkMonitor?.stop();
    this.networkMonitor = null;
    this.screenShareSession?.stop().catch(() => {});
    this.screenShareSession = null;
    this.recordingController.reset();
    this.updateRecordingTicker();
    this.captionsController.stop();

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
    this._callMessageContext = { kind: "unknown" };
    this._error = null;
    this._statusText = null;
    this._incoming = null;
    this._isMuted = false;
    this._networkQuality = "unknown";
    this._cameraFacingMode = "user";
    this._isScreenShareActive = false;
    this._isCameraEnabled = true;
    this._localRecordingState = "idle";
    this._localRecordingElapsedMs = 0;
    this._captionsEnabled = false;
    this._localReactions = [];
    this._remoteReactions = [];
    this._captions = [];
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
