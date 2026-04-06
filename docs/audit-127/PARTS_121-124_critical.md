# Аудит: части 121–124 (критические моменты системы)

Фокус: что ломает продукт целиком при сбое; что мониторить в проде.

---

<a id="part-121"></a>
## Часть 121 — Данные и миграции

**Критичность:** PostgreSQL + Drizzle; цепочка `scripts/run-migrations.cjs` и отдельные EDGE/PARSER миграции (`docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`). Отсутствие таблицы `session` ломало вход — исправлено `ensureSessionTable`.

**Топ-риски:** P0 — пропуск миграции на одном из контуров (platform vs EDGE). P1 — `db:push` вместо контролируемых миграций на проде. P2 — долгие блокирующие миграции в пик.

**Мониторинг:** ошибки старта приложения с `[db]` / `[session]`; алерты на failed migration job; размер БД и bloat.

### Metrics — Часть 121

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 3 |
| **Risk** | P0: 1*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`, `server/db/`, `server/auth/session.ts` |

---

<a id="part-122"></a>
## Часть 122 — WebSocket и звонки

**Критичность:** Единый `/calls` WS на пользователя; чат realtime отдельно. Обрыв WS влияет на доставку событий и signaling.

**Топ-риски:** P0 — массовый disconnect при деплое без graceful. P1 — дубли peer/tab (см. `docs/CALLS_EDGE_CASES.md`). P2 — утечки обработчиков при HMR/dev.

**Мониторинг:** rate reconnect; p95 времени установки звонка; ошибки TURN; 4xx/5xx на `/api/calls/token`.

### Metrics — Часть 122

| Метрика | Значение |
|---------|----------|
| **Coverage** | 60% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 3 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `docs/CALLS_RELIABILITY.md`, `server/calls/ws.ts`, `server/realtime/chat.ts` |

---

<a id="part-123"></a>
## Часть 123 — Медиа и хранилище

**Критичность:** Локальные `uploads/` на VPS или S3-совместимое (проверить прод-конфиг). Диск ops в админке (`server/admin/ops`).

**Топ-риски:** P0 — заполнение диска → запись медиа и сессии падают. P1 — отсутствие бэкапа и lifecycle для старых файлов. P2 — медленная отдача без CDN.

**Мониторинг:** `disk-stats` / алерты из ops; 5xx на upload эндпоинтах; latency раздачи статики nginx.

### Metrics — Часть 123

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 1, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/upload/`, `server/admin/ops/README.md` |

---

<a id="part-124"></a>
## Часть 124 — Многосервисность (EDGE / PARSER / ПИНГОК)

**Критичность:** PM2 может поднимать несколько процессов; nginx маршрутизация (`EDGE_PM2_ENABLED`, group-calls path).

**Топ-риски:** P0 — неверный upstream → тихая деградация фич. P1 — рассинхрон версий API платформа↔EDGE. P2 — отладка распределённых багов без correlation id.

**Мониторинг:** health-check каждого процесса; логи с общим `requestId` где возможно; фичефлаги для отключения EDGE в инциденте.

### Metrics — Часть 124

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `EDGE/server/`, `ecosystem.config.cjs`, `AGENTS.md` |
