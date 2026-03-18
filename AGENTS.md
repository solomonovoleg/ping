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

**Документация:**  
- `docs/QUALITY_CHECKLIST.md` — чеклист на каждый экран и действие.  
- `docs/UIX_SPECIALIST_GUIDE.md` — полировка, микро-взаимодействия, библиотеки.  
- `docs/UNSTABLE_OR_POORLY_WORKING.md` — что было нестабильно и что исправлено.  
- `docs/OPTIMIZATIONS.md` — что оптимизировано (code splitting, memo, chunks).  
- `docs/DEPLOY_RULES.md` — правила деплоя и DATABASE_URL.  
- **`docs/CHAT_DETAIL_RULES.md`** — при изменении страницы чата или хуков чата (ChatDetail, useChatMessages, useSendMessage, useMessageActions) обязательно читать: три хука, только `send.*` и `actions.*`, без голых переменных.

---

## Важные пути в репозитории

- Клиент: `client/src/` — страницы (`pages/`), компоненты (`components/`), хуки (`hooks/`), API и утилиты (`lib/`).
- Общая схема/типы: `shared/schema/`.
- Сервер: `server/` — маршруты по доменам (auth, chats, messages, posts, calls, ws, upload и т.д.).
- Деплой и окружение: `scripts/deploy.sh`, `deploy.env.example`, `docs/DEPLOY_RULES.md`.

---

## Как подключать внешние правила (Cursor)

Готовые наборы правил с GitHub (например [cursor-react-rules](https://github.com/Farzannajipour/cursor-react-rules)) можно скопировать в `.cursor/rules/` и адаптировать под наш стек (Vite + wouter вместо Next.js). Текущие правила в `.cursor/rules/` уже заточены под PING MOOT и приоритет качества; при добавлении чужих правил — проверять, что они не конфликтуют с `quality-first.mdc` и `frontend-ui.mdc`.
