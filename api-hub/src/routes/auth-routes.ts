import { Router } from "express";
import { z } from "zod";
import { config, DEFAULT_SCOPES, oidcScopeString, type Scope } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import { createId } from "../lib/ids.js";
import { decryptString, encryptString } from "../security/encryption.js";
import { signSessionToken } from "../security/token.js";
import { exchangeCode, exchangeRefreshToken, issueAuthCode } from "../providers/mock-ping-provider.js";
import { store } from "../store/in-memory-store.js";
import { partnerAuth } from "../middleware/partner-auth.js";
import { requireSession } from "../middleware/session-auth.js";
import { generatePkcePair } from "../providers/oauth-pkce.js";
import { saveOauthTransient, takeOauthTransient } from "../providers/oauth-transient-store.js";
import {
  buildPingAuthorizationUrl,
  exchangeAuthorizationCode,
  exchangePingRefreshToken,
  decodeIdTokenSub,
  parseScopeList,
} from "../providers/oidc-client.js";
import * as repo from "../infra/db/repository.js";
import {
  createInMemorySession,
  persistNewSession,
  persistSessionTokens,
  revokeHubSession,
  loadHubSession,
} from "../services/hub-session.js";
import {
  fetchPlatformPmBearer,
  isPlatformPmExchangeConfigured,
  isPlatformUserUuid,
  PlatformPmIssueError,
} from "../platform/issue-platform-bearer.js";
import { deliverPartnerLoginCallback } from "../auth/partner-login-callback.js";

async function encryptedPingAccessForOidcSession(pingUserId: string, oidcAccessToken: string): Promise<string> {
  if (!isPlatformPmExchangeConfigured()) {
    return encryptString(oidcAccessToken, config.encryptionKey);
  }
  if (!isPlatformUserUuid(pingUserId)) {
    throw new HttpError(
      400,
      "invalid_oidc_sub",
      "При заданных API_HUB_SERVICE_SECRET и API_HUB_PING_PLATFORM_URL в id_token.sub ожидается UUID пользователя платформы",
    );
  }
  try {
    const pm = await fetchPlatformPmBearer(pingUserId);
    return encryptString(pm, config.encryptionKey);
  } catch (e) {
    if (e instanceof PlatformPmIssueError) {
      const st = e.statusCode === 403 || e.statusCode === 404 ? 403 : 502;
      throw new HttpError(st, "platform_bearer_denied", e.message);
    }
    throw e;
  }
}

const startSchema = z.object({
  externalUserId: z.string().min(1).optional(),
  loginCallbackUrl: z.string().url().optional(),
  redirectUrl: z.string().url().optional(),
  pingUserId: z.string().min(1).default("ping_u_alex"),
  scopes: z.array(z.enum(["profile.read", "chat.read", "chat.write", "presence.write"])).optional(),
});

const callbackMockSchema = z.object({
  code: z.string().min(1),
});

const callbackOidcSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const consentSchema = z.object({
  scopes: z.array(z.enum(["profile.read", "chat.read", "chat.write", "presence.write"])),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

async function audit(event: string, details: Record<string, unknown>): Promise<void> {
  store.addAudit(event, details);
  await repo.insertAudit(event, details);
}

function resolvePartnerApiKey(req: { headers: Record<string, unknown> }): string {
  const apiKey = req.headers["x-partner-api-key"]?.toString().trim() ?? "";
  if (!apiKey) throw new HttpError(401, "missing_partner_api_key", "Missing x-partner-api-key header");
  return apiKey;
}

function makePostLoginRedirect(redirectUrl: string): string {
  const out = new URL(redirectUrl);
  out.searchParams.set("pingSso", "ok");
  return out.toString();
}

function makePostLoginErrorRedirect(redirectUrl: string, code: string): string {
  const out = new URL(redirectUrl);
  out.searchParams.set("pingSso", "error");
  out.searchParams.set("code", code);
  return out.toString();
}

export const authRoutes = Router();

authRoutes.get("/ping/start", partnerAuth, (req, res, next) => {
  void (async () => {
    const queryResult = startSchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new HttpError(400, "invalid_query", "Invalid auth start query", queryResult.error.flatten());
    }
    const payload = queryResult.data;
    const scopes = payload.scopes ?? DEFAULT_SCOPES;

    if (config.authMode === "oidc") {
      if (!config.pingOidcIssuer.trim()) {
        throw new HttpError(500, "oidc_not_configured", "API_HUB_PING_OIDC_ISSUER is required for OIDC mode");
      }
      const { verifier, challenge } = generatePkcePair();
      const state = createId("state");
      await saveOauthTransient(state, {
        verifier,
        partnerId: req.partnerId!,
        externalUserId: payload.externalUserId,
        loginCallbackUrl: payload.loginCallbackUrl,
        redirectUrl: payload.redirectUrl,
        scopes,
      });
      const authUrl = await buildPingAuthorizationUrl({
        issuer: config.pingOidcIssuer,
        clientId: config.pingOidcClientId,
        redirectUri: config.oauthRedirectUri,
        scope: oidcScopeString(scopes),
        state,
        codeChallenge: challenge,
      });
      await audit("oauth.start", {
        partnerId: req.partnerId,
        mode: "oidc",
        state,
        scopes,
      });
      res.json({
        ok: true,
        mode: "oidc",
        authUrl,
        state,
      });
      return;
    }

    const consentId = createId("consent");
    await audit("oauth.start", {
      partnerId: req.partnerId,
      pingUserId: payload.pingUserId,
      scopes,
      consentId,
      mode: "mock",
    });
    const code = issueAuthCode({
      pingUserId: payload.pingUserId,
      externalUserId: payload.externalUserId,
      loginCallbackUrl: payload.loginCallbackUrl,
      redirectUrl: payload.redirectUrl,
      scopes,
    });

    res.json({
      ok: true,
      mode: "mock",
      consentId,
      authUrl: `${config.oauthRedirectUri}?code=${code}`,
      code,
    });
  })().catch(next);
});

authRoutes.post("/ping/consent", partnerAuth, (req, res) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, "invalid_body", "Invalid consent payload", parsed.error.flatten());
  }
  const grantedScopes = parsed.data.scopes;
  res.json({
    ok: true,
    grantedScopes,
  });
});

