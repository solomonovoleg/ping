/**
 * Короткий звук отправки сообщения (как в мессенджерах — мягкий «поп» при отправке).
 * Web Audio API, без внешних файлов. Учитывает настройку «Микро-звуки».
 */
import { getMicroSoundsEnabled } from "@/lib/micro-feedback";

let cachedContext: AudioContext | null = null;
let likeAudioEl: HTMLAudioElement | null = null;
let likeNotifyAudioEl: HTMLAudioElement | null = null;
let likeNotifyLastPlayedAt = 0;

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

function getUiAudio(url: string, kind: "like" | "notify"): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const existing = kind === "like" ? likeAudioEl : likeNotifyAudioEl;
  if (existing) return existing;
  try {
    const el = new Audio(url);
    el.preload = "auto";
    if (kind === "like") likeAudioEl = el;
    else likeNotifyAudioEl = el;
    return el;
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

/** Мягкий "bubble-pop" для фонтана сердечек в звонке. */
export function playHeartFountainSound(): void {
  if (!getMicroSoundsEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const base = ctx.currentTime;
    const pops = [0, 0.03, 0.065, 0.105];
    pops.forEach((delay, idx) => {
      const start = base + delay;
      const duration = 0.065 + idx * 0.008;

      const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * env * 0.65;
      }
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;

      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(1400 + idx * 320, start);
      band.Q.setValueAtTime(1.4, start);

      const ping = ctx.createOscillator();
      ping.type = "sine";
      ping.frequency.setValueAtTime(780 + idx * 90, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      src.connect(band);
      ping.connect(band);
      band.connect(gain);
      gain.connect(ctx.destination);
      src.start(start);
      src.stop(start + duration);
      ping.start(start);
      ping.stop(start + duration);
    });
  } catch {
    // ignore autoplay/runtime errors
  }
}

/** Пользовательский звук на действие "поставил лайк". */
export function playLikeActionSound(): void {
  if (!getMicroSoundsEnabled()) return;
  const el = getUiAudio("/sounds/like-notification.mp3", "like");
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch {
    // ignore autoplay/runtime errors
  }
}

/** Звук на входящее уведомление о лайке (с анти-спам задержкой). */
export function playLikeNotificationSound(): void {
  if (!getMicroSoundsEnabled()) return;
  const now = Date.now();
  if (now - likeNotifyLastPlayedAt < 900) return;
  const el = getUiAudio("/sounds/like-notification.mp3", "notify");
  if (!el) return;
  likeNotifyLastPlayedAt = now;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch {
    // ignore autoplay/runtime errors
  }
}
