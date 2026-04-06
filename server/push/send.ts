/**
 * Отправка пушей через Firebase Cloud Messaging.
 *
 * Рекомендуется FCM HTTP v1 (service account): Google отключил legacy `fcm.googleapis.com/fcm/send` (~2024).
 * Варианты v1 (любой один):
 * - GOOGLE_APPLICATION_CREDENTIALS — путь к JSON ключу сервисного аккаунта (как в доке Firebase)
 * - FCM_SERVICE_ACCOUNT_JSON — тот же JSON одной строкой (удобно локально)
 * - FCM_SERVICE_ACCOUNT_B64 — base64 от JSON (если нужно обойти лимиты .env)
 *
 * Устаревший fallback: FCM_SERVER_KEY (Legacy Server Key) — может не работать.
 */

import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import type { JWTInput } from "google-auth-library";
import { storage } from "../storage";

const FCM_LEGACY_KEY = process.env.FCM_SERVER_KEY?.trim();
const GOOGLE_APP_CREDS = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
const FCM_SA_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
const FCM_SA_B64 = process.env.FCM_SERVICE_ACCOUNT_B64?.trim();
const FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send";

let serviceAccountResolved: { credentials: JWTInput; projectId: string } | null | undefined;
let googleAuth: GoogleAuth | null = null;

function resolveServiceAccount(): { credentials: JWTInput; projectId: string } | null {
  if (serviceAccountResolved !== undefined) return serviceAccountResolved;
  serviceAccountResolved = null;
  try {
    let raw: string | null = null;
    if (FCM_SA_B64) {
      raw = Buffer.from(FCM_SA_B64, "base64").toString("utf8");
    } else if (FCM_SA_JSON) {
      raw = FCM_SA_JSON;
    } else if (GOOGLE_APP_CREDS) {
      raw = readFileSync(GOOGLE_APP_CREDS, "utf8");
    }
    if (!raw) return serviceAccountResolved;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const projectId = typeof parsed.project_id === "string" ? parsed.project_id : "";
    if (!projectId || typeof parsed.private_key !== "string" || typeof parsed.client_email !== "string") {
      console.error("[push] FCM service account: нет project_id / private_key / client_email");
      return serviceAccountResolved;
    }
    serviceAccountResolved = { credentials: parsed as JWTInput, projectId };
    return serviceAccountResolved;
  } catch (e) {
    console.error("[push] FCM service account не прочитан:", e);
    return serviceAccountResolved;
  }
}

function getGoogleAuth(): GoogleAuth | null {
  const sa = resolveServiceAccount();
  if (!sa) return null;
  if (!googleAuth) {
    googleAuth = new GoogleAuth({
      credentials: sa.credentials,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
  }
  return googleAuth;
}

async function getFcmV1AccessToken(): Promise<string | null> {
  const auth = getGoogleAuth();
  if (!auth) return null;
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  return access?.token ?? null;
}

if (FCM_LEGACY_KEY && !resolveServiceAccount()) {
  console.warn(
    "[push] Задан только FCM_SERVER_KEY (legacy). Google отключил legacy FCM API — пуши могут не доходить. Добавь service account (GOOGLE_APPLICATION_CREDENTIALS или FCM_SERVICE_ACCOUNT_JSON) для HTTP v1.",
  );
}

export type PushSendOptions = {
  /** Android 8+: id канала (создаётся в MainActivity). */
  androidChannelId?: string;
  /** iOS: имя звука в бандле приложения; если файла нет — системный default. */
  iosSound?: string;
};

async function sendViaFcmV1(
  deviceToken: string,
  title: string,
  body: string,
  dataPayload: Record<string, string>,
  options?: PushSendOptions,
): Promise<boolean> {
  const sa = resolveServiceAccount();
  if (!sa) return false;
  const accessToken = await getFcmV1AccessToken();
  if (!accessToken) {
    console.error("[push] FCM v1: не получен access token");
    return false;
  }

  const sound = options?.iosSound?.trim() || "default";
  const message: Record<string, unknown> = {
    token: deviceToken,
    notification: { title, body },
    data: dataPayload,
    android: {
      priority: "HIGH",
      notification: options?.androidChannelId
        ? { channel_id: options.androidChannelId, sound: "default" }
        : { sound: "default" },
    },
    apns: {
      headers: {
        "apns-priority": "10",
        // iOS 13+: без alert часть уведомлений до APNs доходит некорректно
        "apns-push-type": "alert",
      },
      payload: {
        aps: {
          alert: { title, body },
          sound,
        },
      },
    },
  };

  const url = `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[push] FCM v1 HTTP", res.status, errText.slice(0, 800));
    }
    return res.ok;
  } catch (e) {
    console.error("[push] FCM v1 fetch:", e);
    return false;
  }
}

async function sendViaLegacy(
  deviceToken: string,
  title: string,
  body: string,
  dataPayload: Record<string, string>,
  options?: PushSendOptions,
): Promise<boolean> {
  if (!FCM_LEGACY_KEY) return false;

  const notification: Record<string, string> = {
    title,
    body,
    sound: options?.iosSound?.trim() || "default",
  };
  if (options?.androidChannelId) {
    notification.android_channel_id = options.androidChannelId;
  }

  try {
    const res = await fetch(FCM_LEGACY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${FCM_LEGACY_KEY}`,
      },
      body: JSON.stringify({
        to: deviceToken,
        priority: "high",
        notification,
        data: dataPayload,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[push] FCM legacy HTTP", res.status, errText.slice(0, 800));
    }
    return res.ok;
  } catch (e) {
    console.error("[push] FCM legacy fetch:", e);
    return false;
  }
}

export type SendPushResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no_user"
        | "push_disabled"
        | "no_token"
        | "no_fcm_config"
        | "fcm_send_failed";
    };

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: PushSendOptions,
): Promise<SendPushResult> {
  const user = await storage.getUser(userId);
  if (!user) return { ok: false, reason: "no_user" };
  if (user.pushEnabled === false) return { ok: false, reason: "push_disabled" };
  const token = user.fcmToken;
  if (!token || typeof token !== "string") return { ok: false, reason: "no_token" };

  const dataPayload: Record<string, string> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      dataPayload[k] = String(v);
    }
  }
  if (options?.androidChannelId) {
    dataPayload.ping_android_channel = options.androidChannelId;
  }

  const hasV1 = resolveServiceAccount() !== null;
  if (hasV1) {
    const sent = await sendViaFcmV1(token, title, body, dataPayload, options);
    return sent ? { ok: true } : { ok: false, reason: "fcm_send_failed" };
  }
  if (FCM_LEGACY_KEY) {
    const sent = await sendViaLegacy(token, title, body, dataPayload, options);
    return sent ? { ok: true } : { ok: false, reason: "fcm_send_failed" };
  }
  console.warn(
    "[push] Нет конфигурации FCM: задайте service account (GOOGLE_APPLICATION_CREDENTIALS / FCM_SERVICE_ACCOUNT_JSON) или FCM_SERVER_KEY (legacy).",
  );
  return { ok: false, reason: "no_fcm_config" };
}
