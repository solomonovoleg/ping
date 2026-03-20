type RecordingState = "idle" | "recording" | "paused" | "stopping" | "error";

/**
 * Запись звонка: только медиапотоки (без UI). Видео — композит «собеседник на весь кадр + вы в углу»;
 * звук — микс микрофона и удалённого аудио через Web Audio (стабильнее, чем несколько audio-треков в MediaRecorder).
 */
export class LocalRecordingController {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private state: RecordingState = "idle";
  private startedAtMs: number | null = null;
  private accumulatedMs = 0;

  private canvas: HTMLCanvasElement | null = null;
  private localVideo: HTMLVideoElement | null = null;
  private remoteVideo: HTMLVideoElement | null = null;
  private rafId = 0;
  private compositeRunning = false;
  private audioContext: AudioContext | null = null;

  constructor(private onStateChange: (state: RecordingState) => void) {}

  getState(): RecordingState {
    return this.state;
  }

  async start(localStream: MediaStream, remoteStream: MediaStream): Promise<void> {
    if (this.state === "recording") return;

    const localVideoTracks = localStream.getVideoTracks().filter((t) => t.readyState === "live");
    const remoteVideoTracks = remoteStream.getVideoTracks().filter((t) => t.readyState === "live");
    const hasVideo = localVideoTracks.length > 0 || remoteVideoTracks.length > 0;

    const audioCtx = new AudioContext();
    this.audioContext = audioCtx;
    await audioCtx.resume().catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();

    for (const t of localStream.getAudioTracks()) {
      if (t.readyState !== "live") continue;
      try {
        const src = audioCtx.createMediaStreamSource(new MediaStream([t]));
        src.connect(dest);
      } catch {
        /* ignore */
      }
    }
    for (const t of remoteStream.getAudioTracks()) {
      if (t.readyState !== "live") continue;
      try {
        const src = audioCtx.createMediaStreamSource(new MediaStream([t]));
        src.connect(dest);
      } catch {
        /* ignore */
      }
    }

    const audioOut = dest.stream.getAudioTracks();
    if (audioOut.length === 0 && !hasVideo) {
      await audioCtx.close().catch(() => {});
      this.audioContext = null;
      this.setState("error");
      return;
    }

    let mediaStream: MediaStream;

    if (!hasVideo) {
      mediaStream = new MediaStream([...audioOut]);
    } else {
      const canvas = document.createElement("canvas");
      const w = 1280;
      const h = 720;
      canvas.width = w;
      canvas.height = h;
      this.canvas = canvas;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) {
        await audioCtx.close().catch(() => {});
        this.audioContext = null;
        this.setState("error");
        return;
      }

      const localV = document.createElement("video");
      const remoteV = document.createElement("video");
      localV.muted = true;
      remoteV.muted = true;
      localV.playsInline = true;
      remoteV.playsInline = true;
      localV.setAttribute("playsinline", "true");
      remoteV.setAttribute("playsinline", "true");
      localV.srcObject = new MediaStream(localVideoTracks.length ? localVideoTracks : []);
      remoteV.srcObject = new MediaStream(remoteVideoTracks.length ? remoteVideoTracks : []);
      this.localVideo = localV;
      this.remoteVideo = remoteV;

      try {
        await Promise.all([localV.play().catch(() => {}), remoteV.play().catch(() => {})]);
      } catch {
        /* ignore */
      }

      const drawFrame = () => {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
        const rv = this.remoteVideo;
        const lv = this.localVideo;
        if (rv && rv.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            ctx.drawImage(rv, 0, 0, w, h);
          } catch {
            /* ignore */
          }
        }
        if (lv && lv.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const vw = lv.videoWidth || 1;
          const vh = lv.videoHeight || 1;
          const pipW = Math.round(w * 0.22);
          const pipH = Math.max(2, Math.round((pipW * vh) / vw));
          const px = w - pipW - 16;
          const py = h - pipH - 16;
          try {
            ctx.save();
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 2;
            ctx.translate(px + pipW, py);
            ctx.scale(-1, 1);
            ctx.drawImage(lv, 0, 0, pipW, pipH);
            ctx.restore();
            ctx.strokeRect(px, py, pipW, pipH);
          } catch {
            /* ignore */
          }
        }
      };

      const cap = canvas.captureStream(30);
      const vTrack = cap.getVideoTracks()[0];
      if (!vTrack) {
        await audioCtx.close().catch(() => {});
        this.audioContext = null;
        this.canvas = null;
        this.localVideo = null;
        this.remoteVideo = null;
        this.setState("error");
        return;
      }

