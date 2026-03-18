/**
 * Доступ к нативным возможностям в мобильном приложении (Capacitor: Android и iOS).
 * В браузере функции безопасно возвращают fallback или false.
 */

export function isNative(): boolean {
  try {
    return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform === "function"
      && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor!.isNativePlatform!();
  } catch {
    return false;
  }
}

/** Получить фото с камеры (нативно или через input file в вебе). Возвращает dataUrl или null. */
export async function takePhotoFromCamera(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: (await import("@capacitor/camera")).CameraSource.Camera,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

/** Выбор фото из галереи (нативно). */
export async function pickPhotoFromGallery(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Camera, CameraResultType } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: (await import("@capacitor/camera")).CameraSource.Photos,
    });
    return photo.dataUrl ?? null;
  } catch {
    return null;
  }
}

/** Запросить разрешение на пуш-уведомления и вернуть FCM token (или null в вебе). */
export async function requestPushAndGetToken(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return null;
    await PushNotifications.register();
    return new Promise((resolve) => {
      PushNotifications.addListener(
        "registration",
        (ev: { value: string }) => resolve(ev.value)
      );
      PushNotifications.addListener("registrationError", () => resolve(null));
      setTimeout(() => resolve(null), 10000);
    });
  } catch {
    return null;
  }
}

/** Лёгкая вибрация при тапе/действии (нативно). В браузере — без эффекта. */
export function triggerLightHaptic(): void {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then((mod) => mod.Haptics.impact({ style: mod.ImpactStyle.Light }))
    .catch(() => {});
}

/** Самая мягкая вибрация — «выбор» (свайп экрана, отпускание pull-to-refresh). Ещё тоньше, чем Light. */
export function triggerSelectionHaptic(): void {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then((mod) => {
      if (typeof (mod.Haptics as { selectionChanged?: () => void }).selectionChanged === "function") {
        (mod.Haptics as { selectionChanged: () => void }).selectionChanged();
      } else {
        mod.Haptics.impact({ style: mod.ImpactStyle.Light });
      }
    })
    .catch(() => {});
}

/** Открыть набор номера / звонок (нативно — intent DIAL). */
export async function openDialer(phoneNumber: string): Promise<void> {
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits) return;
  const url = `tel:${encodeURIComponent(phoneNumber)}`;
  if (isNative()) {
    try {
      const core = await import("@capacitor/core");
      const App = (core as { App?: { openUrl: (opts: { url: string }) => Promise<void> } }).App;
      if (App) await App.openUrl({ url });
      else window.location.href = url;
    } catch {
      window.location.href = url;
    }
  } else {
    window.location.href = url;
  }
}
