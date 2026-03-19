#!/usr/bin/env node
"use strict";
const path = require("path");
const fs = require("fs");
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

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

const { Client } = require("pg");

const SQL = `
-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(20) NOT NULL,
  actor_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id varchar,
  comment_id varchar,
  excerpt text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- Posts: draft, visibility
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'public';

-- Users: city, status, pinned_post_id, profile_visibility, show_online_to
ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_post_id varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility varchar(20) NOT NULL DEFAULT 'all';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_to varchar(20) NOT NULL DEFAULT 'all';

-- Saved posts
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id varchar NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS saved_posts_user_id_idx ON saved_posts(user_id);

-- User blocks (blocker blocks blocked)
CREATE TABLE IF NOT EXISTS user_blocks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_id_idx ON user_blocks(blocker_id);

-- Chats: аватар группового чата
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url text;
`;

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const client = new Client({ connectionString: url.trim() });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("notifications, posts columns, users columns, saved_posts, user_blocks ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
