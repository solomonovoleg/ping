# PING MOOT — микросервис PARSER (ВК → посты)

Отдельный процесс Node/Express: **свой порт**, **свой HTTP-роутер**, **storage** в `storage/` + Drizzle к **той же PostgreSQL**, что и платформа (`users`, `posts` — внешние ключи).

## Запуск локально

```bash
# Та же DATABASE_URL, что у платформы; секрет общий с платформой; ключ шифрования токенов ВК
export PARSER_SERVICE_SECRET=dev-secret
export VK_PARSER_TOKEN_KEY=$(openssl rand -hex 32)
export PARSER_PLATFORM_URL=http://127.0.0.1:3080
npm run dev:parser
```

Платформа должна знать `PARSER_UPSTREAM_URL=http://127.0.0.1:3093` и тот же `PARSER_SERVICE_SECRET`.

## Продакшен: сеть и nginx

- **Порт парсера** (`PORT` / `PARSER_PORT`, по умолчанию 3093): слушать только loopback. В `config/env.ts` хост по умолчанию **`PARSER_BIND=127.0.0.1`** — не выставляй `0.0.0.0` без необходимости и **не открывай** этот порт в firewall и **не проксируй** его в nginx наружу. Доступ к API парсера — с платформы (прокси админки + секрет), а не с интернета.
- **Платформа, `POST /internal/parser/publish`**: вызывается микросервисом по `PARSER_PLATFORM_URL` (обычно `http://127.0.0.1:<PORT>`). За nginx, если весь трафик уходит в Node, злоумышленник теоретически может дернуть тот же путь снаружи, зная секрет. **Защита в глубину:** в конфиге nginx запретить внешний доступ к префиксу `/internal/parser` (оставить только loopback / внутреннюю сеть при необходимости).

Пример фрагмента для сайта, где основной `location /` проксирует на приложение:

```nginx
# Только с хоста (парсер бьёт в Node по 127.0.0.1 — часто этот блок не нужен;
# если же публикация идёт через тот же server_name, закройте путь от интернета.)
location /internal/parser {
    allow 127.0.0.1;
    allow ::1;
    deny all;
    proxy_pass http://127.0.0.1:3080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Если микросервис всегда ходит на приложение **напрямую** на `127.0.0.1:PORT` минуя nginx, внешний клиент этот путь не увидит — блок выше всё равно полезен, если когда-нибудь `PARSER_PLATFORM_URL` укажут на публичный origin.

## Миграции

```bash
node PARSER/db/run-migrations.cjs
```

## Сборка

`npm run build` → `dist/parser.cjs` (как EDGE).

## Архитектура (файлы ≤ ~300 строк)

| Путь | Назначение |
|------|------------|
| `config/env.ts` | Порт, БД, секрет, URL платформы |
| `db/pool.ts`, `db/client.ts`, `db/run-migrations.cjs` | Пул PG, Drizzle |
| `storage/repo.ts` | Доступ к таблицам парсера |
| `parser/*` | VK API, шифрование токена, ingest, вызов платформы на публикацию |
| `http/v1-router.ts` | Внутренний API под прокси админки |
| `middleware/require-parser-secret.ts` | Bearer / X-Parser-Secret |
| `health/*` | `/v1/health` |
| `server/create-app.ts`, `server/index.ts` | Express и listen |

Публикация поста: **POST** на платформу ` /internal/parser/publish` (loopback + `PARSER_SERVICE_SECRET`).

Привязок может быть сколько угодно (разные `platform_user_id` и/или разные `vk_owner_id`). Уникальность только пара «автор платформы + owner_id стены ВК» (индекс `vk_parser_bindings_user_owner_idx`).
