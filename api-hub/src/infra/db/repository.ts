import type { Scope } from "../../config.js";
import type { HubSession, PartnerApp, RealtimeEnvelope } from "../../types.js";
import { getPool } from "./pool.js";

function mapPartner(row: {
  id: string;
  name: string;
  api_key: string;
  webhook_url: string | null;
  webhook_secret: string | null;
  rate_limit_per_minute: number;
}): PartnerApp {
  return {
    id: row.id,
    name: row.name,
    apiKey: row.api_key,
    webhookUrl: row.webhook_url ?? undefined,
    webhookSecret: row.webhook_secret ?? undefined,
    rateLimitPerMinute: row.rate_limit_per_minute,
  };
}

export async function findPartnerByApiKey(apiKey: string): Promise<PartnerApp | null> {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `
    select * from (
      select p.id, p.name, p.api_key, p.webhook_url, p.webhook_secret, p.rate_limit_per_minute
      from api_hub_partners p
      where p.api_key = $1
      union all
      select p.id, p.name, p.api_key, p.webhook_url, p.webhook_secret, p.rate_limit_per_minute
      from api_hub_partner_api_keys k
      join api_hub_partners p on p.id = k.partner_id
      where k.api_key = $1 and k.revoked_at is null
    ) t
    limit 1
    `,
    [apiKey],
  );
  if (!result.rowCount) return null;
  return mapPartner(result.rows[0] as Parameters<typeof mapPartner>[0]);
}

export async function findPartnerById(partnerId: string): Promise<PartnerApp | null> {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `select id, name, api_key, webhook_url, webhook_secret, rate_limit_per_minute
     from api_hub_partners where id = $1`,
    [partnerId],
  );
  if (!result.rowCount) return null;
  return mapPartner(result.rows[0] as Parameters<typeof mapPartner>[0]);
}

