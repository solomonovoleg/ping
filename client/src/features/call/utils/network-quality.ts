import type { CallNetworkQualityLevel } from "../call-types";

const POLL_INTERVAL_MS = 2000;

function toLevel(score: number): CallNetworkQualityLevel {
  if (score >= 75) return "good";
  if (score >= 45) return "medium";
  if (score >= 0) return "poor";
  return "unknown";
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function scoreInboundReport(report: RTCInboundRtpStreamStats): number {
  const jitterMs = Number(report.jitter ?? 0) * 1000;
  const packetsReceived = Number(report.packetsReceived ?? 0);
  const packetsLost = Number(report.packetsLost ?? 0);
  const total = packetsReceived + packetsLost;
  const lossPct = total > 0 ? (packetsLost / total) * 100 : 0;

  const jitterPenalty = clamp(jitterMs * 1.2, 0, 45);
  const lossPenalty = clamp(lossPct * 3.2, 0, 55);
  return clamp(100 - jitterPenalty - lossPenalty, 0, 100);
}

export class CallNetworkQualityMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private level: CallNetworkQualityLevel = "unknown";

  constructor(
    private pc: RTCPeerConnection,
    private onLevelChange: (level: CallNetworkQualityLevel) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.poll().catch(() => {
        this.setLevel("unknown");
      });
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private setLevel(next: CallNetworkQualityLevel): void {
    if (next === this.level) return;
    this.level = next;
    this.onLevelChange(next);
  }

  private async poll(): Promise<void> {
    const stats = await this.pc.getStats();
    const scores: number[] = [];
    stats.forEach((report) => {
      if (report.type !== "inbound-rtp") return;
      if ((report as RTCInboundRtpStreamStats).kind !== "audio" && (report as RTCInboundRtpStreamStats).kind !== "video") return;
      scores.push(scoreInboundReport(report as RTCInboundRtpStreamStats));
    });
    if (!scores.length) {
      this.setLevel("unknown");
      return;
    }
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    this.setLevel(toLevel(avg));
  }
}
