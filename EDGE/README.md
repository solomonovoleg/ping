# EDGE — микросервис геймификации

Отдельный процесс Node (Express). **Не влияет на основное приложение**, если не включён прокси и PM2.

## Локально

```bash
npm run dev:edge
```

По умолчанию слушает **`127.0.0.1:3092`** (только localhost).

## Переменные

| Переменная | Назначение |
|------------|------------|
| `PORT` / `EDGE_PORT` | Порт (приоритет `PORT`) |
| `EDGE_BIND` | Хост бинда, по умолчанию `127.0.0.1` |
| `EDGE_SERVICE_SECRET` | Если задан — `GET /v1/companion/*` требует `Authorization: Bearer <secret>` или `X-Edge-Secret` |
| `EDGE_DATABASE_URL` | PostgreSQL только для EDGE (отдельная БД). Без неё — ручки с БД отвечают 503 |
| `EDGE_PG_POOL_MAX` | Размер пула (по умолчанию 8) |

## База данных

```bash
# локально: создай БД и пропиши URL, затем
node EDGE/db/run-migrations.cjs
```

При деплое миграции EDGE запускаются из `scripts/server-setup.sh`, если в `.env` на сервере есть `EDGE_DATABASE_URL`. См. `docs/EDGE_DATABASE.md`.

## Платформа (ping-moot)

В `.env` основного приложения **опционально**:

- `EDGE_UPSTREAM_URL=http://127.0.0.1:3092` — включить прокси `/api/edge/*` на микросервис
- `EDGE_SERVICE_SECRET` — тот же секрет, что на EDGE
- `EDGE_PROXY_TIMEOUT_MS` — таймаут прокси (по умолчанию 2500)

Без `EDGE_UPSTREAM_URL` маршруты `/api/edge/*` на платформе отвечают **503** (см. основной `.env.example`).

## PM2

Процесс **не стартует**, пока в `.env` не задано **`EDGE_PM2_ENABLED=1`**. См. `ecosystem.config.cjs`.

## Сборка

`npm run build` собирает `dist/edge.cjs` (как `pingok-micro`).

## Внутренние маршруты (v1)

| Метод | Путь | Заголовки |
|-------|------|-----------|
| GET | `/v1/health` | — |
| GET | `/v1/companion/campaign-config?edgeId=` | `Authorization: Bearer` или `X-Edge-Secret` (если задан секрет) |
| GET | `/v1/participant/state?edgeId=` | секрет + **`X-Platform-User-Id`** (ставит только прокси платформы) |
| POST | `/v1/participant/feed?edgeId=` | то же |
| GET | `/v1/participant/leaderboard?edgeId=` | секрет + `X-Platform-User-Id` |
| POST | `/v1/participant/interact?edgeId=` | то же, тело `{ "kind": "play" \| "pet" }` |
| POST | `/v1/campaign/draw` | только секрет (сервер-сервер), тело `{ "edgeId", "giftKey"?, "count"? }` |

Клиент приложения ходит на **`/api/edge/...`** на домене платформы (кука/Bearer), не на порт EDGE. Розыгрыш призов — **`POST /api/admin/edge/draw-prize`** на платформе (роль администратора).

Подробнее: `docs/EDGE_PRODUCT_SPEC.md`, `docs/EDGE_MICROSERVICE_PLAN.md`, `docs/EDGE_DATABASE.md`.
