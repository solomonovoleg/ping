import { splitTranscriptToCaptionLines } from "./split-caption-lines";

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition ??
    null
  );
}

export class LiveCaptionsController {
  private recognition: InstanceType<SpeechRecognitionCtor> | null = null;
  private active = false;

  constructor(
    private onText: (text: string) => void,
    private onError: (message: string) => void,
  ) {}

  isSupported(): boolean {
    return Boolean(getSpeechCtor());
  }

  start(): void {
    const Ctor = getSpeechCtor();
    if (!Ctor || this.active) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "ru-RU";
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript?.trim();
      if (!transcript) return;
      for (const line of splitTranscriptToCaptionLines(transcript)) {
        if (line) this.onText(line);
      }
    };
    recognition.onerror = (event) => {
      this.onError(event.error ?? "speech_error");
    };
    recognition.onend = () => {
      if (this.active) {
        try {
          recognition.start();
        } catch {
          // no-op
        }
      }
    };
    recognition.start();
    this.recognition = recognition;
    this.active = true;
  }

  stop(): void {
    this.active = false;
    try {
      this.recognition?.stop();
    } catch {
      // no-op
    }
    this.recognition = null;
  }
}
