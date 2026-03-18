/**
 * Отправка пуш-уведомлений через FCM (Firebase Cloud Messaging).
 * Включение: задать FCM_SERVER_KEY в .env (Legacy Server Key из Firebase Console → Project Settings → Cloud Messaging).
 * Если ключ не задан — отправка не выполняется.
 */

import { storage } from "../storage";

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY?.trim();
const FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send";

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!FCM_SERVER_KEY) return false;
  const user = await storage.getUser(userId);
  if (!user || user.pushEnabled === false) return false;
  const token = user.fcmToken;
  if (!token || typeof token !== "string") return false;
  try {
    const res = await fetch(FCM_LEGACY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body, sound: "default" },
        data: data ?? {},
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
