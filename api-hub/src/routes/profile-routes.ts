import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { HttpError } from "../lib/http-error.js";
import { decryptString } from "../security/encryption.js";
import { store } from "../store/in-memory-store.js";
import { fetchPingAuthMe } from "../platform/ping-platform-client.js";
import { getPingPlatformPmBearer } from "../platform/ping-platform-session.js";
import {
  PlatformProxyError,
  proxyPlatformAddContact,
  proxyPlatformListContacts,
} from "../platform/ping-chats-client.js";
import { loadHubSession } from "../services/hub-session.js";

export const profileRoutes = Router();

function mapPlatformContactsPayload(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    if (c && typeof c === "object" && "id" in c && typeof (c as { id: unknown }).id === "string") {
      const o = c as Record<string, unknown>;
      return { ...o, pingUserId: o.id };
    }
    return c;
  });
}

const addContactBodySchema = z.object({
  contactUserId: z.string().min(1).max(64),
});

function mapPlatformErr(e: unknown): never {
  if (e instanceof PlatformProxyError) {
    const st =
      e.status === 401 || e.status === 403 || e.status === 404
        ? e.status
        : e.status >= 500
          ? 502
          : 400;
    throw new HttpError(st, "platform_proxy_error", e.message, e.payload);
  }
  throw e;
}

profileRoutes.get(
  "/me",
  partnerAuth,
  requireSession(["profile.read"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const session = await loadHubSession(req.sessionAuth!.sessionId);
      const pingAccess =
        session?.encryptedPingAccessToken && config.platformBaseUrl.trim()
          ? decryptString(session.encryptedPingAccessToken, config.encryptionKey)
          : null;
      if (pingAccess?.startsWith("pm.")) {
        const remote = await fetchPingAuthMe(pingAccess);
        if (remote && Object.keys(remote).length > 0) {
          res.json({ ok: true, profile: remote, source: "ping_platform" });
          return;
        }
      }

      const profile = store.getProfile(req.sessionAuth!.pingUserId);
      if (!profile) throw new HttpError(404, "profile_not_found", "Profile not found");
      const allowed = new Set(req.sessionAuth!.scopes);
      const response: Record<string, unknown> = {
        pingUserId: profile.pingUserId,
        name: profile.name,
      };
      if (allowed.has("profile.read")) {
        response.phone = profile.phone;
        response.age = profile.age;
        response.birthday = profile.birthday;
      }
      res.json({ ok: true, profile: response, source: "api_hub_cache" });
    })().catch(next);
  },
);

profileRoutes.get("/contacts", partnerAuth, requireSession(["chat.read"]), userRateLimit, (req, res, next) => {
  void (async () => {
    const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
    if (pm) {
      try {
        const raw = await proxyPlatformListContacts(pm);
        const contacts = mapPlatformContactsPayload(raw);
        res.json({ ok: true, contacts, source: "ping_platform" });
      } catch (e) {
        mapPlatformErr(e);
      }
      return;
    }
    const contacts = store.listContacts(req.sessionAuth!.pingUserId);
    const mapped = contacts.map((contact) => {
      const state = store.getPresence(contact.pingUserId);
      return {
        ...contact,
        presence: state,
      };
    });
    res.json({ ok: true, contacts: mapped, source: "api_hub_demo" });
  })().catch(next);
});

profileRoutes.post(
  "/contacts",
  partnerAuth,
  requireSession(["chat.write"]),
  userRateLimit,
  (req, res, next) => {
    void (async () => {
      const parsed = addContactBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "invalid_body", "Укажите contactUserId (id пользователя платформы)", parsed.error.flatten());
      }
      const pm = await getPingPlatformPmBearer(req.sessionAuth!.sessionId);
      if (!pm) {
        throw new HttpError(
          501,
          "contacts_add_requires_platform",
          "Добавление контактов доступно только при сессии с платформой (Bearer pm.*)",
        );
      }
      try {
        const platformBody = await proxyPlatformAddContact(pm, parsed.data.contactUserId.trim());
        const extra =
          platformBody && typeof platformBody === "object" && platformBody !== null
            ? (platformBody as Record<string, unknown>)
            : {};
        res.json({ ok: true, source: "ping_platform", ...extra });
      } catch (e) {
        mapPlatformErr(e);
      }
    })().catch(next);
  },
);
