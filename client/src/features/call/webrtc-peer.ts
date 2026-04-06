import type { WebRtcPeerHandlers, CallMediaType, CallOutgoingVideoQuality } from "./call-types";
import {
  getMediaConstraints,
  getVideoCallGetUserMediaAttempts,
  isMobileCaptureProfile,
  transformSdp,
} from "./call-ice-config";

/**
 * WebRTC peer connection wrapper.
 * Manages RTCPeerConnection, local/remote media streams, ICE candidate queue.
 * No simple-peer — direct browser API for full control.
 */
export class WebRtcCallPeer {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private destroyed = false;

  constructor(
    private readonly rtcConfiguration: RTCConfiguration,
    private readonly handlers: WebRtcPeerHandlers,
  ) {}

  // ── Media ──────────────────────────────────────────────────────

  async initLocalMedia(mediaType: CallMediaType, opts?: { highQuality?: boolean }): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(
        new Error("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS."),
        { name: "NotSupportedError" },
      );
    }

    const wantVideo = mediaType === "video";
    /**
     * Видео: десктоп — сначала { video: true }; мобильные — facingMode, затем откаты (см. getVideoCallGetUserMediaAttempts).
     * Только аудио: на ПК сначала минимальный запрос (проще диалог разрешений), потом echoCancellation/sampleRate.
     */
    const attempts: MediaStreamConstraints[] = wantVideo
      ? getVideoCallGetUserMediaAttempts(opts)
      : isMobileCaptureProfile()
        ? [getMediaConstraints(false), { audio: true, video: false }]
        : [{ audio: true, video: false }, getMediaConstraints(false)];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        return this.localStream;
      } catch (err) {
        lastErr = err;
        console.warn("[webrtc] getUserMedia attempt failed", err);
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }

  // ── Peer Connection ────────────────────────────────────────────

  createPeerConnection(): void {
    if (this.destroyed) return;

    this.pc = new RTCPeerConnection(this.rtcConfiguration);
    this.remoteStream = new MediaStream();

    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.destroyed) {
        this.handlers.onLocalCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      if (this.destroyed || !this.remoteStream) return;
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      if (!event.streams[0]) {
        this.remoteStream.addTrack(event.track);
      }
      this.handlers.onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && !this.destroyed) {
        this.handlers.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && !this.destroyed) {
        this.handlers.onIceConnectionStateChange(this.pc.iceConnectionState);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
  }

  // ── Offer / Answer ─────────────────────────────────────────────

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection not created");
    const offer = await this.pc.createOffer();
    offer.sdp = transformSdp(offer.sdp ?? "");
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription!;
  }

  /**
   * Смена сети (Wi‑Fi → LTE и т.д.): новый ICE без повторного getUserMedia.
   * Вызывающая сторона шлёт новый offer с iceRestart; вторая сторона отвечает через handleRemoteOffer.
   */
  async createOfferAfterIceRestart(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc || this.destroyed) throw new Error("PeerConnection not created");
    try {
      this.pc.restartIce();
    } catch {
      /* Safari/WebKit старых версий без restartIce */
    }
    const offer = await this.pc.createOffer({ iceRestart: true });
    offer.sdp = transformSdp(offer.sdp ?? "");
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription!;
  }

  async handleRemoteOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("PeerConnection not created");
    await this.pc.setRemoteDescription(offer);
    await this.flushPendingCandidates();
    const answer = await this.pc.createAnswer();
    answer.sdp = transformSdp(answer.sdp ?? "");
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!;
  }

  async handleRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error("PeerConnection not created");
    await this.pc.setRemoteDescription(answer);
    await this.flushPendingCandidates();
  }

  // ── ICE ────────────────────────────────────────────────────────

  async addRemoteIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || this.destroyed) return;

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(candidate);
    } catch (e) {
      console.warn("[webrtc] addIceCandidate failed", e);
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc || this.pendingCandidates.length === 0) return;
    const candidates = this.pendingCandidates.splice(0);
    for (const c of candidates) {
      try {
        await this.pc.addIceCandidate(c);
      } catch (e) {
        console.warn("[webrtc] flush addIceCandidate failed", e);
      }
    }
  }

  // ── Mute / Camera ─────────────────────────────────────────────

  setMicEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }

  setCameraEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }

  // ── Cleanup ────────────────────────────────────────────────────

  getConnectionState(): RTCPeerConnectionState | null {
    return this.pc?.connectionState ?? null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.localStream?.getTracks().forEach((t) => t.stop());
    try { this.pc?.close(); } catch { /* already closed */ }
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.pendingCandidates = [];
  }
}

