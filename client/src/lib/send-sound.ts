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

/** Воспроизвести мягкий звук удаления сообщения (короткий понижающийся тон). */
export function playDeleteSound(): void {
  if (!getMicroSoundsEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    // Короткий "шорох": white noise + фильтр, чтобы не был резким.
    const duration = 0.09;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const highPass = ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.setValueAtTime(900, now);

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.setValueAtTime(3600, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  } catch {
    // игнор при ошибках автовоспроизведения
  }
}
