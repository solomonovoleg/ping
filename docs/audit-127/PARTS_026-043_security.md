# Аудит: части 026–043 (безопасность)

Полный обзор по слоям с фиксацией P0/P1/P2. Код: `server/auth/`, `server/middleware/`, `server/routes.ts`, микросервисы.

---

<a id="part-026"></a>
## Часть 026 — Сессии и cookies

**Наблюдения:** `express-session` + `connect-pg-simple` при наличии `DATABASE_URL`; иначе MemoryStore. Секреты `SESSION_SECRET` / смежные — `resolveRequiredSecret` с минимальной длиной 24. `SESSION_MAX_AGE_DAYS` ограничен 1–400. Purge пользователя удаляет строки `session` по `userId` в JSON (`server/storage/db-storage-purge-user.ts`).

**Риски:** P1 — MemoryStore в dev без БД: сессии теряются при рестарте, легко забыть что «локально работает». P2 — при `ALLOW_INSECURE_SECRETS=1` явный warn, но риск утечки в публичные логи dev.

### Metrics — Часть 026

| Метрика | Значение |
|---------|----------|
| **Coverage** | 75% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 1 |
| **Reliability** | Green |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/auth/session.ts`, `server/storage/db-storage-purge-user.ts` |

---

<a id="part-027"></a>
## Часть 027 — CORS, CSRF, security headers

**Наблюдения:** Категория `csrf` в `server/security/security-audit-log.ts`; нужно сверить фактические заголовки в `server/index.ts` / nginx. SPA на том же origin снижает классический CSRF для JSON API, но cookie-сессия чувствительна к cross-site запросам если CORS широкий.

**Риски:** P1 — любые формы `multipart` или GET с побочным эффектом без SameSite-анализа. P2 — централизованный список security headers (CSP, HSTS на nginx).

### Metrics — Часть 027

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber — нужна сверка с nginx |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/security/security-audit-log.ts`, `docs/DEPLOY_RULES.md` |

---

<a id="part-028"></a>
## Часть 028 — Авторизация маршрутов и IDOR

**Наблюдения:** Домены импортируют `requireAuth` / `getUserId` из `server/auth/session.ts`. Критичные пути: чаты, сообщения, посты — проверять что `chatId`/`postId` принадлежат участнику/зрителю (`post-access`, `viewerMayDmTarget`).

**Риски:** P0 — любой пропущенный `requireAuth` на mutate. P1 — перечисление id (утечка существования ресурса) через разные коды ответа.

