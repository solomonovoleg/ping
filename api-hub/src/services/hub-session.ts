import { getPool } from "../infra/db/pool.js";
import * as repo from "../infra/db/repository.js";
import { store } from "../store/in-memory-store.js";
import type { HubSession } from "../types.js";
import type { Scope } from "../config.js";

export async function loadHubSession(sessionId: string): Promise<HubSession | undefined> {
  const cached = store.sessions.get(sessionId);
  if (cached) return cached;
  if (getPool()) {
    const row = await repo.getSessionRow(sessionId);
    if (row) {
      store.sessions.set(sessionId, row);
      return row;
    }
  }
  return undefined;
}

export async function persistNewSession(session: HubSession): Promise<void> {
  store.sessions.set(session.id, session);
  if (getPool()) {
    await repo.insertSession({
      id: session.id,
      partnerId: session.partnerId,
      pingUserId: session.pingUserId,
      scopes: session.scopes,
      encryptedRefreshToken: session.encryptedRefreshToken,
      encryptedAccessToken: session.encryptedPingAccessToken,
      accessExpiresAt: session.accessExpiresAt ? new Date(session.accessExpiresAt) : null,
    });
  }
}

export async function persistSessionTokens(session: HubSession): Promise<void> {
  store.sessions.set(session.id, session);
  if (getPool()) {
    await repo.updateSessionTokens({
      sessionId: session.id,
      encryptedRefreshToken: session.encryptedRefreshToken,
      encryptedAccessToken: session.encryptedPingAccessToken,
      accessExpiresAt: session.accessExpiresAt ? new Date(session.accessExpiresAt) : null,
    });
  }
}

export async function revokeHubSession(sessionId: string): Promise<void> {
  store.revokeSession(sessionId);
  if (getPool()) {
    await repo.revokeSessionDb(sessionId);
  }
}

export function createInMemorySession(input: {
  partnerId: string;
  pingUserId: string;
  scopes: Scope[];
  encryptedRefreshToken: string;
  encryptedPingAccessToken?: string;
  accessExpiresAt?: string;
}): HubSession {
  return store.createSession({
    partnerId: input.partnerId,
    pingUserId: input.pingUserId,
    scopes: input.scopes,
    encryptedRefreshToken: input.encryptedRefreshToken,
    encryptedPingAccessToken: input.encryptedPingAccessToken,
    accessExpiresAt: input.accessExpiresAt,
  });
}
