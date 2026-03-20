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

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
      idleTimeoutMillis: 30000,
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
    userColumnsEnsured = true;
    const { ensureReplySchema } = await import("../messages/reply");
    await ensureReplySchema(p);
    const { ensureMessageReactionsSchema } = await import("../messages/reactions");
    await ensureMessageReactionsSchema(p);
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL");
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_sender_id VARCHAR REFERENCES users(id) ON DELETE SET NULL");
    await p.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_sender_name TEXT");
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
    console.log("[db] ensureUserColumns: last_seen_at, fcm_token OK");
  } catch (e) {
    console.error("[db] ensureUserColumns failed (повторим при следующем запросе):", e);
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