authRoutes.get("/ping/callback", partnerAuth, (req, res, next) => {
  void (async () => {
    if (config.authMode === "oidc") {
      const query = callbackOidcSchema.safeParse(req.query);
      if (!query.success) {
        throw new HttpError(400, "invalid_callback_query", "OIDC callback requires code and state", query.error.flatten());
      }
      const transient = await takeOauthTransient(query.data.state);
      if (!transient || transient.partnerId !== req.partnerId) {
        throw new HttpError(400, "invalid_oauth_state", "Unknown or expired OAuth state");
      }
      try {
        const tokens = await exchangeAuthorizationCode({
          issuer: config.pingOidcIssuer,
          clientId: config.pingOidcClientId,
          clientSecret: config.pingOidcClientSecret,
          redirectUri: config.oauthRedirectUri,
          code: query.data.code,
          codeVerifier: transient.verifier,
        });
        if (!tokens.refresh_token) {
          throw new HttpError(400, "no_refresh_token", "PING did not return refresh_token; enable offline_access");
        }
        if (!tokens.id_token) {
          throw new HttpError(400, "no_id_token", "PING did not return id_token");
        }
        const pingUserId = decodeIdTokenSub(tokens.id_token);
        const scopes = parseScopeList(tokens.scope, transient.scopes) as Scope[];
        const accessExpiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : undefined;
        const encryptedPingAccessToken = await encryptedPingAccessForOidcSession(pingUserId, tokens.access_token);
        const session = createInMemorySession({
          partnerId: req.partnerId!,
          pingUserId,
          scopes,
          encryptedRefreshToken: encryptString(tokens.refresh_token, config.encryptionKey),
          encryptedPingAccessToken,
          accessExpiresAt,
        });
        await persistNewSession(session);
        if (transient.externalUserId) {
          store.addOrUpdateLink({
            partnerId: req.partnerId!,
            externalUserId: transient.externalUserId,
            pingUserId,
          });
          await repo.upsertUserLink({
            partnerId: req.partnerId!,
            externalUserId: transient.externalUserId,
            pingUserId,
          });
        }
        await audit("oauth.callback", {
          partnerId: req.partnerId,
          pingUserId,
          sessionId: session.id,
          mode: "oidc",
        });
        const accessToken = signSessionToken(
          {
            sessionId: session.id,
            partnerId: req.partnerId!,
            pingUserId,
            scopes,
          },
          config.jwtSecret,
          3600,
        );
        if (transient.loginCallbackUrl) {
          await deliverPartnerLoginCallback({
            url: transient.loginCallbackUrl,
            senderId: pingUserId,
            apiKey: resolvePartnerApiKey(req),
          });
        }
        if (transient.redirectUrl) {
          res.redirect(302, makePostLoginRedirect(transient.redirectUrl));
          return;
        }
        res.json({
          ok: true,
          accessToken,
          refreshToken: tokens.refresh_token,
          expiresIn: 3600,
          tokenType: "Bearer",
          scope: scopes.join(" "),
          user: store.getProfile(pingUserId),
        });
        return;
      } catch (error) {
        if (transient.redirectUrl && error instanceof HttpError) {
          res.redirect(302, makePostLoginErrorRedirect(transient.redirectUrl, error.code));
          return;
        }
        throw error;
      }
    }

    const query = callbackMockSchema.safeParse(req.query);
    if (!query.success) {
      throw new HttpError(400, "invalid_callback_query", "Invalid callback query", query.error.flatten());
    }
    const oauthTokens = exchangeCode(query.data.code);
    const session = createInMemorySession({
      partnerId: req.partnerId!,
      pingUserId: oauthTokens.pingUserId,
      scopes: oauthTokens.scopes,
      encryptedRefreshToken: encryptString(oauthTokens.refreshToken, config.encryptionKey),
    });
    await persistNewSession(session);
    if (oauthTokens.externalUserId) {
      store.addOrUpdateLink({
        partnerId: req.partnerId!,
        externalUserId: oauthTokens.externalUserId,
        pingUserId: oauthTokens.pingUserId,
      });
      await repo.upsertUserLink({
        partnerId: req.partnerId!,
        externalUserId: oauthTokens.externalUserId,
        pingUserId: oauthTokens.pingUserId,
      });
    }
    const accessToken = signSessionToken(
      {
        sessionId: session.id,
        partnerId: req.partnerId!,
        pingUserId: oauthTokens.pingUserId,
        scopes: oauthTokens.scopes as Scope[],
      },
      config.jwtSecret,
      3600,
    );

    await audit("oauth.callback", {
      partnerId: req.partnerId,
      pingUserId: oauthTokens.pingUserId,
      sessionId: session.id,
      mode: "mock",
    });
    try {
      if (oauthTokens.loginCallbackUrl) {
        await deliverPartnerLoginCallback({
          url: oauthTokens.loginCallbackUrl,
          senderId: oauthTokens.pingUserId,
          apiKey: resolvePartnerApiKey(req),
        });
      }
      if (oauthTokens.redirectUrl) {
        res.redirect(302, makePostLoginRedirect(oauthTokens.redirectUrl));
        return;
      }
    } catch (error) {
      if (oauthTokens.redirectUrl && error instanceof HttpError) {
        res.redirect(302, makePostLoginErrorRedirect(oauthTokens.redirectUrl, error.code));
        return;
      }
      throw error;
    }

    res.json({
      ok: true,
      accessToken,
      refreshToken: oauthTokens.refreshToken,
      expiresIn: 3600,
      tokenType: "Bearer",
      scope: oauthTokens.scopes.join(" "),
      user: store.getProfile(oauthTokens.pingUserId),
    });
  })().catch(next);
});

