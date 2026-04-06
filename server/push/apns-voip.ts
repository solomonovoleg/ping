/**
 * Прямая отправка VoIP push в APNs (HTTP/2) для iOS CallKit.
 * Нужен ключ APNs (.p8), тот же класс что для FCM→APNs, но topic = {bundleId}.voip.
 *
 * Env: APNS_VOIP_KEY_PATH или APNS_VOIP_KEY_P8, APNS_VOIP_KEY_ID, APNS_TEAM_ID,
 * IOS_APP_BUNDLE_ID (по умолчанию ru.pingmoot.app), APNS_VOIP_USE_SANDBOX=1 для dev.
 */
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:http2";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { storage } from "../storage";

const APNS_KEY_PATH = process.env.APNS_VOIP_KEY_PATH?.trim();
const APNS_KEY_P8 = process.env.APNS_VOIP_KEY_P8?.trim();
const APNS_KEY_ID = process.env.APNS_VOIP_KEY_ID?.trim();
const APNS_TEAM_ID = process.env.APNS_TEAM_ID?.trim();
const IOS_BUNDLE_ID = process.env.IOS_APP_BUNDLE_ID?.trim() || "ru.pingmoot.app";
const APNS_VOIP_USE_SANDBOX =
  process.env.APNS_VOIP_USE_SANDBOX === "1" || process.env.APNS_VOIP_USE_SANDBOX === "true";

function loadP8(): string | null {
  if (APNS_KEY_P8) return APNS_KEY_P8.replace(/\\n/g, "\n");
  if (APNS_KEY_PATH && existsSync(APNS_KEY_PATH)) {
    return readFileSync(APNS_KEY_PATH, "utf8");
  }
  return null;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

let cachedJwt: { token: string; exp: number } | null = null;

function signApnsJwt(p8: string): string | null {
  if (!APNS_KEY_ID || !APNS_TEAM_ID) return null;
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.exp > now + 60) return cachedJwt.token;

  const header = base64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = base64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const input = `${header}.${payload}`;
  let key;
  try {
    key = createPrivateKey(p8);
  } catch {
    return null;
  }
  const sig = cryptoSign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  const jwt = `${input}.${base64url(sig)}`;
  cachedJwt = { token: jwt, exp: now + 3300 };
  return jwt;
}

export function isApnsVoipConfigured(): boolean {
  const p8 = loadP8();
  return !!(p8 && APNS_KEY_ID && APNS_TEAM_ID);
}

const APNS_HOST = APNS_VOIP_USE_SANDBOX ? "api.sandbox.push.apple.com" : "api.push.apple.com";

export async function sendVoipIncomingCallPush(
  deviceTokenHex: string,
  data: { callId: string; chatId: string; fromUserId: string; mediaType: string; fromDisplayName: string },
): Promise<boolean> {
  const p8 = loadP8();
  if (!p8) return false;
  const jwt = signApnsJwt(p8);
  if (!jwt) return false;

  const topic = `${IOS_BUNDLE_ID}.voip`;
  const tokenClean = deviceTokenHex.replace(/\s+/gu, "").trim().toLowerCase();
  if (!tokenClean) return false;

  const body = JSON.stringify({
    aps: { "content-available": 1 },
    callId: data.callId,
    chatId: data.chatId,
    fromUserId: data.fromUserId,
    mediaType: data.mediaType,
    fromDisplayName: String(data.fromDisplayName).slice(0, 200),
  });

  return await new Promise((resolve) => {
    const client = connect(`https://${APNS_HOST}`);
    const done = (ok: boolean) => {
      try {
        client.close();
      } catch {
        /* */
      }
      resolve(ok);
    };

    client.on("error", () => done(false));

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${tokenClean}`,
      "apns-topic": topic,
      "apns-push-type": "voip",
      "apns-priority": "10",
      "apns-expiration": "0",
      authorization: `bearer ${jwt}`,
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", () => {});
    req.on("end", () => done(status === 200));
    req.on("error", () => done(false));
    req.end(body);
  });
}

export async function sendVoipIncomingToUser(
  calleeUserId: string,
  callerDisplayName: string,
  meta: { callId: string; chatId: string; fromUserId: string; mediaType: string },
): Promise<void> {
  if (!isApnsVoipConfigured()) return;
  const user = await storage.getUser(calleeUserId);
  if (!user || user.pushEnabled === false) return;
  const voipToken = user.iosVoipToken;
  if (!voipToken || typeof voipToken !== "string") return;
  const ok = await sendVoipIncomingCallPush(voipToken, {
    ...meta,
    fromDisplayName: callerDisplayName,
  });
  if (!ok) {
    console.warn("[push] voip incoming: APNs не принял", { calleeUserId });
  }
}
