#!/usr/bin/env node
"use strict";
/**
 * Ответы на комментарии: колонка parent_comment_id → post_comments(id) ON DELETE CASCADE.
 * Идемпотентно. DATABASE_URL из .env.
 */
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
const { Client } = require("pg");

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

const SQL = `
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id varchar NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_parent_comment_id_fkey'
  ) THEN
    ALTER TABLE post_comments
      ADD CONSTRAINT post_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id ON post_comments(parent_comment_id);
`;

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("post_comments.parent_comment_id готово.");
  } catch (e) {
    console.error("Ошибка миграции:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
