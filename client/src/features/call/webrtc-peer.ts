import type { WebRtcPeerHandlers, CallMediaType } from "./call-types";
import { getIceServers, getMediaConstraints, transformSdp } from "./call-ice-config";

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
    private readonly iceServers: RTCIceServer[],
    private readonly handlers: WebRtcPeerHandlers,
  ) {}

  // ── Media ──────────────────────────────────────────────────────

  async initLocalMedia(mediaType: CallMediaType): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(
        new Error("Звонки не поддерживаются в этом браузере. Откройте сайт в Safari/Chrome по HTTPS."),
        { name: "NotSupportedError" },
      );
    }

    const attempts: MediaStreamConstraints[] = [
      getMediaConstraints(mediaType === "video"),
      { audio: true, video: mediaType === "video" ? { facingMode: "user" } : false },
      { audio: true, video: mediaType === "video" },
    ];

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

  // ── Peer Connection ────────────────────────────────────────────

  createPeerConnection(): void {
    if (this.destroyed) return;

    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
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
    return "Разрешите доступ к микрофону (и камере для видео) в настройках браузера";
  }
  if (name === "NotFoundError") return "Микрофон или камера не найдены";
  if (name === "NotReadableError") return "Устройство занято другим приложением. Закройте другие звонки/диктофон и попробуйте снова.";
  if (name === "OverconstrainedError") return "Параметры камеры/микрофона не поддерживаются на этом устройстве.";
  return "Нет доступа к микрофону или камере";
}
