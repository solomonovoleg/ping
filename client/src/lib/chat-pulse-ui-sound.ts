/**
 * Лёгкие сигналы для PULSE-подобного композера (Web Audio). Без звука при ошибке контекста или reduce motion.
 */
export function playPulseUiTone(
  kind: "stt_start" | "stt_done" | "soft_tick",
  allowSound: boolean,
): void {
  if (!allowSound || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    if (kind === "stt_start") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.08);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.06, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    } else if (kind === "stt_done") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(720, t0);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + 0.1);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.055, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(380, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.04, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* noop */
      }
    }, 400);
  } catch {
    /* silent */
  }
}
