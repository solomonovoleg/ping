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
  CallVideoQualityMode,
  CallOutgoingVideoQuality,
} from "./call-types";
import {
  RING_TIMEOUT_MS,
  ACCEPT_TIMEOUT_MS,
  CONNECT_TIMEOUT_MS,
  RECONNECT_TIMEOUT_MS,
} from "./call-types";
import { tryTransition, forceTransition, isActiveCallState, isTerminalState } from "./call-state-machine";
import { WebRtcCallPeer, isWebRtcSupported, mapMediaAccessError, tuneOutgoingVideoSenders } from "./webrtc-peer";
import { getCallRtcConfiguration, getVideoTrackQualityConstraints } from "./call-ice-config";
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
import { applyCallAudioOutputRoute } from "@/lib/call-audio-route";

type StateChangeListener = (snapshot: CallControllerSnapshot) => void;
const RESUME_REJOIN_TIMEOUT_MS = 45_000;
const PEER_DISCONNECTED_GRACE_MS = 2_500;
const ENABLE_AUDIO_ONLY_FALLBACK =
  import.meta.env.VITE_CALLS_AUDIO_ONLY_FALLBACK !== "0" &&
  import.meta.env.VITE_CALLS_AUDIO_ONLY_FALLBACK !== "false";

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
  videoQualityMode: CallVideoQualityMode;
  cameraFacingMode: CallCameraFacingMode;
  isScreenShareActive: boolean;
  /** Собеседник шарит экран — не зеркалить удалённое видео (читаемость текста). */
  remoteScreenShareActive: boolean;
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
  /** Голосовой звонок: true = громкая связь, false = разговорный динамик (только натив). */
  audioOutputSpeaker: boolean;
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
  private _videoQualityMode: CallVideoQualityMode = "auto";
  private appliedVideoQuality: CallOutgoingVideoQuality | null = null;
  private _cameraFacingMode: CallCameraFacingMode = "user";
  private _isScreenShareActive = false;
  private _remoteScreenShareActive = false;
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
  /** Не спамить call.connected для одного callId. */
  private reportedConnectedCallId: string | null = null;
  /** Инкремент при cleanupFull — отменяет хвост очереди resume/reneg. */
  private resumeGeneration = 0;
  /** Последовательная обработка resume (несколько resume-available подряд ломали SDP/ICE). */
  private resumeWorkChain: Promise<void> = Promise.resolve();
  /** Дебаунс call.resume-check при двойном onTransportConnected. */
  private resumeCheckDebounce: ReturnType<typeof setTimeout> | null = null;
  /** Один раз за «жизнь» сокета: в idle запросить активную сессию (пуш / убитое приложение не получили call.incoming по WS). */
  private idlePendingCallProbeSent = false;
  /** Не слать resume-check чаще (два открытия WS подряд → лишний peer-reconnected / reneg у собеседника). */
  private resumeCheckCooldownUntil = 0;
  /** Не слать второй offer сразу после первого при том же callId. */
  private lastRenegotiateOfferAtMs = 0;
  private lastRenegotiateOfferCallId: string | null = null;
  /** Смена сети / ICE failed: один recovery за раз. */
  private iceRecoveryRunning = false;
  /** Один за другим: resume и peer-reconnected не должны параллельно делать recreatePeer. */
  private renegotiateTail: Promise<void> = Promise.resolve();
  private destroyed = false;
  /** По умолчанию громкая связь для audio-only (на телефоне). */
  private _audioOutputSpeaker = true;
  private attemptedAudioOnlyRecovery = false;
  private setupTrace:
    | {
        callId: string;
        startedAt: number;
        inviteSentAt?: number;
        acceptedAt?: number;
        offerAnswerDoneAt?: number;
        connectedAt?: number;
      }
    | null = null;

  private listeners = new Set<StateChangeListener>();

  constructor(
    private signaling: CallSignalingClient,
    private myUserId: string,
  ) {
    this.signaling.onEvent((ev) => this.onServerEvent(ev));
  }

  private logStateTransition(from: CallState, to: CallState, meta?: Record<string, unknown>): void {
    if (from === to) return;
    /** До `acceptCall` у входящего `callId` лежит в `_incoming`, а не в `_callId`. */
    const effectiveCallId = this._callId ?? this._incoming?.callId ?? null;
    console.info("[call] state_transition", {
      callId: effectiveCallId,
      from,
      to,
      direction: this._direction,
      ...meta,
    });
  }

  private setupTraceStart(callId: string): void {
    this.setupTrace = { callId, startedAt: Date.now() };
    console.info("[call-setup] start", { callId });
  }

  private setupTraceMark(stage: "invite_sent" | "accepted" | "offer_answer_done" | "connected"): void {
    if (!this.setupTrace || this.setupTrace.callId !== this._callId) return;
    const now = Date.now();
    if (stage === "invite_sent") this.setupTrace.inviteSentAt = now;
    if (stage === "accepted") this.setupTrace.acceptedAt = now;
    if (stage === "offer_answer_done") this.setupTrace.offerAnswerDoneAt = now;
    if (stage === "connected") this.setupTrace.connectedAt = now;
    console.info("[call-setup] stage", {
      callId: this.setupTrace.callId,
      stage,
      elapsedMs: now - this.setupTrace.startedAt,
    });
  }

  private setupTraceFail(reason: string): void {
    if (!this.setupTrace) return;
    const now = Date.now();
    console.warn("[call-setup] failed", {
      callId: this.setupTrace.callId,
      reason,
      elapsedMs: now - this.setupTrace.startedAt,
      inviteToAcceptedMs:
        this.setupTrace.inviteSentAt && this.setupTrace.acceptedAt
          ? this.setupTrace.acceptedAt - this.setupTrace.inviteSentAt
          : null,
      inviteToConnectedMs:
        this.setupTrace.inviteSentAt && this.setupTrace.connectedAt
          ? this.setupTrace.connectedAt - this.setupTrace.inviteSentAt
          : null,
    });
  }

  private setupTraceComplete(): void {
    if (!this.setupTrace) return;
    const now = Date.now();
    console.info("[call-setup] complete", {
      callId: this.setupTrace.callId,
      elapsedMs: now - this.setupTrace.startedAt,
      inviteToAcceptedMs:
        this.setupTrace.inviteSentAt && this.setupTrace.acceptedAt
          ? this.setupTrace.acceptedAt - this.setupTrace.inviteSentAt
          : null,
      inviteToConnectedMs:
        this.setupTrace.inviteSentAt && this.setupTrace.connectedAt
          ? this.setupTrace.connectedAt - this.setupTrace.inviteSentAt
          : null,
    });
  }

  private async tryAudioOnlyRecovery(reason: string): Promise<boolean> {
    if (!ENABLE_AUDIO_ONLY_FALLBACK) return false;
    if (this._mediaType !== "video" || this.attemptedAudioOnlyRecovery || !this._callId) return false;
    this.attemptedAudioOnlyRecovery = true;
    this._statusText = "Сеть нестабильна, переключаемся на аудио для сохранения связи…";
    this.notify();
    try {
      const callId = this._callId;
      this._mediaType = "audio";
      this._isCameraEnabled = false;
      this._isScreenShareActive = false;
      this._remoteScreenShareActive = false;
      this.peer?.setCameraEnabled(false);
      if (this._direction === "outgoing") {
        await this.renegotiateAsCaller(callId);
      } else {
        this.signaling.send({ type: "call.resume-request", callId });
      }
      await this.runIceRecovery("audio-only-fallback");
      console.info("[call-recovery] switched to audio-only fallback", { callId, reason });
      return true;
    } catch (e) {
      console.warn("[call-recovery] audio-only fallback failed", { reason, err: String(e) });
      return false;
    }
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
    this.setupTraceStart(callId);
    this.attemptedAudioOnlyRecovery = false;
    this._otherUserId = otherUserId;
    this._otherDisplayName = otherName;
    this._otherAvatarUrl = otherAvatarUrl;
    this._chatId = chatId;
    this._callMessageContext = messageContext;
    this._mediaType = mediaType;
    this._direction = "outgoing";
    this._error = null;
    this._statusText = null;
    this._audioOutputSpeaker = mediaType === "audio";
    this.setState("initializing");

    try {
      await this.ensurePeer(mediaType);
      this.setState("outgoing_ringing");

      this.signaling.send({
        type: "call.invite",
        callId,
        toUserId: otherUserId,
        chatId,
        mediaType,
        fromDisplayName: callerDisplayName,
      });
      this.setupTraceMark("invite_sent");

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

  /**
   * Входящий уже показан системой (CallKit) или восстановлен из пуша — подставляем метаданные до accept/reject.
   */
  applyIncomingRingingFromNativeVoip(info: IncomingCallInfo, opts?: { skipAlert?: boolean }): void {
    if (this._state === "incoming_ringing" && this._incoming?.callId === info.callId) {
      this._incoming = {
        ...this._incoming,
        fromDisplayName: info.fromDisplayName || this._incoming.fromDisplayName,
        fromAvatarUrl: info.fromAvatarUrl ?? this._incoming.fromAvatarUrl ?? null,
        mediaType: info.mediaType,
      };
      this.notify();
      return;
    }
    if (isActiveCallState(this._state) && this._state !== "reconnecting") {
      if (this._incoming?.callId === info.callId || this._callId === info.callId) return;
    }
    this.stopIncomingAlert?.();
    this.stopIncomingAlert = null;
    if (!opts?.skipAlert) {
      this.stopIncomingAlert = startIncomingCallAlert(info.fromDisplayName);
    }
    this._incoming = {
      callId: info.callId,
      fromUserId: info.fromUserId,
      fromDisplayName: info.fromDisplayName,
      fromAvatarUrl: info.fromAvatarUrl ?? null,
      chatId: info.chatId,
      mediaType: info.mediaType,
    };
    this._direction = "incoming";
    this.setState("incoming_ringing");
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
    this.setupTraceStart(info.callId);
    this.attemptedAudioOnlyRecovery = false;
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
    this._audioOutputSpeaker = info.mediaType === "audio";
    this.setState("accepting");

    /** Важно: не слать call.accept до getUserMedia + PeerConnection. Иначе сервер и звонящий
     * переходят в «соединяется», а ответа SDP ещё нет — плюс при отказе камеры accept уже ушёл. */
    let serverNotifiedAccepted = false;
    try {
      await this.ensurePeer(info.mediaType);
      this.signaling.send({ type: "call.accept", callId: info.callId });
      this.setupTraceMark("accepted");
      serverNotifiedAccepted = true;
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
      if (serverNotifiedAccepted && this._callId) {
        this.signaling.send({ type: "call.hangup", callId: this._callId });
      } else if (this._callId) {
        this.signaling.send({ type: "call.reject", callId: this._callId, reason: "declined" });
      }
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

    const eventType =
      this._state === "outgoing_ringing" || this._state === "initializing"
        ? ("call.cancel" as const)
        : ("call.hangup" as const);
    this.signaling.send({ type: eventType, callId: this._callId });
    /** Красная кнопка / отмена исходящего — сразу idle, без фантомного «восстановления». */
    this.endCallInternal("hangup", { immediateIdle: true });
  }

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    this.peer?.setMicEnabled(!muted);
    this.notify();
  }

  /** Переключение динамика (только смысл при `mediaType === "audio"` и нативном приложении). */
  setAudioOutputSpeaker(speaker: boolean): void {
    if (this._mediaType !== "audio") return;
    this._audioOutputSpeaker = speaker;
    void applyCallAudioOutputRoute(speaker);
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
    await this.applyOutgoingVideoQuality({ force: true });
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
      await this.applyOutgoingVideoQuality({ force: true });
      return;
    }

    this.screenShareSession = await startScreenShare(pc, local);
    this._isScreenShareActive = true;
    if (this._callId) {
      this.signaling.send({ type: "call.screen-share-state", callId: this._callId, active: true });
    }
    this.notify();
    await this.applyOutgoingVideoQuality({ force: true });
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

  toggleVideoHd(): void {
    if (this._mediaType !== "video") return;
    this._videoQualityMode = this._videoQualityMode === "hd" ? "auto" : "hd";
    this.notify();
    void this.applyOutgoingVideoQuality({ force: true }).then(() => {
      if (!this.destroyed) this.notify();
    });
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
    void this.startCall(userId, name, avatar, chatId, mediaType, "", messageContext).catch((e) => {
      console.warn("[call] retryCall startCall failed", e);
    });
  }

  /** Call this when the WebSocket disconnects. */
  onTransportDisconnected(): void {
    this.idlePendingCallProbeSent = false;
    if (!isActiveCallState(this._state)) return;
    // На стадии дозвона это не "восстановление разговора": при кратком переподключении WS
    // нельзя уводить UI в reconnecting, иначе следующий звонок выглядит как resume старого.
    if (this._state === "initializing" || this._state === "outgoing_ringing" || this._state === "incoming_ringing") {
      return;
    }
    const pcState = this.peer?.getConnectionState() ?? null;
    // Если media-канал уже живой, потеря только /calls WS не должна переключать звонок
    // в reconnecting и показывать "восстановление соединения".
    if (pcState === "connected" && this._state === "connected") {
      console.info("[call-reconnect] ws closed but media still connected — keep connected state");
      return;
    }
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
    if (this.resumeCheckDebounce) clearTimeout(this.resumeCheckDebounce);
    this.resumeCheckDebounce = setTimeout(() => {
      this.resumeCheckDebounce = null;
      if (this.destroyed) return;
      /** Пока UI в idle, сервер всё ещё может держать ringing-сессию (клиент не был на сокете в момент invite). */
      if (this._state === "idle" && !this.idlePendingCallProbeSent) {
        this.idlePendingCallProbeSent = true;
        console.info("[call-reconnect] ws open (idle) → resume-check (pending session on server)");
        this.signaling.send({ type: "call.resume-check" });
        return;
      }
      /** Звонок уже завершён / не начат — не будить сервер resume-check (ложное «восстановление» в чате). */
      if (!isActiveCallState(this._state)) return;
      if (!this._callId && !this._incoming?.callId) return;
      const now = Date.now();
      const reconnecting = this._state === "reconnecting";
      if (!reconnecting && now < this.resumeCheckCooldownUntil) {
        return;
      }
      this.resumeCheckCooldownUntil = now + 2000;
      console.info("[call-reconnect] ws open → resume-check");
      this.signaling.send({ type: "call.resume-check" });
    }, 320);
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
      videoQualityMode: this._videoQualityMode,
      cameraFacingMode: this._cameraFacingMode,
      isScreenShareActive: this._isScreenShareActive,
      remoteScreenShareActive: this._remoteScreenShareActive,
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
      audioOutputSpeaker: this._audioOutputSpeaker,
    };
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getSnapshot());
    } catch (e) {
      console.error("[call-ctrl] listener error", e);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    if (this.resumeCheckDebounce) {
      clearTimeout(this.resumeCheckDebounce);
      this.resumeCheckDebounce = null;
    }
    this.cleanupFull();
    const subs = [...this.listeners];
    this.listeners.clear();
    const snap = this.getSnapshot();
    this.destroyed = true;
    for (const fn of subs) {
      try {
        fn(snap);
      } catch (e) {
        console.error("[call-ctrl] listener error", e);
      }
    }
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
      case "call.connected":
        this.handleConnectedEvent(event);
        break;
    }
  }

  private handleIncoming(event: Extract<ServerCallEvent, { type: "call.incoming" }>): void {
    if (this._state === "incoming_ringing" && this._incoming?.callId === event.callId) {
      this._incoming = {
        ...this._incoming,
        fromDisplayName: event.fromDisplayName || this._incoming.fromDisplayName,
        fromAvatarUrl: event.fromAvatarUrl ?? this._incoming.fromAvatarUrl ?? null,
      };
      this.notify();
      return;
    }

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
    this._direction = "incoming";
    this.setState("incoming_ringing");
  }

  private handleAccepted(event: Extract<ServerCallEvent, { type: "call.accepted" }>): void {
    if (event.callId !== this._callId) return;

    this.stopRingback?.();
    this.stopRingback = null;
    this.clearTimer("ringTimer");

    if (this._state === "outgoing_ringing") {
      this.setupTraceMark("accepted");
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
      this.setupTraceMark("offer_answer_done");
    } catch (e) {
      console.warn("[call-ctrl] handleOffer first attempt failed, recreating peer", e);
      try {
        await this.recreatePeer(this._mediaType);
        const answer = await this.peer!.handleRemoteOffer(event.sdp);
        this.signaling.send({ type: "call.answer", callId: event.callId, sdp: answer });
        this.setupTraceMark("offer_answer_done");
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
      this.setupTraceMark("offer_answer_done");
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
    const incomingRinging = this._state === "incoming_ringing";
    if (event.type === "call.canceled" && incomingRinging) {
      this._statusText = "Пропущенный звонок";
      this.endCallInternal("timeout");
      return;
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

    this._statusText = this._direction === "incoming" ? "Пропущенный звонок" : "Недозвон";
    this._error = null;
    this.endCallInternal("timeout");
  }

  private handleConnectedEvent(event: Extract<ServerCallEvent, { type: "call.connected" }>): void {
    if (event.callId !== this._callId) return;
    // Если сигнал accepted потерялся, но сервер прислал connected-подтверждение,
    // выводим UI в "подключено" и гасим "вызов...".
    this.stopRingback?.();
    this.stopRingback = null;
    this.clearTimer("ringTimer");
    this.clearTimer("connectTimer");
    this._statusText = null;
    if (this._state === "outgoing_ringing") {
      const next = tryTransition(this._state, "connecting");
      this._state = next ?? forceTransition(this._state, "connecting");
    }
    if (this._state === "connecting" || this._state === "reconnecting") {
      this.setState("connected");
    } else {
      this.notify();
    }
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
    this._remoteScreenShareActive = event.active;
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
    this._audioOutputSpeaker = event.mediaType === "audio";
    this._direction = "incoming";
    this._error = null;
    this._statusText = null;
    const prev = this._state;
    this._state = forceTransition(this._state, "incoming_ringing");
    this.logStateTransition(prev, this._state, { reason: "glare-merge" });
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
    const prev = this._state;
    const next = tryTransition(this._state, "connected");
    this._state = next ?? forceTransition(this._state, "connected");
    this.logStateTransition(prev, this._state, { reason: "peer-stable-after-reconnect" });
    if (this._mediaType === "audio") {
      void applyCallAudioOutputRoute(this._audioOutputSpeaker);
    }
    this.notify();
  }

  private handleResumeAvailable(event: Extract<ServerCallEvent, { type: "call.resume-available" }>): void {
    // После сброса/отклонения `_callId` ещё секунды висит до cleanup — нельзя снова «въезжать» в звонок по resume.
    if (isTerminalState(this._state)) return;
    if (this._callId && this._callId !== event.callId && isActiveCallState(this._state)) return;

    console.info("[call-reconnect] resume-available", {
      callId: event.callId,
      shouldOffer: event.shouldInitiateOffer,
      sessionState: event.sessionState,
      uiState: this._state,
      peerState: this.peer?.getConnectionState() ?? null,
    });

    // WS подключился позже call.incoming: на сервере ещё ringing — показываем входящий, не «возврат в звонок».
    if (this._state === "idle" && event.direction === "incoming" && event.sessionState === "ringing") {
      this.stopIncomingAlert?.();
      this.stopIncomingAlert = startIncomingCallAlert(event.otherDisplayName);
      this._incoming = {
        callId: event.callId,
        fromUserId: event.otherUserId,
        fromDisplayName: event.otherDisplayName,
        fromAvatarUrl: event.otherAvatarUrl ?? null,
        chatId: event.chatId,
        mediaType: event.mediaType,
      };
      this._direction = "incoming";
      this.setState("incoming_ringing");
      return;
    }

    if (this._incoming && !this._callId && event.callId === this._incoming.callId) {
      this._statusText = null;
      this.clearTimer("reconnectTimer");
      if (this._state === "reconnecting") {
        const prev = this._state;
        this._direction = "incoming";
        this._state = forceTransition(this._state, "incoming_ringing");
        this.logStateTransition(prev, this._state, { reason: "resume-incoming-ringing" });
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
      this._otherAvatarUrl = event.otherAvatarUrl ?? null;
      this._direction = event.direction;
      this._error = null;
      // Исходящий ещё звонит (например перезагрузка страницы) — не путать с ICE-reconnect.
      if (event.direction === "outgoing" && event.sessionState === "ringing") {
        this._statusText = null;
        this.setState("outgoing_ringing");
        this.stopRingback?.();
        this.stopRingback = startRingbackTone();
        this.clearTimer("ringTimer");
        this.ringTimer = setTimeout(() => {
          this.ringTimer = null;
          if (this._state === "outgoing_ringing") {
            this._error = "Абонент не отвечает";
            this.endCallInternal("timeout");
          }
        }, RING_TIMEOUT_MS);
      } else {
        /** Сервер шлёт `sessionState: accepted` почти до конца звонка — для UI это «подключение», не обрыв медиа.
         * Состояние только `reconnecting`: если поставить `connecting`, `inInitialNegotiation` срежет renegotiate у звонящего. */
        const serverPastRing =
          event.sessionState === "accepted" ||
          event.sessionState === "connecting" ||
          event.sessionState === "connected";
        this._statusText = serverPastRing
          ? "Подключаемся к звонку…"
          : "Возвращаем в активный звонок…";
        const prev = this._state;
        const next = tryTransition(this._state, "reconnecting");
        this._state = next ?? forceTransition(this._state, "reconnecting");
        this.logStateTransition(prev, this._state, { reason: "resume-available-reconnect" });
        this.clearTimer("connectTimer");
        this.connectTimer = setTimeout(() => {
          this.connectTimer = null;
          if (this._state === "reconnecting") {
            this._error = "Не удалось восстановить звонок. Завершите или наберите снова.";
            this.endCallInternal("error");
          }
        }, CONNECT_TIMEOUT_MS);
      }
      this.notify();
    }
    const gen = this.resumeGeneration;
    this.resumeWorkChain = this.resumeWorkChain
      .then(() => this.runResumeMediaPipeline(event, gen))
      .catch((e) => console.error("[call-ctrl] resume pipeline error", e));
  }

  private async runResumeMediaPipeline(
    event: Extract<ServerCallEvent, { type: "call.resume-available" }>,
    generation: number,
  ): Promise<void> {
    if (this.destroyed || generation !== this.resumeGeneration) return;
    if (isTerminalState(this._state)) return;
    if (this._callId !== event.callId) return;
    try {
      await this.ensurePeer(event.mediaType);
    } catch (e) {
      console.error("[call-ctrl] resume ensurePeer error", e);
      if (this.destroyed || generation !== this.resumeGeneration) return;
      this._error =
        e instanceof Error ? mapMediaAccessError(e) : "Не удалось включить микрофон для восстановления звонка";
      this.notify();
      return;
    }
    if (this.destroyed || generation !== this.resumeGeneration) return;
    if (this._callId !== event.callId) return;
    const pcState = this.peer?.getConnectionState() ?? null;
    /** WS часто шлёт второй onConnected → resume-check во время первичного SDP; recreatePeer срывает установку связи.
     * Не трогаем outgoing_ringing — после перезагрузки страницы нужен новый offer. */
    const inInitialNegotiation =
      this.peer != null &&
      pcState !== "failed" &&
      pcState !== "closed" &&
      (this._state === "connecting" || this._state === "accepting");
    try {
      if (event.shouldInitiateOffer) {
        if (pcState === "connected") {
          this.syncCallUiWithPeerIfStable();
          return;
        }
        if (inInitialNegotiation) {
          console.info("[call-reconnect] skip resume reneg during initial negotiation", {
            uiState: this._state,
            pcState,
            callId: event.callId,
          });
          return;
        }
        const now = Date.now();
        if (
          this.lastRenegotiateOfferCallId === event.callId &&
          now - this.lastRenegotiateOfferAtMs < 3500
        ) {
          console.info("[call-reconnect] skip duplicate renegotiate burst", { callId: event.callId });
          return;
        }
        this.lastRenegotiateOfferCallId = event.callId;
        this.lastRenegotiateOfferAtMs = now;
        await this.renegotiateAsCaller(event.callId);
      } else {
        if (inInitialNegotiation) {
          console.info("[call-reconnect] skip resume-request during initial negotiation", {
            uiState: this._state,
            pcState,
          });
          return;
        }
        this.signaling.send({ type: "call.resume-request", callId: event.callId });
      }
    } finally {
      this.syncCallUiWithPeerIfStable();
    }
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

  /**
   * Смена сети (Wi‑Fi ↔ LTE): без recreatePeer — новый ICE gather поверх тех же треков.
   * Исходящий абонент шлёт offer с iceRestart; входящий — resume-request (сервер/партнёр поднимут re-offer).
   */
  private async runIceRecovery(source: string): Promise<void> {
    if (this.iceRecoveryRunning) return;
    if (this.destroyed || !this._callId || !this.peer) return;
    if (isTerminalState(this._state)) return;
    if (this.peer.getConnectionState() === "connected") {
      this.syncCallUiWithPeerIfStable();
      return;
    }

    this.iceRecoveryRunning = true;
    const callId = this._callId;
    const task = async (): Promise<void> => {
      if (this.destroyed || this._callId !== callId || !this.peer) return;
      if (this.peer.getConnectionState() === "connected") {
        this.syncCallUiWithPeerIfStable();
        return;
      }

      const now = Date.now();
      if (
        this.lastRenegotiateOfferCallId === callId &&
        now - this.lastRenegotiateOfferAtMs < 2000
      ) {
        console.info("[call-reconnect] skip ice recovery burst", { callId, source });
        return;
      }
      this.lastRenegotiateOfferCallId = callId;
      this.lastRenegotiateOfferAtMs = now;

      try {
        if (this._direction === "outgoing") {
          const offer = await this.peer.createOfferAfterIceRestart();
          if (this.destroyed || this._callId !== callId) return;
          this.signaling.send({ type: "call.offer", callId, sdp: offer });
        } else {
          this.signaling.send({ type: "call.resume-request", callId });
        }
      } catch (e) {
        console.error("[call-reconnect] ICE recovery failed", source, e);
        if (this.destroyed || this._callId !== callId) return;
        this.signaling.send({ type: "call.resume-check" });
      }
    };

    try {
      const p = this.renegotiateTail.then(task);
      this.renegotiateTail = p.catch((e) => {
        console.error("[call-reconnect] renegotiateTail ice recovery", e);
      });
      await p;
    } finally {
      this.iceRecoveryRunning = false;
    }
  }

  // ── WebRTC connection state → call state ───────────────────────

  private onConnectionStateChange(pcState: RTCPeerConnectionState): void {
    if (this.destroyed) return;

    if (pcState === "connected") {
      // Против потери `call.accepted`: медиа уже поднялось, значит дозвон должен
      // завершиться немедленно (без зависшего рингбэка/таймера "Вызов...").
      this.stopRingback?.();
      this.stopRingback = null;
      this.clearTimer("ringTimer");
      this.clearTimer("connectTimer");
      this.clearTimer("reconnectTimer");
      this.lastRenegotiateOfferCallId = null;
      this.lastRenegotiateOfferAtMs = 0;
      if (this.supports.networkQuality) {
        this.networkMonitor?.start();
      }
      if (this._mediaType === "audio") {
        void applyCallAudioOutputRoute(this._audioOutputSpeaker);
      }
      if (this._callId && this.reportedConnectedCallId !== this._callId) {
        this.reportedConnectedCallId = this._callId;
        this.signaling.send({ type: "call.connected", callId: this._callId });
      }
      this.setupTraceMark("connected");
      this.setupTraceComplete();
      if (this._state === "outgoing_ringing") {
        const next = tryTransition(this._state, "connecting");
        this._state = next ?? forceTransition(this._state, "connecting");
      }
      if (this._state === "connecting" || this._state === "reconnecting") {
        this.setState("connected");
      }
      void this.applyOutgoingVideoQuality({ force: true });
    } else if (pcState === "disconnected" && this._state === "connected") {
      // Короткие network jitter'ы не должны мгновенно переводить звонок в reconnecting.
      this.clearTimer("reconnectTimer");
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this._state !== "connected") return;
        const still = this.peer?.getConnectionState() ?? null;
        if (still !== "disconnected") return;

        this._statusText = "Восстанавливаем связь после обрыва…";
        this.setState("reconnecting");
        void this.runIceRecovery("disconnected-persist");
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this._state === "reconnecting") {
            void this.tryAudioOnlyRecovery("peer-disconnected-timeout").then((switched) => {
              if (switched) return;
              this._error = "Соединение потеряно";
              this.endCallInternal("connection_lost");
            });
          }
        }, Math.max(RECONNECT_TIMEOUT_MS, RESUME_REJOIN_TIMEOUT_MS));
      }, PEER_DISCONNECTED_GRACE_MS);
    } else if (pcState === "failed") {
      /** Уже в разговоре: смена сети часто даёт failed — пробуем ICE restart, а не сразу сброс. */
      const midCallRecoverable =
        this._callId != null && (this._state === "connected" || this._state === "reconnecting");
      if (midCallRecoverable) {
        console.warn("[call-reconnect] connectionState failed — ICE restart / resume-request", {
          direction: this._direction,
          uiState: this._state,
        });
        this.clearTimer("reconnectTimer");
        this._error = null;
        this._statusText = "Смена сети, восстанавливаем связь…";
        if (this._state === "connected") {
          const prev = this._state;
          const next = tryTransition(this._state, "reconnecting");
          this._state = next ?? forceTransition(this._state, "reconnecting");
          this.logStateTransition(prev, this._state, { reason: "ice-failed-recovery" });
          this.notify();
        }
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this._state === "reconnecting" && this.peer?.getConnectionState() !== "connected") {
            void this.tryAudioOnlyRecovery("ice-failed-timeout").then((switched) => {
              if (switched) return;
              this._error = "Не удалось восстановить связь после смены сети";
              this.endCallInternal("connection_lost");
            });
          }
        }, RESUME_REJOIN_TIMEOUT_MS);
        void this.runIceRecovery("connection-failed");
      } else {
        this._error = "Не удалось установить связь. Проверьте интернет или попробуйте позвонить снова.";
        this.endCallInternal("error");
      }
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
        this.setupTraceMark("offer_answer_done");
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

    const peer = new WebRtcCallPeer(getCallRtcConfiguration("1to1"), {
      onLocalCandidate: (candidate) => {
        if (this._callId) {
          this.signaling.send({ type: "call.ice-candidate", callId: this._callId, candidate });
        }
      },
      onRemoteStream: () => this.notify(),
      onConnectionStateChange: (s) => this.onConnectionStateChange(s),
      onIceConnectionStateChange: () => this.notify(),
    });

    const wantHighCapture =
      mediaType === "video" &&
      (this._videoQualityMode === "hd" ||
        (this._videoQualityMode === "auto" && this._networkQuality === "good"));
    try {
      await peer.initLocalMedia(mediaType, { highQuality: wantHighCapture });
    } catch (e) {
      peer.destroy();
      throw e;
    }
    this.peer = peer;
    peer.createPeerConnection();
    const pc = peer.getPeerConnection();
    if (pc && this.supports.networkQuality) {
      this.networkMonitor = new CallNetworkQualityMonitor(pc, (level) => {
        this._networkQuality = level;
        void this.applyOutgoingVideoQuality().then(() => {
          if (!this.destroyed) this.notify();
        });
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
    this.appliedVideoQuality = null;
    await this.ensurePeer(mediaType);
  }

  private resolveOutgoingVideoQuality(): CallOutgoingVideoQuality {
    if (this._videoQualityMode === "hd") return "high";
    if (!this.supports.networkQuality) return "medium";
    switch (this._networkQuality) {
      case "good":
        return "high";
      case "medium":
        return "medium";
      case "poor":
        return "low";
      default:
        return "medium";
    }
  }

  private async applyOutgoingVideoQuality(opts?: { force?: boolean }): Promise<void> {
    if (this.destroyed) return;
    if (this._mediaType !== "video") return;
    const pc = this.peer?.getPeerConnection();
    if (!pc || this.peer?.getConnectionState() !== "connected") return;

    const next = this.resolveOutgoingVideoQuality();
    if (!opts?.force && this.appliedVideoQuality === next) return;

    if (!this._isScreenShareActive) {
      const local = this.peer.getLocalStream();
      const vTrack = local?.getVideoTracks().find((t) => t.readyState === "live" && t.kind === "video");
      if (vTrack) {
        try {
          await vTrack.applyConstraints(getVideoTrackQualityConstraints(next));
        } catch {
          /* часть браузеров не применяет разрешение на лету */
        }
      }
    }

    await tuneOutgoingVideoSenders(pc, { screenShare: this._isScreenShareActive, quality: next });
    this.appliedVideoQuality = next;
  }

  private async renegotiateAsCaller(callId: string): Promise<void> {
    const task = async (): Promise<void> => {
      if (this.destroyed || this._callId !== callId) return;
      await this.recreatePeer(this._mediaType);
      if (this.destroyed || this._callId !== callId) return;
      const offer = await this.peer!.createOffer();
      this.signaling.send({ type: "call.offer", callId, sdp: offer });
    };
    const p = this.renegotiateTail.then(task);
    this.renegotiateTail = p.catch((e) => {
      console.error("[call-ctrl] renegotiateAsCaller error", e);
    });
    await p;
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

  private endCallInternal(reason: string, opts?: { immediateIdle?: boolean }): void {
    const callKitEndId = this._callId ?? this._incoming?.callId ?? null;
    this.cancelPendingResumeCheck();
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
    this._remoteScreenShareActive = false;
    this._isCameraEnabled = true;
    this._networkQuality = "unknown";
    this._videoQualityMode = "auto";
    this.appliedVideoQuality = null;
    this._cameraFacingMode = "user";
    this._captionsEnabled = false;
    this._localRecordingElapsedMs = 0;

    let targetState: CallState;
    switch (reason) {
      case "hangup": targetState = "ended"; break;
      case "rejected": targetState = "rejected"; break;
      case "busy": targetState = "busy"; break;
      case "timeout": targetState = "missed"; break;
      case "canceled": targetState = "ended"; break;
      case "connection_lost": targetState = "failed"; break;
      default: targetState = "failed"; break;
    }
    if (targetState === "failed" || targetState === "missed" || targetState === "busy" || targetState === "rejected") {
      this.setupTraceFail(reason);
    }

    const prev = this._state;
    const result = tryTransition(this._state, targetState);
    if (result) {
      this._state = result;
    } else {
      this._state = forceTransition(this._state, targetState);
    }
    this.logStateTransition(prev, this._state, { reason });

    /** Сброс текста «восстановление / связь потеряна» — иначе после красной кнопки модалка и контекст «висят» в режиме reconnect. */
    this._statusText = null;
    if (reason !== "connection_lost" && reason !== "error") {
      this._error = null;
    }

    this.notify();

    if (callKitEndId) {
      void import("@/lib/ios-callkit-bridge").then((m) =>
        m.notifyIosCallKitCallEndedIfNeeded(callKitEndId),
      );
    }

    // Только локальный сброс (красная кнопка): сразу idle — WS не должен продолжать сценарий resume.
    if (targetState !== "failed" && opts?.immediateIdle === true) {
      this.cleanupFull();
      this.notify();
      return;
    }

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

    const prev = this._state;
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
    this._videoQualityMode = "auto";
    this.appliedVideoQuality = null;
    this._cameraFacingMode = "user";
    this._isScreenShareActive = false;
    this._remoteScreenShareActive = false;
    this._isCameraEnabled = true;
    this._localRecordingState = "idle";
    this._localRecordingElapsedMs = 0;
    this._captionsEnabled = false;
    this._localReactions = [];
    this._remoteReactions = [];
    this._captions = [];
    this._audioOutputSpeaker = true;
    this.resumeGeneration += 1;
    this.resumeWorkChain = Promise.resolve();
    this.renegotiateTail = Promise.resolve();
    this.iceRecoveryRunning = false;
    this.lastRenegotiateOfferCallId = null;
    this.lastRenegotiateOfferAtMs = 0;
    this.reportedConnectedCallId = null;
    this.idlePendingCallProbeSent = false;
    if (this.resumeCheckDebounce) {
      clearTimeout(this.resumeCheckDebounce);
      this.resumeCheckDebounce = null;
    }
    this.logStateTransition(prev, this._state, { reason: "cleanup" });
    this.setupTrace = null;
    this.attemptedAudioOnlyRecovery = false;
  }

  private setState(next: CallState): void {
    const prev = this._state;
    const result = tryTransition(this._state, next);
    if (result) {
      this._state = result;
      this.logStateTransition(prev, this._state);
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

  /** Отменить отложенный resume-check (иначе после красной кнопки WS шлёт check и UI «как будто звонок ещё живёт»). */
  private cancelPendingResumeCheck(): void {
    if (this.resumeCheckDebounce) {
      clearTimeout(this.resumeCheckDebounce);
      this.resumeCheckDebounce = null;
    }
  }
}
