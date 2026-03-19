# PING MOOT — архитектурный индекс

Этот файл теперь служит входной точкой в архитектурную документацию.

## Основные документы

- `docs/ARCHITECTURE_CURRENT.md` — актуальная архитектура, слои, потоки данных, правила структуры
- `docs/DEV_HANDOFF_CURSOR.md` — handoff для параллельной работы разработчиков в Cursor
- `docs/AI_HANDOFF_ARCHITECTURE.md` — handoff и правила продолжения рефактора для ИИ-агента

## Документы по качеству UI и стабильности

- `docs/QUALITY_CHECKLIST.md` — обязательный checklist перед merge UI-изменений
- `docs/UIX_SPECIALIST_GUIDE.md` — паттерны полировки UI/UX
- `docs/CHAT_DETAIL_RULES.md` — правила для изменений в chat-detail и chat hooks
- `docs/OPTIMIZATIONS.md` — уже выполненные оптимизации и ориентиры

## Правила ведения документации

- после заметного архитектурного изменения обновлять `docs/ARCHITECTURE_CURRENT.md`
- при изменении контекста параллельной работы обновлять `docs/DEV_HANDOFF_CURSOR.md`
- при изменении архитектурных ограничений для агента обновлять `docs/AI_HANDOFF_ARCHITECTURE.md`
- не хранить устаревшие "планы будущего" как текущую архитектуру; текущая архитектура фиксируется по факту кода

## Правила ведения папок

- `client/src/pages/*` — только page-shell orchestration
- `client/src/features/*` — доменная экранная логика
- `client/src/components/*` — переиспользуемый UI
- `server/<domain>/routes.ts` — thin HTTP layer
- `server/<domain>/service.ts`, `repository.ts`, `serializers.ts` — доменные слои рядом с routes
- `shared/*` — только общие контракты/типы/схемы без runtime-логики
