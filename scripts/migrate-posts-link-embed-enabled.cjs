#!/usr/bin/env node
"use strict";
/**
 * posts.link_embed_enabled — опциональное отключение превью по внешней видеоссылке.
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
    console.warn("DATABASE_URL не задан, migrate-posts-link-embed-enabled пропущен.");
    process.exit(0);
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE posts
        ADD COLUMN IF NOT EXISTS link_embed_enabled boolean NOT NULL DEFAULT true;
    `);
    console.log("[migrate-posts-link-embed-enabled] ok");
  } catch (e) {
    console.error("[migrate-posts-link-embed-enabled]", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
