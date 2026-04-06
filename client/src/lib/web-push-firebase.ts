import {
  initializeApp,
  getApps,
  getApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";

function readWebPushFirebaseOptions(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket || `${projectId}.appspot.com`,
    messagingSenderId,
    appId,
  };
}

/** true, если заданы переменные для веб-FCM (кроме VAPID — его проверяем отдельно). */
export function isWebPushFirebaseConfigured(): boolean {
  return readWebPushFirebaseOptions() !== null;
}

function getOrInitWebPushApp(): FirebaseApp | null {
  const options = readWebPushFirebaseOptions();
  if (!options) return null;
  return getApps().length > 0 ? getApp() : initializeApp(options);
}

/**
 * Разрешение на уведомления + FCM token для браузера (HTTPS или localhost).
 * Тот же API, что натив: токен уходит на POST /api/users/me/push-token.
 */
export async function requestWebPushAndGetToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const options = readWebPushFirebaseOptions();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!options || !vapidKey) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    await registration.update();

    const app = getOrInitWebPushApp();
    if (!app) return null;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Пока вкладка открыта: показать тост (системный баннер может не прийти). */
export function subscribeWebPushForeground(
  onPayload: (payload: MessagePayload) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let unsub: (() => void) | undefined;
  let cancelled = false;
  void (async () => {
    const supported = await isSupported().catch(() => false);
    if (!supported || cancelled) return;
    try {
      const app = getOrInitWebPushApp();
      if (!app || cancelled) return;
      const messaging = getMessaging(app);
      unsub = onMessage(messaging, onPayload);
    } catch {
      /* не браузер / messaging недоступен */
    }
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
}