export async function insertSession(input: {
  id: string;
  partnerId: string;
  pingUserId: string;
  scopes: Scope[];
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  accessExpiresAt?: Date | null;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `insert into api_hub_sessions (
      id, partner_id, ping_user_id, scopes, encrypted_refresh_token,
      encrypted_access_token, access_expires_at
    ) values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      input.id,
      input.partnerId,
      input.pingUserId,
      input.scopes,
      input.encryptedRefreshToken,
      input.encryptedAccessToken ?? null,
      input.accessExpiresAt ?? null,
    ],
  );
}

export async function updateSessionTokens(input: {
  sessionId: string;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  accessExpiresAt?: Date | null;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  if (input.encryptedAccessToken !== undefined) {
    await pool.query(
      `update api_hub_sessions set
        encrypted_refresh_token = $2,
        encrypted_access_token = $3,
        access_expires_at = $4
       where id = $1 and revoked_at is null`,
      [
        input.sessionId,
        input.encryptedRefreshToken,
        input.encryptedAccessToken,
        input.accessExpiresAt ?? null,
      ],
    );
    return;
  }
  await pool.query(
    `update api_hub_sessions set encrypted_refresh_token = $2 where id = $1 and revoked_at is null`,
    [input.sessionId, input.encryptedRefreshToken],
  );
}

export async function revokeSessionDb(sessionId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`update api_hub_sessions set revoked_at = now() where id = $1`, [sessionId]);
}

/** Активные сессии с scope `chat.read` для пользователей из чата (platform → hub realtime bridge). */
export async function listActiveSessionsForBridgeTargets(
  pingUserIds: string[],
): Promise<Array<{ partnerId: string; pingUserId: string }>> {
  const pool = getPool();
  if (!pool || pingUserIds.length === 0) return [];
  const result = await pool.query<{ partner_id: string; ping_user_id: string }>(
    `select distinct partner_id, ping_user_id
     from api_hub_sessions
     where revoked_at is null
       and ping_user_id = any($1::text[])
       and scopes @> array['chat.read']::text[]`,
    [pingUserIds],
  );
  return result.rows.map((r) => ({
    partnerId: r.partner_id,
    pingUserId: r.ping_user_id,
  }));
}

export async function getSessionRow(sessionId: string): Promise<HubSession | null> {
  const pool = getPool();
  if (!pool) return null;
  const result = await pool.query(
    `select id, partner_id, ping_user_id, scopes, encrypted_refresh_token,
            encrypted_access_token, access_expires_at, revoked_at, created_at
     from api_hub_sessions where id = $1`,
    [sessionId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0] as {
    id: string;
    partner_id: string;
    ping_user_id: string;
    scopes: string[];
    encrypted_refresh_token: string;
    encrypted_access_token: string | null;
    access_expires_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
  };
  return {
    id: row.id,
    partnerId: row.partner_id,
    pingUserId: row.ping_user_id,
    scopes: row.scopes as Scope[],
    encryptedRefreshToken: row.encrypted_refresh_token,
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : undefined,
    createdAt: row.created_at.toISOString(),
    encryptedPingAccessToken: row.encrypted_access_token ?? undefined,
    accessExpiresAt: row.access_expires_at ? row.access_expires_at.toISOString() : undefined,
  };
}

export async function upsertUserLink(input: {
  partnerId: string;
  externalUserId: string;
  pingUserId: string;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `insert into api_hub_user_links (partner_id, external_user_id, ping_user_id)
     values ($1,$2,$3)
     on conflict (partner_id, external_user_id) do update
     set ping_user_id = excluded.ping_user_id`,
    [input.partnerId, input.externalUserId, input.pingUserId],
  );
}

export async function insertAudit(event: string, details: Record<string, unknown>): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`insert into api_hub_audit_log (event, details) values ($1, $2::jsonb)`, [
    event,
    JSON.stringify(details),
  ]);
}

export async function insertWebhookOutbox(partnerId: string, envelope: RealtimeEnvelope): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(
    `insert into api_hub_webhook_outbox (partner_id, payload) values ($1, $2::jsonb)`,
    [partnerId, JSON.stringify(envelope)],
  );
}

export async function runWebhookOutboxDelivery(
  deliver: (row: {
    id: number;
    partner_id: string;
    payload: RealtimeEnvelope;
    tries: number;
  }) => Promise<void>,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const picked = await client.query(
      `select id, partner_id, payload, tries from api_hub_webhook_outbox
       where delivered_at is null and next_try_at <= now() and tries < 5
       order by id
       limit 8
       for update skip locked`,
    );
    const rows = picked.rows as Array<{
      id: number;
      partner_id: string;
      payload: RealtimeEnvelope;
      tries: number;
    }>;
    for (const row of rows) {
      try {
        const payload = { ...row.payload, partnerId: row.payload.partnerId ?? row.partner_id };
        await deliver({
          id: row.id,
          partner_id: row.partner_id,
          payload,
          tries: row.tries,
        });
        await client.query(`update api_hub_webhook_outbox set delivered_at = now() where id = $1`, [row.id]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown";
        const nextTries = row.tries + 1;
        const nextTryAt =
          nextTries >= 5 ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : new Date(Date.now() + nextTries * 1000);
        await client.query(
          `update api_hub_webhook_outbox set tries = $2, last_error = $3, next_try_at = $4 where id = $1`,
          [row.id, nextTries, msg, nextTryAt],
        );
      }
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function countWebhookDeadLetter(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;
  const r = await pool.query(
    `select count(*)::int as c from api_hub_webhook_outbox where delivered_at is null and tries >= 5`,
  );
  return (r.rows[0] as { c: number }).c;
}

/** Record new API key for partner (rotation); audit should be logged separately. */
export async function insertPartnerApiKey(partnerId: string, apiKey: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query(`insert into api_hub_partner_api_keys (partner_id, api_key) values ($1, $2)`, [
    partnerId,
    apiKey,
  ]);
}
