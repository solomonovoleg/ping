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
CREATE TABLE IF NOT EXISTS sticker_packs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  visibility varchar(16) NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sticker_packs_visibility_chk CHECK (visibility IN ('private', 'public'))
);

CREATE INDEX IF NOT EXISTS sticker_packs_user_id_idx ON sticker_packs(user_id);
CREATE INDEX IF NOT EXISTS sticker_packs_public_title_idx ON sticker_packs(visibility, lower(title));

CREATE TABLE IF NOT EXISTS stickers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id varchar NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stickers_pack_id_idx ON stickers(pack_id);
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
    console.log("sticker_packs / stickers tables ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
