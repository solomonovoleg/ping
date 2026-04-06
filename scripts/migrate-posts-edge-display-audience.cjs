#!/usr/bin/env node
"use strict";
/**
 * posts.edge_display_audience — видимость поста с кампанией EDGE.
 * migrations/0036_posts_edge_display_audience.sql
 */
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    if (m[1] === "DATABASE_URL" && process.env.DATABASE_URL) continue;
    let val = m[2].replace(/^["']|["']$/g, "").trim();
    if (m[1] === "DATABASE_URL" && val.includes("@base")) val = val.replace(/@base/g, "@localhost");
    process.env[m[1]] = val;
  }
}

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

loadEnv();
const { Client } = require("pg");
const sqlPath = path.join(process.cwd(), "migrations/0036_posts_edge_display_audience.sql");

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  if (!fs.existsSync(sqlPath)) {
    console.error("Missing", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK migrate-posts-edge-display-audience");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
