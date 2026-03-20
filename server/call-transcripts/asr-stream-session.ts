import { randomUUID } from "crypto";
import WebSocket from "ws";

type TranscriptEvent = {
  segmentId: string;
  isFinal: boolean;
  text: string;
  confidence: number;
};

function authHeaders(): Record<string, string> {
  const token = process.env.CALL_TRANSCRIPTS_ASR_API_KEY?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isStreamingAsrEnabled(): boolean {
  return !!process.env.CALL_TRANSCRIPTS_ASR_WS_URL?.trim();
}

export class AsrStreamSession {
  private ws: WebSocket | null = null;
  private open = false;
  private queue: string[] = [];
  private currentSegmentId = randomUUID();

  constructor(
    private readonly language: string,
    private readonly onTranscript: (event: TranscriptEvent) => void,
  ) {}

  connect(): void {
    const url = process.env.CALL_TRANSCRIPTS_ASR_WS_URL?.trim();
    if (!url || this.ws) return;
    const ws = new WebSocket(url, { headers: authHeaders() });
    this.ws = ws;
    ws.on("open", () => {
      this.open = true;
      ws.send(JSON.stringify({ type: "config", language: this.language }));
      const queued = this.queue.splice(0);
      queued.forEach((item) => ws.send(item));
    });
    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as { type?: string; text?: string; confidence?: number };
        const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
        if (!text) return;
        if (parsed.type === "partial") {
          this.onTranscript({
            segmentId: this.currentSegmentId,
            isFinal: false,
            text,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
          });
          return;
        }
        if (parsed.type === "final") {
          this.onTranscript({
            segmentId: this.currentSegmentId,
            isFinal: true,
            text,
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 82,
          });
          this.currentSegmentId = randomUUID();
        }
      } catch {
        /* ignore */
      }
    });
    const cleanup = () => {
      this.open = false;
      this.ws = null;
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  }

  pushPcmChunk(audioBase64: string): void {
    const payload = JSON.stringify({ type: "audio", audioBase64 });
    if (this.open && this.ws) {
      this.ws.send(payload);
      return;
    }
    this.queue.push(payload);
    this.connect();
  }

  close(): void {
    try {
      this.ws?.send(JSON.stringify({ type: "eof" }));
    } catch {
      /* ignore */
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.open = false;
    this.queue = [];
  }
}
