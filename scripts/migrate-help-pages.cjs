#!/usr/bin/env node
"use strict";
/**
 * Справочные страницы help_pages + начальные тексты.
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

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

const INVITE_BODY = `## Только по приглашению

PING быстро растёт, поэтому регистрация открыта лишь для тех, кого приглашают те, кто уже внутри. Так мы сохраняем атмосферу доверия и спокойствия.

## Три близких

Вы можете пригласить до трёх самых близких людей и общаться в полном комфорте. У каждого приглашённого тоже будет свой лимит — так друзья зовут своих, и сеть аккуратно расширяется (как знакомство через несколько рукопожатий, только в цифровом мире).

## Ваша личная соцсеть

Чаты, звонки, посты и сториз — всё в одном месте. Делитесь тем, чем хотите: это пространство для вас и вашего круга.

Ниже — ваши активные коды и заявка на расширение лимита, если понадобится ещё приглашений.`;

const INSTALL_BODY = `## Зачем добавлять на экран

Так вы откроваете PING как обычное приложение: без адресной строки браузера, с иконкой на рабочем столе и быстрым запуском в один тап.

## iPhone и iPad (Safari)

Система не позволяет установить сайт кнопкой со страницы — только вручную:

1. Нажмите кнопку **«Поделиться»** (квадрат со стрелкой вверх) внизу или сверху.
2. Прокрутите меню и выберите **«На экран Домой»** (или **Add to Home Screen**).
3. Подтвердите название и нажмите **«Добавить»**.

Готово: иконка PING появится рядом с другими приложениями.

## Android (Chrome)

Часто в меню браузера (**три точки**) есть пункт **«Установить приложение»** или **«Добавить на главный экран»**. Если на этой странице ниже есть кнопка **«Установить»**, браузер готов поставить PING как приложение — нажмите её и подтвердите.

Если кнопки нет: **Меню (⋮) → Добавить на главный экран** (название может чуть отличаться в зависимости от версии Chrome).

## Уже в приложении из магазина

Если вы пользуетесь PING из App Store или Google Play, отдельная установка из браузера не нужна.`;

async function main() {
  let url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS help_pages (
        id varchar PRIMARY KEY,
        slug varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        body text NOT NULL DEFAULT '',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS help_pages_sort_idx ON help_pages(sort_order, slug)`);

    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    await client.query(
      `INSERT INTO help_pages (id, slug, title, body, sort_order)
       VALUES ($1, 'invite-friends', $2, $3, 1)
       ON CONFLICT (slug) DO NOTHING`,
      [id1, "Как пригласить друзей", INVITE_BODY]
    );
    await client.query(
      `INSERT INTO help_pages (id, slug, title, body, sort_order)
       VALUES ($1, 'install-app', $2, $3, 2)
       ON CONFLICT (slug) DO NOTHING`,
      [id2, "Установить PING на экран телефона", INSTALL_BODY]
    );
    console.log("Таблица help_pages и начальные страницы готовы.");
  } catch (e) {
    console.error("Ошибка миграции help_pages:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
