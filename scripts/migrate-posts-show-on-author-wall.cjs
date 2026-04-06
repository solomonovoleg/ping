#!/usr/bin/env node
"use strict";
/**
 * posts.show_on_author_wall — посты «только Push» не на стене профиля / в глобальной ленте.
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
    console.warn("DATABASE_URL не задан, migrate-posts-show-on-author-wall пропущен.");
    process.exit(0);
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS show_on_author_wall boolean NOT NULL DEFAULT true;
    `);
    console.log("[migrate-posts-show-on-author-wall] ok");
  } catch (e) {
    console.error("[migrate-posts-show-on-author-wall]", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
