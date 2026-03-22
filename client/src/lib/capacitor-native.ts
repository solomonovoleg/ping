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

/** Проверить/запросить доступ к камере у Capacitor один раз, без повторных диалогов при каждом снимке. */
async function ensureNativeCameraPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { Camera } = await import("@capacitor/camera");
    const cur = await Camera.checkPermissions();
    if (cur.camera === "granted" || cur.camera === "limited") return true;
    const next = await Camera.requestPermissions({ permissions: ["camera"] });
    return next.camera === "granted" || next.camera === "limited";
  } catch {
    return false;
  }
}

/** Доступ к фото для выбора из галереи (iOS/Android). */
async function ensureNativePhotosPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const { Camera } = await import("@capacitor/camera");
    const cur = await Camera.checkPermissions();
    if (cur.photos === "granted" || cur.photos === "limited") return true;
    const next = await Camera.requestPermissions({ permissions: ["photos"] });
    return next.photos === "granted" || next.photos === "limited";
  } catch {
    return false;
  }
}

/** Получить фото с камеры (нативно или через input file в вебе). Возвращает dataUrl или null. */
export async function takePhotoFromCamera(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const ok = await ensureNativeCameraPermission();
    if (!ok) return null;
    const { Camera, CameraResultType } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
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
    const ok = await ensureNativePhotosPermission();
    if (!ok) return null;
    const { Camera, CameraResultType } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
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

/** Выраженный позитивный отклик (успех операции). */
export function triggerSuccessHaptic(): void {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then((mod) => {
      if (typeof (mod.Haptics as { notification?: (opts: { type: string }) => void }).notification === "function") {
        (mod.Haptics as { notification: (opts: { type: string }) => void }).notification({
          type: (mod as unknown as { NotificationType?: { Success?: string } }).NotificationType?.Success ?? "SUCCESS",
        });
      } else {
        mod.Haptics.impact({ style: mod.ImpactStyle.Light });
      }
    })
    .catch(() => {});
}

/** Выраженный негативный отклик (ошибка / отказ). */
export function triggerErrorHaptic(): void {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then((mod) => {
      if (typeof (mod.Haptics as { notification?: (opts: { type: string }) => void }).notification === "function") {
        (mod.Haptics as { notification: (opts: { type: string }) => void }).notification({
          type: (mod as unknown as { NotificationType?: { Error?: string } }).NotificationType?.Error ?? "ERROR",
        });
      } else {
        mod.Haptics.impact({ style: mod.ImpactStyle.Light });
      }
    })
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

/** Долгое нажатие → сервисное меню: нативный хаптик + короткий виброимпульс в поддерживаемых браузерах (Android Chrome). */
export function triggerContextMenuOpenFeedback(): void {
  triggerLightHaptic();
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(16);
  } catch {
    /* ignore */
  }
}

/**
 * Сохранить медиа в галерею (нативно: iOS/Android).
 * Принимает base64 data URL (data:image/jpeg;base64,... или data:video/mp4;base64,...).
 * Возвращает true при успехе, false при ошибке или в вебе.
 */
export async function saveMediaToGallery(dataUrl: string, type: "image" | "video"): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Media } = await import("@capacitor-community/media");
    if (type === "image") {
      await Media.savePhoto({ path: dataUrl });
    } else {
      await Media.saveVideo({ path: dataUrl });
    }
    return true;
  } catch {
    return false;
  }
}

/** Номера из телефонной книги устройства (Capacitor). Пустой массив при отказе в доступе или ошибке. */
export async function collectNativeContactPhoneStrings(): Promise<string[]> {
  if (!isNative()) return [];
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const status = await Contacts.requestPermissions();
    if (status.contacts !== "granted" && status.contacts !== "limited") return [];
    const { contacts } = await Contacts.getContacts({
      projection: { phones: true },
    });
    const out: string[] = [];
    for (const c of contacts ?? []) {
      for (const p of c.phones ?? []) {
        if (p.number) out.push(p.number);
      }
    }
    return out;
  } catch {
    return [];
  }
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
