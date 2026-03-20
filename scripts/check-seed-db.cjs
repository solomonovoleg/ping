#!/usr/bin/env node
"use strict";
/**
 * Проверка: есть ли в БД сиды seed_social_* и их посты/активные сториз.
 * Запуск на сервере: cd /var/www/ping-moot && node scripts/check-seed-db.cjs
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadDatabaseUrl() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.error("Нет файла .env в", process.cwd());
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const line = content.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  if (!line) {
    console.error("DATABASE_URL не найден в .env");
    process.exit(1);
  }
  let url = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim().replace(/^["']|["']$/g, "");
  return url.replace(/@base/g, "@localhost").replace(/:base:/g, ":localhost:");
}

async function main() {
  const url = loadDatabaseUrl();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const u = await client.query(
      "select count(*)::int as n from users where phone like $1",
      ["seed_social_%"]
    );
    const p = await client.query(
      `select count(*)::int as n from posts p
       inner join users u on u.id = p.author_id
       where u.phone like $1 and coalesce(p.is_draft, false) = false`,
      ["seed_social_%"]
    );
    const s = await client.query(
      `select count(*)::int as n from stories st
       inner join users u on u.id = st.author_id
       where u.phone like $1 and st.expires_at > now()`,
      ["seed_social_%"]
    );
    const out = {
      seed_social_users: u.rows[0].n,
      public_posts_by_seeds: p.rows[0].n,
      active_stories_by_seeds: s.rows[0].n,
    };
    console.log(JSON.stringify(out, null, 2));
    if (out.seed_social_users === 0) {
      console.error("\n→ Сид на этой БД не прогнан (нет пользователей seed_social_*).");
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
