import { getIceServers } from "@/features/call/call-ice-config";
import { GroupMeshLink } from "../webrtc/mesh-link";

export type RosterParticipant = { userId: string; displayName: string };

type SignalSender = (toUserId: string, msg: Record<string, unknown>) => void;

/**
 * Полный mesh: по одному GroupMeshLink на удалённого участника.
 * Инициатор SDP — пользователь с меньшим userId (стабильная сортировка).
 */
export class GroupMeshRegistry {
  private readonly ice = getIceServers();
  private readonly links = new Map<string, GroupMeshLink>();
  private myUserId = "";
  private roomId = "";
  private sendSignal: SignalSender = () => {};

  init(params: { myUserId: string; roomId: string; sendSignal: SignalSender }): void {
    this.myUserId = params.myUserId;
    this.roomId = params.roomId;
    this.sendSignal = params.sendSignal;
    this.disposeLinks();
  }

  disposeLinks(): void {
    this.links.forEach((l) => l.destroy());
    this.links.clear();
  }

  fullDispose(): void {
    this.disposeLinks();
    this.myUserId = "";
    this.roomId = "";
    this.sendSignal = () => {};
  }

  onRoster(localStream: MediaStream, participants: RosterParticipant[]): void {
    const ids = new Set(participants.map((p) => p.userId));
    Array.from(this.links.entries()).forEach(([uid, link]) => {
      if (!ids.has(uid) || uid === this.myUserId) {
        link.destroy();
        this.links.delete(uid);
      }
    });

    for (const p of participants) {
      if (p.userId === this.myUserId) continue;
      if (this.links.has(p.userId)) continue;
      if (this.myUserId < p.userId) {
        const link = new GroupMeshLink(localStream, this.ice, {
          onIceCandidate: (candidate) => {
            this.sendSignal(p.userId, {
              type: "group.signal",
              roomId: this.roomId,
              toUserId: p.userId,
              signalType: "ice",
              candidate,
            });
          },
          onRemoteStream: () => {},
          onConnectionState: () => {},
        });
        this.links.set(p.userId, link);
        void link.createOffer().then((sdp) => {
          this.sendSignal(p.userId, {
            type: "group.signal",
            roomId: this.roomId,
            toUserId: p.userId,
            signalType: "offer",
            sdp,
          });
        });
      }
    }
  }

  getRemoteStream(peerId: string): MediaStream | null {
    return this.links.get(peerId)?.getRemoteStream() ?? null;
  }

  async replaceOutgoingVideoTrackOnAllLinks(track: MediaStreamTrack | null): Promise<void> {
    await Promise.all([...this.links.values()].map((link) => link.replaceOutgoingVideoTrack(track)));
  }

  /**
   * Демонстрация экрана: отдельный clone видеотрека на каждого участника (один track нельзя надёжно вешать на несколько PC).
   * Возвращает клоны — их нужно остановить после replace обратно на камеру.
   */
  async replaceOutgoingScreenVideoTrack(masterVideo: MediaStreamTrack): Promise<MediaStreamTrack[]> {
    const links = [...this.links.values()];
    const clones: MediaStreamTrack[] = [];
    for (const link of links) {
      const c = masterVideo.clone();
      clones.push(c);
      await link.replaceOutgoingVideoTrack(c);
    }
    return clones;
  }

  async onSignal(
    fromUserId: string,
    signalType: string,
    sdp: RTCSessionDescriptionInit | undefined,
    candidate: RTCIceCandidateInit | undefined,
    localStream: MediaStream,
  ): Promise<void> {
    if (fromUserId === this.myUserId) return;
    let link = this.links.get(fromUserId);
    if (!link && signalType === "offer" && sdp) {
      link = new GroupMeshLink(localStream, this.ice, {
        onIceCandidate: (c) => {
          this.sendSignal(fromUserId, {
            type: "group.signal",
            roomId: this.roomId,
            toUserId: fromUserId,
            signalType: "ice",
            candidate: c,
          });
        },
        onRemoteStream: () => {},
        onConnectionState: () => {},
      });
      this.links.set(fromUserId, link);
      const answer = await link.applyOffer(sdp);
      this.sendSignal(fromUserId, {
        type: "group.signal",
        roomId: this.roomId,
        toUserId: fromUserId,
        signalType: "answer",
        sdp: answer,
      });
      return;
    }
    if (!link) return;
    if (signalType === "answer" && sdp) {
      await link.applyAnswer(sdp);
      return;
    }
    if (signalType === "ice" && candidate) {
      await link.addIce(candidate);
    }
  }
}
