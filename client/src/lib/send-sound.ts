/**
 * Короткий звук отправки сообщения (как в мессенджерах — мягкий «поп» при отправке).
 * Web Audio API, без внешних файлов. Учитывает настройку «Микро-звуки».
 */
import { getMicroSoundsEnabled } from "@/lib/micro-feedback";

let cachedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedContext?.state === "closed") cachedContext = null;
  if (cachedContext) return cachedContext;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    cachedContext = new Ctx();
    return cachedContext;
  } catch {
    return null;
  }
}

/** Воспроизвести звук отправки сообщения (один короткий мягкий тон). */
export function playSendSound(): void {
  if (!getMicroSoundsEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // игнор при ошибках автовоспроизведения
  }
}
