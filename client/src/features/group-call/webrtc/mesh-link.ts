import { transformSdp } from "@/features/call/call-ice-config";

type Handlers = {
  onIceCandidate: (c: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
};

/**
 * Одно P2P-соединение mesh: наш локальный поток → один удалённый участник.
 */
export class GroupMeshLink {
  private pc: RTCPeerConnection | null = null;
  private remoteStream = new MediaStream();
  private pendingIce: RTCIceCandidateInit[] = [];
  private destroyed = false;
  private sendBitratesApplied = false;

  constructor(
    private readonly localStream: MediaStream,
    private readonly rtcConfiguration: RTCConfiguration,
    private readonly handlers: Handlers,
  ) {}

  private ensurePc(): RTCPeerConnection {
    if (this.pc) return this.pc;
    this.pc = new RTCPeerConnection(this.rtcConfiguration);
    this.pc.onicecandidate = (e) => {
      if (e.candidate && !this.destroyed) this.handlers.onIceCandidate(e.candidate.toJSON());
    };
    this.pc.ontrack = (e) => {
      if (this.destroyed) return;
      const s = e.streams[0];
      if (s) s.getTracks().forEach((t) => this.remoteStream.addTrack(t));
      else this.remoteStream.addTrack(e.track);
      this.handlers.onRemoteStream(this.remoteStream);
    };
    this.pc.onconnectionstatechange = () => {
      if (!this.pc || this.destroyed) return;
      if (this.pc.connectionState === "connected") {
        void this.applyPreferredSendBitrates();
      }
      this.handlers.onConnectionState(this.pc.connectionState);
    };
    for (const t of this.localStream.getTracks()) {
      this.pc.addTrack(t, this.localStream);
    }
    return this.pc;
  }

  getRemoteStream(): MediaStream {
    return this.remoteStream;
  }

  /** Повышаем битрейт исходящих потоков после установки соединения (иначе часто остаются дефолты низкого качества). */
  private async applyPreferredSendBitrates(): Promise<void> {
    if (!this.pc || this.destroyed || this.sendBitratesApplied) return;
    this.sendBitratesApplied = true;
    try {
      for (const sender of this.pc.getSenders()) {
        const track = sender.track;
        if (!track) continue;
        const params = sender.getParameters();
        const enc =
          params.encodings && params.encodings.length > 0
            ? params.encodings.map((e, i) =>
                track.kind === "video"
                  ? {
                      ...e,
                      maxBitrate: Math.max(e.maxBitrate ?? 0, i === 0 ? 2_800_000 : 1_200_000),
                      maxFramerate: e.maxFramerate ?? 30,
                    }
                  : {
                      ...e,
                      maxBitrate: Math.max(e.maxBitrate ?? 0, 128_000),
                    },
              )
            : track.kind === "video"
              ? [{ maxBitrate: 2_800_000, maxFramerate: 30 }]
              : [{ maxBitrate: 128_000 }];
        await sender.setParameters({ ...params, encodings: enc });
      }
    } catch {
      /* браузеры отличаются; качество всё равно лучше захвата */
    }
  }

  /** Заменить исходящее видео (камера ↔ экран) на всех связях mesh. */
  async replaceOutgoingVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    if (!this.pc || this.destroyed) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      await sender.replaceTrack(track);
    } else if (track) {
      this.pc.addTrack(track, this.localStream);
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const pc = this.ensurePc();
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    offer.sdp = transformSdp(offer.sdp ?? "");
    await pc.setLocalDescription(offer);
    return pc.localDescription!;
  }

  async applyOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.ensurePc();
    await pc.setRemoteDescription(offer);
    await this.flushIce();
    const answer = await pc.createAnswer();
    answer.sdp = transformSdp(answer.sdp ?? "");
    await pc.setLocalDescription(answer);
    return pc.localDescription!;
  }

  async applyAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(answer);
    await this.flushIce();
  }

  async addIce(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      /* ignore */
    }
  }

  private async flushIce(): Promise<void> {
    if (!this.pc || this.pendingIce.length === 0) return;
    const list = this.pendingIce.splice(0);
    for (const c of list) {
      try {
        await this.pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pendingIce = [];
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.remoteStream = new MediaStream();
  }
}
