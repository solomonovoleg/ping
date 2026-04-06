/**
 * Короткий «монетный» чип для EDGE MONEY (сессионный отчёт о баллах).
 * Web Audio API, без файлов. Учитывает «Микро-звуки».
 */
import { getMicroSoundsEnabled } from "@/lib/micro-feedback";

let ctxRef: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctxRef?.state === "closed") ctxRef = null;
  if (ctxRef) return ctxRef;
  try {
    const C =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctxRef = new C();
    return ctxRef;
  } catch {
    return null;
  }
}

/** Два коротких тона подряд — «монетка». */
export function playEdgeMoneyRecapChime(): void {
  if (!getMicroSoundsEnabled()) return;
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});

  const now = c.currentTime;
  const freqs = [988, 1318];
  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + i * 0.055);
    g.gain.exponentialRampToValueAtTime(0.07, now + i * 0.055 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.11);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now + i * 0.055);
    osc.stop(now + i * 0.055 + 0.12);
  });
}
