# ПИНГОК МИКРО

Изолированный подпроект **голосового ассистента / команд**: отдельный HTTP-процесс, свои типы и React-обвязка. Основное приложение подключает только **тонкий слой** (`AppLayout` → long-press по центральному логотипу).

## Насколько это «полная изоляция»

| Аспект | Статус |
|--------|--------|
| Отдельный процесс Node (порт, деплой, падения) | Да — `server/index.ts`, не регистрируется в `server/routes.ts` |
| Своя папка в корне, свои контракты | Да — `shared/`, `client/`, `server/` |
| Общая БД / сессии основного API | Пока нет; позже — только по явному контракту (JWT или прокси с основного сервера) |
| Сборка SPA | Клиентские модули импортируются в Vite как `@pingok-micro/*` (тот же бандл, общие токены UI `@/lib/*`) |

То есть **логически и операционно** сервис отделён; **визуально** он живёт в одном фронтенд-бандле — так проще темы, шрифты и `apiFetch` при будущей интеграции.

## Структура

- `client/` — оверлей голоса, long-press кнопка логотипа (интеграция из `AppLayout`).
- `server/` — минимальный Express: `GET /health`, `POST /v1/parse` (заглушка NLU).
- `shared/` — типы команд и фразы пробуждения (контракт клиент ↔ сервис).

## Разбор команд (NLU)

1. **Основной путь (рекомендуется):** на том же сервере, что и приложение — `requireAuth`, cookie + Bearer:
   - `POST /api/pingok-micro/v1/parse` — разбор команды;
   - `POST /api/pingok-micro/v1/memory-search` — поиск по перепискам (`tryGlobalMemorySearch`, без записи в AI-чат).
2. **Отдельный процесс:** `npm run dev:pingok-micro` → `POST http://localhost:3091/v1/parse` — без сессии, с **rate limit** (`PINGOK_MICRO_PARSE_PER_MIN`, по умолчанию 60/мин). Используется как fallback, если в `.env` задан `VITE_PINGOK_MICRO_URL`.

Логика разбора — один модуль `shared/parse-heuristic.ts`.

## Запуск отдельного процесса (локально)

```bash
npm run dev:pingok-micro
```

По умолчанию порт **3091** (см. `ПИНГОК МИКРО/.env.example`).

Опционально в корневом `.env` для клиента — fallback на standalone:

```env
VITE_PINGOK_MICRO_URL=http://localhost:3091
```

## Дальнейшие шаги

- Прокси с основного домена (`/pingok-micro/`) + авторизация.
- Реальный NLU (LLM или правила) в `POST /v1/parse`.
- Отдельный PM2-процесс на VPS: в корне `ecosystem.config.cjs` (второй app `pingok-micro`), сборка `dist/pingok-micro.cjs` в `npm run build` / `npm run deploy`. См. `docs/DEPLOY.md`.