      this.compositeRunning = true;
      const loop = () => {
        if (!this.compositeRunning) return;
        this.rafId = requestAnimationFrame(loop);
        drawFrame();
      };
      loop();

      mediaStream = new MediaStream([vTrack, ...audioOut]);
    }

    this.chunks = [];
    const mimeCandidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "audio/webm;codecs=opus",
      "audio/webm",
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

    try {
      this.recorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);
    } catch {
      this.stopCompositePipeline();
      await this.audioContext?.close().catch(() => {});
      this.audioContext = null;
      this.setState("error");
      return;
    }

    this.recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) this.chunks.push(ev.data);
    };
    this.recorder.onerror = () => this.setState("error");
    this.recorder.start(1000);
    this.startedAtMs = Date.now();
    this.accumulatedMs = 0;
    this.setState("recording");
  }

  async pause(): Promise<void> {
    if (!this.recorder || this.state !== "recording") return;
    if (typeof this.recorder.pause !== "function") return;
    this.recorder.pause();
    this.compositeRunning = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.startedAtMs != null) {
      this.accumulatedMs += Date.now() - this.startedAtMs;
      this.startedAtMs = null;
    }
    this.setState("paused");
  }

  async resume(): Promise<void> {
    if (!this.recorder || this.state !== "paused") return;
    if (typeof this.recorder.resume !== "function") return;
    this.compositeRunning = true;
    if (this.canvas && this.localVideo && this.remoteVideo) {
      const ctx = this.canvas.getContext("2d");
      if (ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const loop = () => {
          if (!this.compositeRunning) return;
          this.rafId = requestAnimationFrame(loop);
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, w, h);
          const rv = this.remoteVideo;
          const lv = this.localVideo;
          if (rv && rv.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              ctx.drawImage(rv, 0, 0, w, h);
            } catch {
              /* ignore */
            }
          }
          if (lv && lv.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const vw = lv.videoWidth || 1;
            const vh = lv.videoHeight || 1;
            const pipW = Math.round(w * 0.22);
            const pipH = Math.max(2, Math.round((pipW * vh) / vw));
            const px = w - pipW - 16;
            const py = h - pipH - 16;
            try {
              ctx.save();
              ctx.strokeStyle = "rgba(255,255,255,0.2)";
              ctx.lineWidth = 2;
              ctx.translate(px + pipW, py);
              ctx.scale(-1, 1);
              ctx.drawImage(lv, 0, 0, pipW, pipH);
              ctx.restore();
              ctx.strokeRect(px, py, pipW, pipH);
            } catch {
              /* ignore */
            }
          }
        };
        loop();
      }
    }
    this.recorder.resume();
    this.startedAtMs = Date.now();
    this.setState("recording");
  }

  async stop(filename = `call-recording-${Date.now()}.webm`): Promise<void> {
    if (!this.recorder || (this.state !== "recording" && this.state !== "paused")) return;
    this.setState("stopping");
    this.compositeRunning = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.startedAtMs != null) {
      this.accumulatedMs += Date.now() - this.startedAtMs;
      this.startedAtMs = null;
    }
    await new Promise<void>((resolve) => {
      if (!this.recorder) {
        resolve();
        return;
      }
      this.recorder.onstop = () => resolve();
      this.recorder.stop();
    });
    const blob = new Blob(this.chunks, { type: this.recorder?.mimeType?.split(";")[0] || "video/webm" });
    this.chunks = [];
    this.recorder = null;
    this.startedAtMs = null;
    this.accumulatedMs = 0;

    this.stopCompositePipeline();
    try {
      await this.audioContext?.close();
    } catch {
      /* ignore */
    }
    this.audioContext = null;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.setState("idle");
  }

  reset(): void {
    try {
      this.recorder?.stop();
    } catch {
      // no-op
    }
    this.chunks = [];
    this.recorder = null;
    this.startedAtMs = null;
    this.accumulatedMs = 0;
    this.compositeRunning = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.stopCompositePipeline();
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.setState("idle");
  }

  getElapsedMs(): number {
    if (this.state === "recording" && this.startedAtMs != null) {
      return this.accumulatedMs + (Date.now() - this.startedAtMs);
    }
    return this.accumulatedMs;
  }

  private stopCompositePipeline(): void {
    if (this.localVideo) {
      this.localVideo.pause();
      this.localVideo.srcObject = null;
      this.localVideo = null;
    }
    if (this.remoteVideo) {
      this.remoteVideo.pause();
      this.remoteVideo.srcObject = null;
      this.remoteVideo = null;
    }
    this.canvas = null;
  }

  private setState(next: RecordingState): void {
    if (next === this.state) return;
    this.state = next;
    this.onStateChange(next);
  }
}
