function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function f32ToPcm16(input: Float32Array): Uint8Array {
  const out = new Uint8Array(input.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

export class GroupCallPcmStreamer {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private active = false;

  constructor(private readonly onChunk: (audioBase64: string, startedAtMs: number, endedAtMs: number) => void) {}

  start(stream: MediaStream): boolean {
    if (this.active || typeof AudioContext !== "function") return false;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return false;
    const ctx = new AudioContext({ sampleRate: 16000 });
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    let chunkStartedAt = Date.now();
    processor.onaudioprocess = (event) => {
      const endedAtMs = Date.now();
      const pcm = f32ToPcm16(event.inputBuffer.getChannelData(0));
      this.onChunk(toBase64(pcm), chunkStartedAt, endedAtMs);
      chunkStartedAt = endedAtMs;
    };
    source.connect(processor);
    processor.connect(ctx.destination);
    this.ctx = ctx;
    this.source = source;
    this.processor = processor;
    this.active = true;
    return true;
  }

  stop(): void {
    this.active = false;
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;
    this.ctx = null;
  }
}
