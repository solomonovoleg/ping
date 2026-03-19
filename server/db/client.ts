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
