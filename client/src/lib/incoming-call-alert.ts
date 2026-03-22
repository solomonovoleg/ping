/**
 * Воспроизведение кастомного рингтона для входящего/исходящего вызова.
 * URL с учётом Vite BASE_URL; при блокировке autoplay — повтор при первом tap/click.
 */

const BASE =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL != null
    ? String(import.meta.env.BASE_URL).replace(/\/$/, "")
    : "";
const CALL_RINGTONE_URL = `${BASE}/sounds/call-ringtone.mp3`;

const VIBRATE_PATTERN = [200, 100, 200, 100, 200];
const VIBRATE_REPEAT_MS = 2500;

function startLoopingCallTone(volume = 1): () => void {
  let audio: HTMLAudioElement | null = null;
  let stopped = false;

  const tryPlay = () => {
    if (!audio || stopped) return;
    void audio.play().catch((e) => {
      if (typeof console !== "undefined" && console.warn) console.warn("Call tone: autoplay blocked, ждём жест…", e);
    });
  };

  const onUnlock = () => {
    tryPlay();
    document.removeEventListener("pointerdown", onUnlock);
    document.removeEventListener("click", onUnlock);
    document.removeEventListener("touchend", onUnlock);
  };

  try {
    audio = new Audio(CALL_RINGTONE_URL);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    tryPlay();

    document.addEventListener("pointerdown", onUnlock, { passive: true });
    document.addEventListener("click", onUnlock);
    document.addEventListener("touchend", onUnlock, { passive: true });
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) console.warn("Call tone init error", e);
  }

  return () => {
    if (stopped) return;
    stopped = true;
    document.removeEventListener("pointerdown", onUnlock);
    document.removeEventListener("click", onUnlock);
    document.removeEventListener("touchend", onUnlock);
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) console.warn("Call tone stop error", err);
    }
    audio = null;
  };
}

export type RingingIncomingAlertOptions = {
  notificationTitle: string;
  notificationBody: string;
  notificationTag: string;
  /** После focus + stop (например перейти в чат). */
  onNotificationClick?: () => void;
};

/**
 * Рингтон + вибро + системное уведомление (если вкладка в фоне). Общая основа для личного и группового звонка.
 */
export function startRingingIncomingAlert(options: RingingIncomingAlertOptions): () => void {
  const { notificationTitle, notificationBody, notificationTag, onNotificationClick } = options;
  let stopped = false;
  let vibrateInterval: ReturnType<typeof setInterval> | null = null;
  let notification: Notification | null = null;
  const stopTone = startLoopingCallTone(1);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    stopTone();
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

  const attachNotification = () => {
    if (typeof document === "undefined" || document.visibilityState !== "hidden") return;
    if (!("Notification" in window) || Notification.permission === "denied") return;
    const show = () => {
      if (stopped) return;
      try {
        notification = new Notification(notificationTitle, {
          body: notificationBody,
          tag: notificationTag,
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          stop();
          onNotificationClick?.();
        };
      } catch (e) {
        if (typeof console !== "undefined" && console.warn) console.warn("RingingAlert: Notification", e);
      }
    };
    if (Notification.permission === "granted") {
      show();
    } else {
      Notification.requestPermission().then((p) => {
        if (p === "granted") show();
      });
    }
  };

  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATE_PATTERN);
      vibrateInterval = setInterval(() => {
        if (!stopped) navigator.vibrate(VIBRATE_PATTERN);
      }, VIBRATE_REPEAT_MS);
    }
  } catch (e) {
    if (typeof console !== "undefined" && console.warn) console.warn("RingingAlert: vibration", e);
  }

  attachNotification();

  return stop;
}

export function startIncomingCallAlert(callerName: string | null): () => void {
  const name = callerName?.trim() || "Абонент";
  return startRingingIncomingAlert({
    notificationTitle: "Входящий звонок",
    notificationBody: name,
    notificationTag: "ping-incoming-call",
  });
}

/** Входящий групповой аудио/видео созвон — тот же рингтон, что у личного звонка. */
export function startGroupCallInviteAlert(params: {
  chatLabel: string;
  mediaType: "audio" | "video";
  onNotificationClick?: () => void;
}): () => void {
  const label = params.chatLabel?.trim() || "Групповой чат";
  const kind = params.mediaType === "video" ? "Видеозвонок в группе" : "Звонок в группе";
  return startRingingIncomingAlert({
    notificationTitle: kind,
    notificationBody: label,
    notificationTag: "ping-group-call-invite",
    onNotificationClick: params.onNotificationClick,
  });
}

/** Рингтон для звонящего (исходящий вызов). */
export function startRingbackTone(): () => void {
  return startLoopingCallTone(0.9);
}

let lastNewMessageBrowserNotifAt = 0;

/** Короткое системное уведомление, если вкладка в фоне (звук идёт отдельно через playIncomingChatMessageSound). */
export function showNewChatMessageBrowserNotificationIfHidden(): void {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return;
  if (!("Notification" in window) || Notification.permission === "denied") return;
  const now = Date.now();
  if (now - lastNewMessageBrowserNotifAt < 2800) return;
  lastNewMessageBrowserNotifAt = now;
  const title = "Новое сообщение";
  const body = "Откройте приложение, чтобы прочитать.";
  const show = () => {
    try {
      new Notification(title, { body, tag: "ping-new-chat-message" });
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) console.warn("NewMessage: Notification", e);
    }
  };
  if (Notification.permission === "granted") {
    show();
  } else {
    void Notification.requestPermission().then((p) => {
      if (p === "granted") show();
    });
  }
}
