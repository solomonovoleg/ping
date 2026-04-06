# EDGE MONEY — баллы за сообщения в диалогах (модуль-план)

Папка **документации** модуля: продукт, платформа, EDGE, тесты и выкат. Реализация кода — отдельно (ориентиры путей в блоке 4).

**Правило размера:** каждый файл в этой папке — **не более 250 строк**; при написании кода модуля придерживаться того же лимита на файл и выносить подмодули в подпапки.

## Состав (4 блока)

| Файл | Содержание |
|------|------------|
| [01-product-and-config.md](./01-product-and-config.md) | ТЗ, семантика «диалог», поля правила, админка, парсинг конфига |
| [02-platform-counters-and-hook.md](./02-platform-counters-and-hook.md) | Таблица счётчиков, хук отправки сообщения, фильтры чата, гонки |
| [03-edge-events-and-grants.md](./03-edge-events-and-grants.md) | Событие в EDGE, `task_key`, `ref_key`, дневной потолок, заморозка |
| [04-tests-rollout-code-map.md](./04-tests-rollout-code-map.md) | Тесты, фазы внедрения, карта будущих файлов, открытые решения |

## Связанные документы

- `docs/EDGE_MONEY_ARCHITECTURE.md` — общие роли платформы / EDGE MONEY.
- `docs/EDGE_MONEY_INVITE_FOUR_BLOCKS.md` — эталон разбиения смежного модуля (приглашения).
- Типы правил: `EDGE/money/types/money-config.ts`, карточки борда: `client/src/lib/edge-money-wizard.ts`.

## Статус

**Реализовано:** платформа (`server/edge-money-chat-messages/`, миграция счётчиков), EDGE (`chat-accrual-targets`, `chat_messages_milestone`, лимит за сутки UTC), борд (`maxPointsPerDay` для «Сообщения в чате»). Участник должен быть в `edge_participants`; порог и лимит — из конфига кампании.