authRoutes.post("/refresh", partnerAuth, requireSession(), (req, res, next) => {
  void (async () => {
    const parsed = refreshSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, "invalid_body", "Invalid refresh payload", parsed.error.flatten());
    }
    const payload = req.sessionAuth!;
    const session = await loadHubSession(payload.sessionId);
    if (!session || session.revokedAt) {
      throw new HttpError(401, "session_revoked", "Session is revoked");
    }
    const decryptedRefreshToken = parsed.data.refreshToken
      ? parsed.data.refreshToken
      : decryptString(session.encryptedRefreshToken, config.encryptionKey);

    let refreshTokenOut: string;

    if (config.authMode === "oidc") {
      if (!config.pingOidcIssuer.trim()) {
        throw new HttpError(500, "oidc_not_configured", "OIDC issuer not configured");
      }
      const oauthTokens = await exchangePingRefreshToken({
        issuer: config.pingOidcIssuer,
        clientId: config.pingOidcClientId,
        clientSecret: config.pingOidcClientSecret,
        refreshToken: decryptedRefreshToken,
      });
      refreshTokenOut = oauthTokens.refresh_token ?? decryptedRefreshToken;
      session.encryptedRefreshToken = encryptString(refreshTokenOut, config.encryptionKey);
      session.encryptedPingAccessToken = await encryptedPingAccessForOidcSession(
        session.pingUserId,
        oauthTokens.access_token,
      );
      session.accessExpiresAt = oauthTokens.expires_in
        ? new Date(Date.now() + oauthTokens.expires_in * 1000).toISOString()
        : undefined;
      await persistSessionTokens(session);
    } else {
      const oauthTokens = exchangeRefreshToken(decryptedRefreshToken);
      refreshTokenOut = oauthTokens.refreshToken;
      session.encryptedRefreshToken = encryptString(oauthTokens.refreshToken, config.encryptionKey);
      await persistSessionTokens(session);
    }

    await audit("oauth.refresh", {
      partnerId: session.partnerId,
      pingUserId: session.pingUserId,
      sessionId: session.id,
    });
    const accessToken = signSessionToken(
      {
        sessionId: session.id,
        partnerId: session.partnerId,
        pingUserId: session.pingUserId,
        scopes: session.scopes,
      },
      config.jwtSecret,
      3600,
    );
    res.json({
      ok: true,
      accessToken,
      refreshToken: refreshTokenOut,
      expiresIn: 3600,
      tokenType: "Bearer",
    });
  })().catch(next);
});

authRoutes.post("/logout", partnerAuth, requireSession(), (req, res, next) => {
  void (async () => {
    await revokeHubSession(req.sessionAuth!.sessionId);
    await audit("oauth.logout", {
      partnerId: req.sessionAuth!.partnerId,
      pingUserId: req.sessionAuth!.pingUserId,
      sessionId: req.sessionAuth!.sessionId,
    });
    res.json({ ok: true });
  })().catch(next);
});
