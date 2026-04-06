import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

function getConnectionString(): string {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  // Если в URL хост "base" (опечатка/плейсхолдер) — подставляем localhost
  if (url.includes("@base")) {
    url = url.replace(/@base(?=[:\/]|$)/g, "@localhost");
    console.warn("[db] DATABASE_URL contained host 'base', replaced with 'localhost'");
  }
  return url;
}

/** Параллельные запросы к БД из одного процесса Node (PM2 у вас обычно instances: 1). Не ставьте выше max_connections в Postgres минус запас. */
function getPoolMax(): number {
  const raw = process.env.PG_POOL_MAX?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.min(100, Math.max(5, Math.floor(n)));
  }
  return 40;
}

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      max: getPoolMax(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return pool;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

let userColumnsEnsured = false;
let adminMediaStudioSchemaEnsured = false;

/** Добавляет колонки в users, если их нет (один раз за процесс): last_seen_at, fcm_token, gender, birth_date и др. */
export async function ensureUserColumns(): Promise<void> {
  if (userColumnsEnsured) return;
  const p = getPool();
  try {
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS show_cover BOOLEAN NOT NULL DEFAULT true");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_link TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_post_id VARCHAR");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'all'");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_to VARCHAR(20) DEFAULT 'all'");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_limit INTEGER");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vibe_enabled BOOLEAN NOT NULL DEFAULT false");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vibe_share_with_partner BOOLEAN NOT NULL DEFAULT false");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_status VARCHAR(32) NOT NULL DEFAULT 'none'");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_status_updated_at TIMESTAMPTZ");
    await p.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS business_status_updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL",
    );
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_contact_phone VARCHAR(64)");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS business_address TEXT");
    await p.query("CREATE INDEX IF NOT EXISTS users_business_status_idx ON users(business_status)");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_lookup_hash VARCHAR(64)");
    await p.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_cipher TEXT");
    await p.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_phone_lookup_hash_uidx ON users(phone_lookup_hash) WHERE phone_lookup_hash IS NOT NULL",
    );
    try {
      await p.query("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL");
    } catch {
      /* уже nullable или нет прав */
    }
    try {
      await p.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key");
    } catch {
      /* нет ограничения */
    }
    try {
      await p.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique");
    } catch {
      /* нет ограничения */
    }
    await p.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_phone_plain_uidx ON users(phone)
      WHERE phone IS NOT NULL AND btrim(phone) <> ''
    `);
    try {
      const { isPhoneAtRestEnabled, preparePhoneForStorage } = await import("../auth/phone-at-rest");
      const { normalizePhone } = await import("../auth/phone");
      if (isPhoneAtRestEnabled()) {
        const r = await p.query(
          `SELECT id, phone FROM users WHERE phone IS NOT NULL AND btrim(phone) <> '' AND phone_lookup_hash IS NULL`,
        );
        for (const row of r.rows as { id: string; phone: string }[]) {
          if (row.phone === "admin") continue;
          const norm = normalizePhone(row.phone);
          if (!norm) continue;
          const { phoneLookupHash: h, phoneCipher: c } = preparePhoneForStorage(norm);
          await p.query(`UPDATE users SET phone_lookup_hash = $1, phone_cipher = $2, phone = NULL WHERE id = $3`, [
            h,
            c,
            row.id,
          ]);
        }
      }
    } catch (e) {
      console.warn("[db] phone-at-rest backfill skipped:", e);
    }
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(64)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_forwarded_for TEXT`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_user_agent TEXT`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ua_hash VARCHAR(64)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_accept_language VARCHAR(256)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua TEXT`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua_mobile VARCHAR(32)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua_platform VARCHAR(256)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_referer TEXT`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_origin VARCHAR(256)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_device_id VARCHAR(128)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_client_signals_hash VARCHAR(64)`);
    await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_client_signals_json TEXT`);
    await p.query(
      `CREATE INDEX IF NOT EXISTS users_signup_device_id_idx ON users (signup_device_id) WHERE signup_device_id IS NOT NULL`,
    );
    await p.query(`CREATE INDEX IF NOT EXISTS users_signup_ip_idx ON users (signup_ip) WHERE signup_ip IS NOT NULL`);
    await p.query(
      `CREATE INDEX IF NOT EXISTS users_signup_ua_hash_idx ON users (signup_ua_hash) WHERE signup_ua_hash IS NOT NULL`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS users_signup_client_signals_hash_idx ON users (signup_client_signals_hash) WHERE signup_client_signals_hash IS NOT NULL`,
    );
    await p.query(`
      CREATE TABLE IF NOT EXISTS business_status_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        links_json TEXT NOT NULL DEFAULT '[]',
        consent_moderation BOOLEAN NOT NULL DEFAULT true,
        status VARCHAR(32) NOT NULL DEFAULT 'submitted',
        admin_comment TEXT,
        moderated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        moderated_at TIMESTAMPTZ
      )
    `);
    await p.query(
      `ALTER TABLE business_status_requests DROP CONSTRAINT IF EXISTS business_status_requests_status_chk`,
    );
    await p.query(`
      ALTER TABLE business_status_requests ADD CONSTRAINT business_status_requests_status_chk CHECK (
        status IN ('submitted', 'approved', 'rejected', 'revision_required')
      )
    `);
    await p.query(
      `CREATE INDEX IF NOT EXISTS business_status_requests_user_created_idx ON business_status_requests(user_id, created_at DESC)`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS business_status_requests_status_created_idx ON business_status_requests(status, created_at DESC)`,
    );
    await p.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS business_status_requests_user_active_submitted_uidx
       ON business_status_requests(user_id)
       WHERE status = 'submitted'`,
    );
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_studio_synthetic BOOLEAN NOT NULL DEFAULT false`,
    );
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_created_by_admin_id VARCHAR REFERENCES users(id) ON DELETE SET NULL`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS users_is_studio_synthetic_idx ON users(is_studio_synthetic) WHERE is_studio_synthetic = true`,
    );
    userColumnsEnsured = true;
    const { ensureReplySchema } = await import("../messages/reply");
    await ensureReplySchema(p);
    const { ensureMessageReactionsSchema } = await import("../messages/reactions");
    await ensureMessageReactionsSchema(p);
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL");
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_sender_id VARCHAR REFERENCES users(id) ON DELETE SET NULL");
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_sender_name TEXT");
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript TEXT");
    await p.query(`
      CREATE TABLE IF NOT EXISTS saved_messages (
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        chat_id VARCHAR NOT NULL,
        saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, message_id)
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await p.query("CREATE INDEX IF NOT EXISTS ai_chat_messages_user_created ON ai_chat_messages(user_id, created_at DESC)");
    await p.query("ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS payload JSONB");
    console.log("[db] ensureUserColumns: last_seen_at, fcm_token OK");
  } catch (e) {
    console.error("[db] ensureUserColumns failed (повторим при следующем запросе):", e);
  }
}

