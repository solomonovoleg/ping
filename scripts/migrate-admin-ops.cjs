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
const { Client } = require("pg");

const SQL = `
CREATE TABLE IF NOT EXISTS platform_settings (
  id varchar PRIMARY KEY,
  banner_enabled boolean NOT NULL DEFAULT false,
  banner_text text NOT NULL DEFAULT '',
  banner_variant varchar(16) NOT NULL DEFAULT 'info',
  maintenance_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS strict_api_shield boolean NOT NULL DEFAULT false;

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
);
CREATE INDEX IF NOT EXISTS content_reports_status_created ON content_reports (status, created_at DESC);
`;

async function main() {
  let url = (process.env.DATABASE_URL || "").replace(/@base/g, "@localhost").trim();
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("admin-ops: platform_settings, content_reports готовы.");
  } catch (e) {
    console.error("Ошибка migrate-admin-ops:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
