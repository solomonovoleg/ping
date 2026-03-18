/**
 * Микро-отклики: один вход для тактильной и звуковой обратной связи.
 * Всё на нано-уровне — мягко, коротко, не навязчиво.
 */

import { isNative } from "@/lib/capacitor-native";

const STORAGE_KEY_MICRO_SOUNDS = "ping:micro-sounds";

/** Включены ли микро-звуки интерфейса (тап, успех). По умолчанию — да. */
export function getMicroSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY_MICRO_SOUNDS);
  return v === null || v === "1" || v === "true";
}

export function setMicroSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_MICRO_SOUNDS, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent("ping:micro-sounds-change", { detail: enabled }));
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function playTone(ctx: AudioContext, freq: number, duration: number, gainVal: number): void {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration);
  } catch {
    // ignore
  }
}

/** Очень короткий мягкий «клик» (веб). На нативе не играем — там хаптик. */
export function playSoftTapSound(): void {
  if (isNative() || !getMicroSoundsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => playTone(ctx, 600, 0.028, 0.06)).catch(() => {});
    return;
  }
  playTone(ctx, 600, 0.028, 0.06);
}

/** Короткий «успех» — два мягких тона вверх (лайк, реакция, сохранение). */
function playSuccessSound(): void {
  if (isNative() || !getMicroSoundsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const play = () => {
    playTone(ctx!, 520, 0.032, 0.07);
    setTimeout(() => playTone(ctx!, 680, 0.04, 0.06), 45);
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(play).catch(() => {});
    return;
  }
  play();
}

/** Полный микро-отклик на тап: хаптик (нативно) + опционально тихий звук (веб). */
export function triggerTapFeedback(options: { haptic?: boolean; sound?: boolean } = {}): void {
  const { haptic = true, sound = false } = options;
  if (haptic) {
    import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
  }
  if (sound && !isNative()) playSoftTapSound();
}

/** Отклик «успех»: хаптик + мягкий двухнотный звук (лайк, реакция, сохранение). */
export function triggerSuccessFeedback(): void {
  import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
  playSuccessSound();
}