/**
 * Резервная защита для Media Studio: если миграции 0040/0041 не применены,
 * backend должен уметь создать кампании и очередь без падений.
 */
export async function ensureAdminMediaStudioSchema(): Promise<void> {
  if (adminMediaStudioSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_studio_synthetic BOOLEAN NOT NULL DEFAULT false`,
    );
    await p.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_created_by_admin_id VARCHAR REFERENCES users(id) ON DELETE SET NULL`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS users_is_studio_synthetic_idx ON users(is_studio_synthetic) WHERE is_studio_synthetic = true`,
    );

    await p.query(`
      CREATE TABLE IF NOT EXISTS admin_media_studio_campaigns (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        schedule_mode VARCHAR(32),
        schedule_interval_seconds_min INTEGER,
        schedule_interval_seconds_max INTEGER,
        shuffle_seed BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT admin_media_studio_campaigns_status_chk CHECK (
          status IN ('draft', 'running', 'paused', 'completed', 'cancelled')
        ),
        CONSTRAINT admin_media_studio_campaigns_schedule_mode_chk CHECK (
          schedule_mode IS NULL OR schedule_mode IN ('fixed_interval', 'random_interval')
        )
      )
    `);
    await p.query(`ALTER TABLE admin_media_studio_campaigns ADD COLUMN IF NOT EXISTS title TEXT`);
    await p.query(
      `CREATE INDEX IF NOT EXISTS admin_media_studio_campaigns_status_idx ON admin_media_studio_campaigns(status)`,
    );
    await p.query(
      `CREATE INDEX IF NOT EXISTS admin_media_studio_campaigns_created_by_idx ON admin_media_studio_campaigns(created_by_admin_id)`,
    );

    await p.query(`
      CREATE TABLE IF NOT EXISTS admin_media_studio_campaign_posts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id VARCHAR NOT NULL REFERENCES admin_media_studio_campaigns(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        author_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        body_text TEXT,
        media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        scheduled_at TIMESTAMPTZ,
        published_post_id VARCHAR REFERENCES posts(id) ON DELETE SET NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'queued',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT admin_media_studio_campaign_posts_state_chk CHECK (
          state IN ('queued', 'published', 'failed', 'skipped')
        )
      )
    `);
    await p.query(
      `CREATE INDEX IF NOT EXISTS admin_media_studio_campaign_posts_campaign_idx ON admin_media_studio_campaign_posts(campaign_id)`,
    );
    await p.query(`
      CREATE INDEX IF NOT EXISTS admin_media_studio_campaign_posts_scheduled_idx
      ON admin_media_studio_campaign_posts(scheduled_at)
      WHERE state = 'queued' AND scheduled_at IS NOT NULL
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS admin_media_studio_group_invites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        max_members INTEGER,
        revoked_at TIMESTAMPTZ
      )
    `);
    await p.query(
      `CREATE INDEX IF NOT EXISTS admin_media_studio_group_invites_chat_idx ON admin_media_studio_group_invites(chat_id)`,
    );

    adminMediaStudioSchemaEnsured = true;
    console.log("[db] admin media studio schema OK");
  } catch (e) {
    console.error("[db] ensureAdminMediaStudioSchema failed (повторим при следующем запросе):", e);
  }
}

let platformSettingsCompatEnsured = false;

/**
 * Приводит `platform_settings` к ожиданиям Drizzle (shared/schema/platform-settings.ts):
 * таблица + строка default, strict_api_shield, реферальные поля (0037), регистрация по звонку (0046).
 * Иначе SELECT по полной схеме падает / UPSERT может отдавать 500 в админке.
 */
export async function ensurePlatformSettingsCompat(): Promise<void> {
  if (platformSettingsCompatEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`
CREATE TABLE IF NOT EXISTS platform_settings (
  id varchar PRIMARY KEY,
  banner_enabled boolean NOT NULL DEFAULT false,
  banner_text text NOT NULL DEFAULT '',
  banner_variant varchar(16) NOT NULL DEFAULT 'info',
  maintenance_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
`);
    await p.query(
      `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS strict_api_shield boolean NOT NULL DEFAULT false`,
    );
    await p.query(`
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS referral_default_invites integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS referral_repeat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_repeat_invites integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS referral_repeat_after_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS referral_multi_use_default_expires_hours integer NOT NULL DEFAULT 168
`);
    await p.query(
      `ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registration_phone_call_verification_enabled boolean NOT NULL DEFAULT true`,
    );
    platformSettingsCompatEnsured = true;
  } catch (e) {
    console.error("[db] ensurePlatformSettingsCompat failed (повторим при следующем запросе):", e);
  }
}

/** @deprecated используйте ensurePlatformSettingsCompat — оставлено для совместимости импортов */
export async function ensurePlatformRegistrationPhoneVerificationColumn(): Promise<void> {
  await ensurePlatformSettingsCompat();
}

let storyCaptionNotificationSchemaEnsured = false;

/** Подпись у сторис и story_id в уведомлениях (migrations/0039). */
export async function ensureStoryCaptionNotificationSchema(): Promise<void> {
  if (storyCaptionNotificationSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption text`);
    await p.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS story_id varchar`);
    storyCaptionNotificationSchemaEnsured = true;
  } catch (e) {
    console.error("[db] ensureStoryCaptionNotificationSchema failed (повторим при следующем запросе):", e);
  }
}

let storiesFeedBoostColumnsEnsured = false;

/** Колонки ранжирования ленты сторис (если не накатили migrations/0025 на VPS). */
export async function ensureStoriesFeedBoostColumns(): Promise<void> {
  if (storiesFeedBoostColumnsEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS feed_boost_like_at TIMESTAMPTZ`);
    await p.query(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS feed_boost_reply_at TIMESTAMPTZ`);
    await p.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'stories' AND column_name = 'feed_boosted_at'
        ) THEN
          UPDATE stories
          SET
            feed_boost_like_at = COALESCE(feed_boost_like_at, feed_boosted_at),
            feed_boost_reply_at = COALESCE(feed_boost_reply_at, feed_boosted_at)
          WHERE feed_boosted_at IS NOT NULL;
          ALTER TABLE stories DROP COLUMN feed_boosted_at;
        END IF;
      END $$;
    `);
    storiesFeedBoostColumnsEnsured = true;
  } catch (e) {
    console.error("[db] ensureStoriesFeedBoostColumns failed (повторим при следующем запросе):", e);
  }
}