### Metrics — Часть 028

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 4 |
| **Risk** | P0: 0*, P1: 2 (*требует регресс-тестов) |
| **Reliability** | Green при выборочной проверке |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/posts/post-access.ts`, `server/chats/start-dm-for-user.ts` |

---

<a id="part-029"></a>
## Часть 029 — Загрузки файлов и MIME

**Наблюдения:** Модули `server/upload/*` (avatar, cover, post-media, chat-media, story-media, voice). Требуют `requireAuth`.

**Риски:** P0 — обход лимитов размера / типа. P1 — SSRF через «импорт по URL» если есть. P2 — унификация антивирусной политики (если нужна).

### Metrics — Часть 029

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/upload/chat-media.ts`, `server/upload/post-media/` |

---

<a id="part-030"></a>
## Часть 030 — WebSocket (чаты и звонки)

**Наблюдения:** Отдельные транспорты для чата и звонков; токен в handshake для calls (см. `docs/CALLS_RELIABILITY.md`).

**Риски:** P0 — принятие соединения без валидного user. P1 — replay / устаревшие токены. P2 — утечка событий между пользователями при баге подписок.

### Metrics — Часть 030

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/calls/ws.ts`, `server/realtime/chat.ts`, `docs/CALL_REALTIME_IMPROVEMENT_PLAN.md` |

---

<a id="part-031"></a>
## Часть 031 — Rate limit и api-shield

**Наблюдения:** `server/middleware/api-shield.ts` — учёт трафика в минутных бакетах; комментарий в коде: «лимитирование отключено», `strictApiShield: false` в admin payload. Есть `recordApiTraffic429` для метрик.

**Риски:** P1 — при отключенных лимитах DoS на дорогие эндпоинты (поиск, AI). P2 — включение strict без калибровки ломает легитимных клиентов.

### Metrics — Часть 031

| Метрика | Значение |
|---------|----------|
| **Coverage** | 85% |
| **HealthScore** | 2 |
| **Risk** | P0: 0, P1: 2, P2: 1 |
| **Reliability** | Red для abuse-resilience (лимиты off) |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/middleware/api-shield.ts` |

---

<a id="part-032"></a>
## Часть 032 — Секреты и .env

**Наблюдения:** `deploy.env.example`, `docs/ENV_REFERENCE.md`, часть микросервисов с собственным `.gitignore`.

**Риски:** P0 — коммит реальных ключей. P1 — одинаковые секреты dev/prod. P2 — ротация без процесса.

### Metrics — Часть 032

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 1 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `deploy.env.example`, `docs/ENV_REFERENCE.md` |

---

<a id="part-033"></a>
## Часть 033 — SQL / Drizzle и массовые выборки

**Наблюдения:** Параметризованные запросы через Drizzle; вынесенные хелперы ILIKE-escape (`db-storage-user-like-escape.ts`).

**Риски:** P1 — тяжёлые запросы без лимита (админский поиск). P2 — N+1 в редких путях сборки DTO.

### Metrics — Часть 033

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/storage/db-storage-user-like-escape.ts`, `server/db/` |

---

<a id="part-034"></a>
## Часть 034 — XSS и пользовательский контент

**Наблюдения:** React по умолчанию экранирует текст; риск в `dangerouslySetInnerHTML`, iframe для внешнего видео по тапу (`PostExternalVideoEmbed`). Капции постов и сообщений — проверить все rich-render пути.

**Риски:** P0 — любой необработанный HTML из пользователя. P1 — open redirect в ссылках (см. auth-return whitelist как контрпример).

### Metrics — Часть 034

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 4 |
| **Risk** | P0: 0*, P1: 1 |
| **Reliability** | Green при отсутствии сырого HTML |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `client/src/components/PostExternalVideoEmbed.tsx`, `client/src/lib/auth-return-path.ts` |

---

<a id="part-035"></a>
## Часть 035 — Блокировки и приватность

**Наблюдения:** Флаги `restrict*` при блоке; фильтрация ленты и связей через storage-модули.

**Риски:** P0 — утечка контента заблокированного пользователя через кэш или EDGE. P1 — несогласованность клиент/сервер.

### Metrics — Часть 035

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/storage/db-storage-user-block-*.ts`, `features/user-blocking/` |

---

<a id="part-036"></a>
## Часть 036 — Админка и роли

**Наблюдения:** `requireAdmin` по `req.session.adminAuthenticated`; отдельный логин админа.

**Риски:** P0 — обход через прямой API если маршрут забыли защитить. P1 — слабые пароли из env на проде. P2 — аудит действий админа не везде.

### Metrics — Часть 036

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/auth/session.ts` (`requireAdmin`), `server/admin/` |

---

<a id="part-037"></a>
## Часть 037 — Пуш-токены и FCM

**Наблюдения:** Эндпоинт регистрации токена у пользователя; токен привязан к устройству.

**Риски:** P1 — подмена токена чужого userId при отсутствии проверки сессии (должно быть закрыто `requireAuth`). P2 — отзыв токена при логауте на всех устройствах.

### Metrics — Часть 037

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 1 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/users/` (push-token пути), `features/push/` |

---

<a id="part-038"></a>
## Часть 038 — Capacitor / WebView

**Наблюдения:** Гибридное приложение наследует риски WebView: `file://`, инъекции через плагины, SSL pinning (обычно не делает в Capacitor по умолчанию).

**Риски:** P1 — доверие к `postMessage` от нативного моста. P2 — mixed content при неправильном `VITE_*` origin.

### Metrics — Часть 038

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `android/`, `ios/`, `capacitor.config.*` |

---

<a id="part-039"></a>
## Часть 039 — EDGE и PARSER процессы

**Наблюдения:** Отдельные Node-процессы; межсервисная аутентификация должна быть не слабее монолита.

**Риски:** P0 — публичный порт EDGE без auth. P1 — SSRF из PARSER к внутренним URL. P2 — версионирование контрактов.

### Metrics — Часть 039

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `EDGE/server/create-app.ts`, `PARSER/`, `server/edge/` |

---

<a id="part-040"></a>
## Часть 040 — api-hub и внешние ключи

**Наблюдения:** Отдельный сервис с OAuth/OIDC, ротацией ключей (см. `api-hub/docs/EXTERNAL_SERVICE_AUTH_GUIDE.md`).

**Риски:** P0 — утечка partner secret. P1 — избыточные scope у внешних токенов.

### Metrics — Часть 040

| Метрика | Значение |
|---------|----------|
| **Coverage** | 35% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `api-hub/`, `docs/PROJECT_MAP.md` |

---

<a id="part-041"></a>
## Часть 041 — Логи и PII

**Наблюдения:** `security-audit-log` фильтрует ключи с password/token/cookie в метаданных.

**Риски:** P1 — `console.log` с телом запроса в dev, попавший в прод. P2 — структурированные логи без маскирования телефона/email.

### Metrics — Часть 041

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/security/security-audit-log.ts` |

---

<a id="part-042"></a>
## Часть 042 — Зависимости npm (CVE)

**Наблюдения:** Периодически запускать `npm audit` в `client/`, `server/` (если раздельно), корне.

**Риски:** P1 — критические CVE в express/ws/sharp и т.д. P2 — транзитивные уязвимости devDependencies.

### Metrics — Часть 042

| Метрика | Значение |
|---------|----------|
| **Coverage** | 25% |
| **HealthScore** | 3 |
| **Risk** | P0: 0*, P1: 0* (*нужен автоматический прогон) |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `package.json`, `package-lock.json` |

---

<a id="part-043"></a>
## Часть 043 — Threat modeling мессенджера

**Сценарии:** (1) Захват сессии — кража cookie, XSS. (2) MITM — только TLS + HSTS. (3) Спам/флуд — отключенный shield (ч.031). (4) Утечка метаданных звонков. (5) Злоупотребление BUSINESS webhook. (6) Загрузка вредоносного файла как «видео». (7) Социальная инженерия через service-chat.

**Итог:** Приоритет усилить rate limiting на дорогих API, периодический аудит `requireAuth`, nginx headers, мониторинг аномального трафика на WS.

### Metrics — Часть 043

| Метрика | Значение |
|---------|----------|
| **Coverage** | 60% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 3, P2: 4 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | этот документ, `docs/CALLS_RELIABILITY.md` |
