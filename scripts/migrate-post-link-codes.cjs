#!/usr/bin/env node
"use strict";
/**
 * Бэкфилл коротких ссылок постов:
 * - проставляет posts.link_code, если он NULL/пустой;
 * - заменяет legacy-значения link_code в формате UUID на короткий код.
 *
 * Идемпотентно: можно запускать повторно.
 */
const { randomBytes } = require("crypto");
const { Client } = require("pg");

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const UUID_RE = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
const BATCH_SIZE = 250;

function randomCode(length = 10) {
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

async function mintUniqueCode(client) {
  for (let i = 0; i < 64; i += 1) {
    const code = randomCode(10);
    const hit = await client.query("SELECT 1 FROM posts WHERE link_code = $1 LIMIT 1", [code]);
    if (hit.rowCount === 0) return code;
  }
  throw new Error("Не удалось сгенерировать уникальный link_code (64 попытки).");
}

async function pickBatch(client) {
  const q = await client.query(
    `
      SELECT id
      FROM posts
      WHERE link_code IS NULL
         OR btrim(link_code) = ''
         OR link_code ~* $1
      LIMIT $2
    `,
    [UUID_RE, BATCH_SIZE]
  );
  return q.rows.map((r) => String(r.id));
}

async function main() {
  const dbUrl = (process.env.DATABASE_URL || "").trim();
  if (!dbUrl) {
    console.warn("DATABASE_URL не задан, migrate-post-link-codes пропущен.");
    process.exit(0);
  }

  const client = new Client({ connectionString: dbUrl });
  let updated = 0;

  try {
    await client.connect();
    await client.query("ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_code varchar(12)");

    for (;;) {
      const ids = await pickBatch(client);
      if (ids.length === 0) break;

      for (const id of ids) {
        const code = await mintUniqueCode(client);
        const res = await client.query(
          `
            UPDATE posts
            SET link_code = $1
            WHERE id = $2
              AND (
                link_code IS NULL
                OR btrim(link_code) = ''
                OR link_code ~* $3
              )
          `,
          [code, id, UUID_RE]
        );
        if (res.rowCount > 0) updated += 1;
      }
    }

    console.log(`[migrate-post-link-codes] done, updated=${updated}`);
  } catch (e) {
    console.error("[migrate-post-link-codes] failed:", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
