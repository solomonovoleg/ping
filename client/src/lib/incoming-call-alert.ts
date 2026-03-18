/**
 * Звук, вибрация и браузерное уведомление при входящем звонке (как в Telegram/WhatsApp).
 * startIncomingCallAlert() возвращает функцию stop — вызвать при принятии/отклонении/завершении.
 */

const RING_TONE_1 = 440;
const RING_TONE_2 = 554;
const RING_INTERVAL_MS = 600;
const VIBRATE_PATTERN = [200, 100, 200, 100, 200];
const VIBRATE_REPEAT_MS = 2500;

export function startIncomingCallAlert(callerName: string | null): () => void {
  const name = callerName?.trim() || "Абонент";
  let stopped = false;
  let audioContext: AudioContext | null = null;
  let ringInterval: ReturnType<typeof setInterval> | null = null;
  let vibrateInterval: ReturnType<typeof setInterval> | null = null;
  let notification: Notification | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) console.warn("AudioContext.close", e);
      }
      audioContext = null;
    }
    if (vibrateInterval) {
      clearInterval(vibrateInterval);
      vibrateInterval = null;
    }
    try {
      if (typeof navigator.vibrate === "function") navigator.vibrate(0);
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("vibrate(0)", e);
    }
    if (notification) {
      try {
        notification.close();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) console.warn("notification.close", e);
      }
      notification = null;
    }
  };

  // Звук: два тона по очереди (как гудок телефона)
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioContext = ctx;
    let phase = 0;
    const playTone = (freq: number, durationMs: number) => {
      if (stopped || !audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0.15, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + durationMs / 1000);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + durationMs / 1000);
    };
    ringInterval = setInterval(() => {
      if (stopped) return;
      phase = 1 - phase;
      playTone(phase ? RING_TONE_1 : RING_TONE_2, RING_INTERVAL_MS - 50);
    }, RING_INTERVAL_MS);
    playTone(RING_TONE_1, RING_INTERVAL_MS - 50);
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) console.warn("IncomingCall: звук недоступен (автовоспроизведение?)", e);
  }

  // Вибрация (мобильные)
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATE_PATTERN);
      vibrateInterval = setInterval(() => {
        if (!stopped) navigator.vibrate(VIBRATE_PATTERN);
      }, VIBRATE_REPEAT_MS);
    }
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) console.warn("IncomingCall: вибрация", e);
  }

  // Браузерное уведомление, если вкладка в фоне
  if (typeof document !== "undefined" && document.visibilityState === "hidden" && "Notification" in window && Notification.permission !== "denied") {
    if (Notification.permission === "granted") {
      try {
        notification = new Notification("Входящий звонок", {
          body: name,
          tag: "ping-incoming-call",
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          stop();
        };
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) console.warn("IncomingCall: Notification", e);
      }
    } else {
      Notification.requestPermission().then((p) => {
        if (p === "granted" && !stopped) {
          try {
            notification = new Notification("Входящий звонок", {
              body: name,
              tag: "ping-incoming-call",
              requireInteraction: true,
            });
            notification.onclick = () => {
              window.focus();
              stop();
            };
          } catch (e) {
            if (typeof console !== "undefined" && console.warn) console.warn("IncomingCall: Notification", e);
          }
        }
      });
    }
  }

  return stop;
}

/** Гудки для звонящего (как в телефоне): тон 1 сек, пауза 2 сек, повтор. Возвращает stop. */
export function startRingbackTone(): () => void {
  let stopped = false;
  let audioContext: AudioContext | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) console.warn("Ringback: AudioContext.close", e);
      }
      audioContext = null;
    }
  };

  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioContext = ctx;
    const playBeep = () => {
      if (stopped || !audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = 400;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      gain.gain.setValueAtTime(0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.95);
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 1);
    };
    playBeep();
    interval = setInterval(playBeep, 3000);
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) console.warn("Ringback: звук", e);
  }

  return stop;
}