// ── Static helpers ───────────────────────────────────────────────

/**
 * Поднимаем maxBitrate исходящего видео после установки соединения / смены трека
 * (иначе часто остаются низкие дефолты кодека).
 */
export async function tuneOutgoingVideoSenders(
  pc: RTCPeerConnection,
  opts?: { screenShare?: boolean; quality?: CallOutgoingVideoQuality },
): Promise<void> {
  const screen = opts?.screenShare === true;
  const quality = opts?.quality ?? "medium";
  const presets = screen
    ? {
        low: { maxPrimary: 900_000, maxRtx: 400_000, maxFps: 15 },
        medium: { maxPrimary: 1_600_000, maxRtx: 800_000, maxFps: 20 },
        high: { maxPrimary: 4_000_000, maxRtx: 2_000_000, maxFps: 24 },
      }
    : {
        low: { maxPrimary: 700_000, maxRtx: 300_000, maxFps: 20 },
        medium: { maxPrimary: 1_600_000, maxRtx: 700_000, maxFps: 24 },
        high: { maxPrimary: 2_800_000, maxRtx: 1_200_000, maxFps: 30 },
      };
  const { maxPrimary, maxRtx, maxFps } = presets[quality];
  try {
    for (const sender of pc.getSenders()) {
      const track = sender.track;
      if (!track) continue;
      const params = sender.getParameters();
      const enc =
        params.encodings && params.encodings.length > 0
          ? params.encodings.map((e, i) =>
              track.kind === "video"
                ? {
                    ...e,
                    maxBitrate: Math.max(e.maxBitrate ?? 0, i === 0 ? maxPrimary : maxRtx),
                    maxFramerate: Math.min(e.maxFramerate ?? maxFps, maxFps),
                  }
                : {
                    ...e,
                    maxBitrate: Math.max(e.maxBitrate ?? 0, 128_000),
                  },
            )
          : track.kind === "video"
            ? [{ maxBitrate: maxPrimary, maxFramerate: maxFps }]
            : [{ maxBitrate: 128_000 }];
      await sender.setParameters({ ...params, encodings: enc });
    }
  } catch {
    /* различается по браузерам */
  }
}

export function isWebRtcSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const hasPC =
    typeof RTCPeerConnection === "function" ||
    typeof (window as unknown as { webkitRTCPeerConnection?: unknown }).webkitRTCPeerConnection === "function";
  const hasGUM = typeof navigator.mediaDevices?.getUserMedia === "function";
  return hasPC && hasGUM;
}

export function mapMediaAccessError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Браузер не выдал доступ к микрофону или камере. Проверьте настройки сайта. Если доступ уже включён — закройте другие вкладки с камерой и нажмите зелёную кнопку «ещё раз» сразу после нажатия.";
  }
  if (name === "AbortError") {
    return "Запрос к камере/микрофону прерван. Попробуйте принять звонок или «Позвонить снова» ещё раз.";
  }
  if (name === "SecurityError") {
    return "Звонок доступен только по защищённому соединению (HTTPS). Откройте сайт в обычной вкладке браузера.";
  }
  if (name === "NotFoundError") return "Микрофон или камера не найдены";
  if (name === "NotReadableError") return "Устройство занято другим приложением. Закройте другие звонки/диктофон и попробуйте снова.";
  if (name === "OverconstrainedError") return "Параметры камеры/микрофона не поддерживаются на этом устройстве.";
  return "Нет доступа к микрофону или камере";
}