let chatVibeSchemaEnsured = false;

/** Таблицы адаптивной атмосферы DM (без отдельного migrate на старых VPS). */
export async function ensureChatVibeSchema(): Promise<void> {
  if (chatVibeSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS chat_vibe_state (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id varchar NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
        theme text NOT NULL DEFAULT 'casual',
        confidence numeric(5,2) NOT NULL DEFAULT 0,
        warmth int NOT NULL DEFAULT 50,
        tension int NOT NULL DEFAULT 10,
        playfulness int NOT NULL DEFAULT 30,
        intimacy int NOT NULL DEFAULT 20,
        formality int NOT NULL DEFAULT 30,
        energy int NOT NULL DEFAULT 40,
        message_counter int NOT NULL DEFAULT 0,
        theme_version int NOT NULL DEFAULT 1,
        last_batch_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS chat_vibe_batches (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        window_size int NOT NULL,
        dominant_pattern text NOT NULL,
        secondary_pattern text,
        confidence numeric(5,2) NOT NULL,
        warmth int NOT NULL,
        tension int NOT NULL,
        playfulness int NOT NULL,
        intimacy int NOT NULL,
        formality int NOT NULL,
        energy int NOT NULL,
        toxicity_flag boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await p.query("CREATE INDEX IF NOT EXISTS idx_chat_vibe_batches_chat_id ON chat_vibe_batches(chat_id)");
    await p.query(`
      CREATE TABLE IF NOT EXISTS chat_vibe_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        old_theme text NOT NULL,
        new_theme text NOT NULL,
        old_confidence numeric(5,2) NOT NULL,
        new_confidence numeric(5,2) NOT NULL,
        trigger_type text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await p.query("CREATE INDEX IF NOT EXISTS idx_chat_vibe_history_chat_id ON chat_vibe_history(chat_id)");
    chatVibeSchemaEnsured = true;
    console.log("[db] chat_vibe schema OK");
  } catch (e) {
    console.error("[db] ensureChatVibeSchema failed (повторим при следующем запросе):", e);
  }
}

let callTranscriptsSchemaEnsured = false;

export async function ensureCallTranscriptsSchema(): Promise<void> {
  if (callTranscriptsSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_sessions_history (
        id varchar PRIMARY KEY,
        chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        media_type text NOT NULL DEFAULT 'audio',
        created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz
      )
    `);
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_participants_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id varchar NOT NULL REFERENCES call_sessions_history(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name_snapshot text NOT NULL,
        joined_at timestamptz NOT NULL DEFAULT now(),
        left_at timestamptz
      )
    `);
    await p.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_call_participant_unique ON call_participants_history(call_id, user_id)");
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_transcript_segments (
        id varchar PRIMARY KEY,
        call_id varchar NOT NULL REFERENCES call_sessions_history(id) ON DELETE CASCADE,
        speaker_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        speaker_display_name text NOT NULL,
        source_stream_id varchar,
        language varchar(24) NOT NULL DEFAULT 'ru-RU',
        text_raw text NOT NULL,
        text_normalized text NOT NULL,
        confidence int NOT NULL DEFAULT 0,
        started_at_ms int NOT NULL DEFAULT 0,
        ended_at_ms int NOT NULL DEFAULT 0,
        is_final boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await p.query("CREATE INDEX IF NOT EXISTS idx_call_transcript_call_created ON call_transcript_segments(call_id, created_at)");
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_command_suggestions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        call_id varchar NOT NULL REFERENCES call_sessions_history(id) ON DELETE CASCADE,
        segment_id varchar REFERENCES call_transcript_segments(id) ON DELETE CASCADE,
        intent_type text NOT NULL,
        title text NOT NULL,
        payload_json text NOT NULL DEFAULT '{}',
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        resolved_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await p.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_call_command_unique_segment_intent ON call_command_suggestions(segment_id, intent_type)");
    await p.query(`
      CREATE TABLE IF NOT EXISTS call_track_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        track_id varchar NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        call_id varchar NOT NULL REFERENCES call_sessions_history(id) ON DELETE CASCADE,
        segment_id varchar NOT NULL REFERENCES call_transcript_segments(id) ON DELETE CASCADE,
        speaker_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        speaker_display_name text NOT NULL,
        text text NOT NULL,
        added_at timestamptz NOT NULL DEFAULT now(),
        done_at timestamptz
      )
    `);
    await p.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_call_track_items_track_segment ON call_track_items(track_id, segment_id)");
    callTranscriptsSchemaEnsured = true;
    console.log("[db] call_transcripts schema OK");
  } catch (e) {
    console.error("[db] ensureCallTranscriptsSchema failed (повторим при следующем запросе):", e);
  }
}

let chatCodesSchemaEnsured = false;

/**
 * Резервная защита для short_code/invite_code в chats:
 * если миграции 0044/0045 не доехали на VPS, backend не должен падать.
 */
export async function ensureChatCodesSchema(): Promise<void> {
  if (chatCodesSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS invite_code text`);
    await p.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS short_code varchar(12)`);
    await p.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chats_invite_code_uniq
      ON chats (invite_code)
      WHERE invite_code IS NOT NULL
    `);
    await p.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chats_short_code_uniq
      ON chats (short_code)
      WHERE short_code IS NOT NULL
    `);
    await p.query(`
      UPDATE chats
      SET short_code = substr(md5(id::text), 1, 8)
      WHERE short_code IS NULL
        AND type IN ('group', 'business')
    `);
    chatCodesSchemaEnsured = true;
    console.log("[db] chats short/invite code schema OK");
  } catch (e) {
    console.error("[db] ensureChatCodesSchema failed (повторим при следующем запросе):", e);
  }
}

let postsFeedSchemaEnsured = false;

/**
 * Минимальная схема для ленты постов на случай отставших миграций на VPS.
 * Делает backend устойчивым к деплою, когда код уже обновился, а SQL — еще нет.
 */
export async function ensurePostsFeedSchema(): Promise<void> {
  if (postsFeedSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_code varchar(12)`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls jsonb`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_layout jsonb`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags jsonb`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'public'`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS edge_id varchar(128)`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS edge_display_audience varchar(20)`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_interests jsonb`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_interests_at timestamptz`);
    await p.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`);
    await p.query(
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_on_author_wall boolean NOT NULL DEFAULT true`,
    );
    await p.query(`
      CREATE TABLE IF NOT EXISTS feed_global_snapshot (
        id smallint PRIMARY KEY DEFAULT 1,
        computed_at timestamptz NOT NULL,
        algo_mode text NOT NULL,
        candidate_count integer NOT NULL,
        post_ids jsonb NOT NULL
      )
    `);
    postsFeedSchemaEnsured = true;
    console.log("[db] posts/feed schema OK");
  } catch (e) {
    console.error("[db] ensurePostsFeedSchema failed (повторим при следующем запросе):", e);
  }
}

let contentReportsSchemaEnsured = false;

/**
 * Таблица жалоб (admin-ops + migrations/0042–0043). Если `migrate-admin-ops` не гоняли на VPS,
 * POST /api/reports падал с «relation content_reports does not exist» → 500.
 */
export async function ensureContentReportsSchema(): Promise<void> {
  if (contentReportsSchemaEnsured || !process.env.DATABASE_URL) return;
  const p = getPool();
  try {
    await p.query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        reporter_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type varchar(32) NOT NULL,
        target_id text NOT NULL,
        reason text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'open',
        admin_note text,
        resolved_by varchar,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await p.query(`
      CREATE INDEX IF NOT EXISTS content_reports_status_created
      ON content_reports (status, created_at DESC)
    `);
    await p.query(`ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS context_post_id text`);
    await p.query(`ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS context_chat_id varchar(128)`);
    await p.query(`ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS reason_code varchar(32)`);
    contentReportsSchemaEnsured = true;
    console.log("[db] content_reports schema OK");
  } catch (e) {
    console.error("[db] ensureContentReportsSchema failed (повторим при следующем запросе):", e);
  }
}
