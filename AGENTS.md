# PING MOOT — контекст для агентов и разработчиков

Краткий контекст проекта, стек и план качества. Используется ИИ и командой для единого понимания продукта.

---

## Что это за продукт

Мессенджер + лента (социальный слой): чаты, голосовые/видеозвонки, посты, реакции, комментарии, сториз, профили, контакты. Веб (SPA) и нативные приложения (Capacitor: iOS/Android).

---

## Стек

| Слой | Технологии |
|------|------------|
| Клиент | React 19, TypeScript, Vite, wouter, Tailwind CSS 4, Radix UI, Framer Motion, TanStack Query |
| Сервер | Node.js, Express 5, WebSocket (ws), Drizzle ORM, PostgreSQL, сессии (connect-pg-simple) |
| Нативно | Capacitor (камера, хаптик, пуш-уведомления) |
| Деплой | VPS, PM2, nginx, скрипты в `scripts/deploy.sh`, `deploy.env` |

---

## Качество и стабильность

**Принцип:** приложение должно быть стабильным и продуманным до деталей — как продукт премиум-уровня.

- **Состояния:** у каждого экрана/списка — загрузка, успех, ошибка, пустое состояние. Не оставлять пользователя без обратной связи.
- **Единый стиль:** пустые списки — `ListEmptyState`, скелетоны — `Skeleton`, анимации — константы из `lib/motion`, учёт `prefers-reduced-motion`.
- **Обратная связь:** мгновенный визуальный отклик на тап, тост при ошибках критичных действий, хаптик на ключевые действия.
- **Код:** не глотать ошибки в критичных путях; при смене контекста сбрасывать состояние; очищать таймеры/подписки в useEffect cleanup.

**Правила Cursor:**  
- `.cursor/rules/quality-first.mdc` — всегда в контексте для клиента (принципы качества).  
- `.cursor/rules/frontend-ui.mdc` — при работе с `client/src/**/*.tsx` (паттерны, компоненты, UIX).  
- `.cursor/rules/deploy.mdc` — при изменении деплоя и .env.  
- `.cursor/rules/project-map.mdc` — при новых модулях обновлять `docs/PROJECT_MAP.md`.

**Документация:**  
- **`docs/PROJECT_MAP.md`** — полная карта проекта (client / server / shared); **при новом модуле дописать строку в этот файл в том же PR**.  
- `docs/QUALITY_CHECKLIST.md` — чеклист на каждый экран и действие.  
- `docs/UIX_SPECIALIST_GUIDE.md` — полировка, микро-взаимодействия, библиотеки.  
- `docs/UNSTABLE_OR_POORLY_WORKING.md` — что было нестабильно и что исправлено.  
- `docs/OPTIMIZATIONS.md` — что оптимизировано (code splitting, memo, chunks).  
- `docs/DEPLOY_RULES.md` — правила деплоя и DATABASE_URL.  
- **`docs/CHAT_DETAIL_RULES.md`** — при изменении страницы чата или хуков чата (ChatDetail, useChatMessages, useSendMessage, useMessageActions) обязательно читать: три хука, только `send.*` и `actions.*`, без голых переменных.
- **`docs/CALL_REALTIME_IMPROVEMENT_PLAN.md`** — план доработок звонков и общего WebSocket (onclose, stale handlers, peer factory, error vs status, вынос chat realtime). См. также `docs/CALLS_MODULE_AUDIT.md`.
- **`docs/SEED_SOCIAL_AND_FEED.md`** — почему не видно постов/сториз сидов (TTL сториз, лимит 800 постов в ленте, `--reset`, моки в UI).
- **`docs/CALLS_GROUP.md`** — групповые звонки (флаги, nginx `/group-calls`, mesh, лимиты).
- **`docs/VOSK_ASR_SETUP.md`** — бесплатный self-hosted ASR backend для титров/команд на VPS.
- **`docs/AI_SEARCH_ALGORITHM.md`** — алгоритм AI Search: инкрементальный батч, курсор, извлечение JSON, hot vs долгий профиль, L1-кеш, API.

---

## Важные пути в репозитории

- Клиент: `client/src/` — страницы (`pages/`), компоненты (`components/`), хуки (`hooks/`), API и утилиты (`lib/`).
- **Эталон UI чата PULSE (макет 1:1):** `client/src/features/chat/pulse-template/` — `DESIGN_RULES.md`, мобильные `MobileChatDark` / `MobileChatLight`, десктоп **`MessengerChatDark` / `MessengerChatLight`** (большой экран, сайдбар списка чатов). В dev: **`/dev/pulse-template`** (мобильный тёмный), **`/dev/pulse-template/desktop`** и **`/dev/pulse-template/desktop-light`** (десктоп). Продакшен-экран — `ChatDetail`; переносить из шаблона по частям, не подменять страницу целиком (см. `docs/CHAT_DETAIL_RULES.md`).
- **Профиль по макету PULSE:** `client/src/features/profile/pulse-profile/` — оболочка `PulseProfileLayout` (параллакс, сториз-кольцо, вкладки, сетка постов); страница **`UserProfile`** подключает реальные данные, посты, `StoryViewer`. Тема оболочки = глобальная из **Настроек** (`html.dark`). Эталон UI сториз (мок): `client/src/features/chat/pulse-template/MobileStoriesViewer.tsx`, dev **`/dev/pulse-template/stories`** (док: `STORIES_README.md` в той же папке).
- **ПИНГОК МИКРО (голосовой слой):** каталог `ПИНГОК МИКРО/` — `client/` (`PingokMicroOverlay`, STT, сценарии), `shared/` (типы NLU), опционально отдельный процесс. Вход в приложении: **долгое удержание центрального логотипа** в нижнем меню (`NavPulseCenterLogoButton` реэкспортируется из `@pingok-micro/…`, не подменять заглушкой «только профиль»). В оверлее: распознавание речи, parse, поиск в памяти, выдача постов ленты, напоминания/задачи/план, написание сообщения контакту, запуск звонка — см. `server/pingok-micro/` и `docs/PROJECT_MAP.md`.
- Общая схема/типы: `shared/schema/`.
- Сервер: `server/` — маршруты по доменам (auth, chats, messages, posts, calls, ws, upload и т.д.).
- Деплой и окружение: `scripts/deploy.sh`, `deploy.env.example`, `docs/DEPLOY_RULES.md`.
- **Подписки на сидов в ленту:** при деплое `scripts/run-migrations.cjs` вызывает `migrate-designated-follows.cjs` — в таблицу `follows` идемпотентно добавляются строки: кто с `public_id = 5` (Леха) и кто с телефоном `+79956012736` подписаны на всех пользователей с `phone LIKE 'seed_social_%'` (результат `seed:social-content`). Отдельный `seed:auto-follow` для этого на проде не обязателен; локально при необходимости: `node scripts/migrate-designated-follows.cjs`.
- **Тестовые пользователи + посты разом:** `npm run seed:social-fresh` (см. `docs/SEED_SOCIAL_AND_FEED.md`). Если юзеры уже есть, а постов нет: `npm run seed:social-content -- --fill-content --allow-fallback`.

---

## Как подключать внешние правила (Cursor)

Готовые наборы правил с GitHub (например [cursor-react-rules](https://github.com/Farzannajipour/cursor-react-rules)) можно скопировать в `.cursor/rules/` и адаптировать под наш стек (Vite + wouter вместо Next.js). Текущие правила в `.cursor/rules/` уже заточены под PING MOOT и приоритет качества; при добавлении чужих правил — проверять, что они не конфликтуют с `quality-first.mdc` и `frontend-ui.mdc`.
