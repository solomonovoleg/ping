#!/usr/bin/env node
"use strict";
/**
 * Push feed: таблицы подписок и push-микропостов.
 * Идемпотентно.
 */
const path = require("path");
const fs = require("fs");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      if (m[1] === "DATABASE_URL" && process.env.DATABASE_URL) continue;
      let val = m[2].replace(/^["']|["']$/g, "").trim();
      if (m[1] === "DATABASE_URL" && val.includes("@base")) val = val.replace(/@base/g, "@localhost");
      process.env[m[1]] = val;
    }
  }
}

loadEnv();

async function main() {
  const dbUrl = (process.env.DATABASE_URL || "").trim().replace(/@base/g, "@localhost");
  if (!dbUrl) {
    console.warn("DATABASE_URL не задан, migrate-push-feed пропущен.");
    process.exit(0);
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hidden boolean NOT NULL DEFAULT false,
        notifications_enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (subscriber_id, author_id)
      );
      ALTER TABLE push_subscriptions
        ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
      ALTER TABLE push_subscriptions
        ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
      CREATE INDEX IF NOT EXISTS push_subscriptions_subscriber_created_idx
        ON push_subscriptions(subscriber_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS push_subscriptions_author_created_idx
        ON push_subscriptions(author_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS push_posts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ttl varchar(16) NOT NULL DEFAULT '24h',
        expires_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (post_id)
      );
      CREATE INDEX IF NOT EXISTS push_posts_author_created_idx
        ON push_posts(author_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS push_posts_expires_idx
        ON push_posts(expires_at);

      CREATE TABLE IF NOT EXISTS push_post_views (
        push_post_id varchar NOT NULL REFERENCES push_posts(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (push_post_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS push_post_views_post_idx
        ON push_post_views(push_post_id);

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS push_feed_notifications_enabled boolean NOT NULL DEFAULT true;

      CREATE TABLE IF NOT EXISTS push_hidden_items (
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        push_post_id varchar NOT NULL REFERENCES push_posts(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, push_post_id)
      );
      CREATE INDEX IF NOT EXISTS push_hidden_items_user_created_idx
        ON push_hidden_items(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS push_reactions (
        push_post_id varchar NOT NULL REFERENCES push_posts(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji varchar(24) NOT NULL DEFAULT '❤️',
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (push_post_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS push_reactions_post_created_idx
        ON push_reactions(push_post_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS push_replies (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        push_post_id varchar NOT NULL REFERENCES push_posts(id) ON DELETE CASCADE,
        post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        push_author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visibility varchar(16) NOT NULL DEFAULT 'public',
        text varchar(8000) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS push_replies_post_created_idx
        ON push_replies(push_post_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS push_replies_author_created_idx
        ON push_replies(author_id, created_at DESC);
    `);
    console.log("[migrate-push-feed] ok");
  } catch (e) {
    console.error("[migrate-push-feed]", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
