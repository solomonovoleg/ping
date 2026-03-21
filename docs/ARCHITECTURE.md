# PING MOOT — архитектурный индекс

## Главная карта проекта

**`docs/PROJECT_MAP.md`** — единый документ: полная карта репозитория (client / server / shared), таблицы модулей, слои, потоки, куда класть новый код.

**Правило:** при добавлении нового модуля или заметной папки — **в том же PR** дописать строку в `PROJECT_MAP.md` (таблицы и/или раздел «Журнал модулей»).

---

## Остальная документация

- `docs/DEV_HANDOFF_CURSOR.md` — handoff для параллельной работы разработчиков в Cursor
- `docs/AI_HANDOFF_ARCHITECTURE.md` — handoff и правила продолжения рефактора для ИИ-агента
- `docs/ARCHITECTURE_CURRENT.md` — перенаправление на `PROJECT_MAP.md` (старые ссылки)

### Качество UI и стабильность

- `docs/QUALITY_CHECKLIST.md` — checklist перед merge UI-изменений
- `docs/UIX_SPECIALIST_GUIDE.md` — паттерны полировки UI/UX
- `docs/CHAT_DETAIL_RULES.md` — правила для chat-detail и chat hooks
- `docs/OPTIMIZATIONS.md` — выполненные оптимизации

### Ведение документации

- заметная смена структуры → обновить **`docs/PROJECT_MAP.md`**
- смена контекста handoff → `docs/DEV_HANDOFF_CURSOR.md` / `docs/AI_HANDOFF_ARCHITECTURE.md`
- не хранить устаревшие «планы» как текущую архитектуру

### Правила папок (кратко)

- `client/src/pages/*` — только page-shell orchestration
- `client/src/features/*` — доменная экранная логика
- `client/src/components/*` — переиспользуемый UI
- `server/<domain>/routes.ts` — thin HTTP layer
- `server/<domain>/service.ts`, `repository.ts`, `serializers.ts` — доменные слои рядом с routes
- `shared/*` — только общие контракты/типы/схемы без runtime-логики приложения
