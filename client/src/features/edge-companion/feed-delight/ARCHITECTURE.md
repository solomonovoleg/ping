# EDGE feed-delight — полировка карточки в ленте

## Зачем отдельная папка

Здесь только **визуал и микро-подсказки** для блока EDGE в посте. Это **не** игровая логика:

- Уровни, XP, тапы, кулдауны — по-прежнему в `EDGE/participant`, `edge-participant.ts`, `EdgeFeedCharacterSlide` (мутации).
- Порядок экранов companion — `resolve-visible-surfaces.ts`, конфиг кампании.
- Эта папка **не** ходит в API и **не** меняет правила; можно отключать эффекты одним `prefers-reduced-motion`.

## Что внутри

| Файл | Роль |
|------|------|
| `build-swipe-hint.ts` | Чистая функция: текст подсказки «куда свайпать» из списка `visible` surfaces. |
| `EdgeFeedSwipeHintRow.tsx` | Строка под рейкой табов — только в **полноэкранном** `CompanionSurfacePager`; в ленте подсказка свайпа — полупрозрачные края в `EdgeFeedSurfacePager`. |
| `EdgeFeedCardEntrance.tsx` | Разовое появление карточки при входе во вьюпорт (`whileInView`, `once`). |

Стили ауры персонажа и акцента CTA — в `client/src/index.css` (классы `edge-feed-*`). **Аура и покачивание иконки подарка** намеренно только при `EdgeFeedCharacterSlide variant="feed"` (карточка в ленте), полный companion без этого шума.

## Куда не лезем

- Нет счётчиков «N игроков», лайв-статистики и т.п. (соцдоказательства).
- Нет дублирования `hasStartedEdgePlay` / бизнес-правил — акцент на CTA читается из `EdgeCompanionFeedHero` и передаётся только как «включить визуальный акцент».

## Расширение

Новые эффекты поста EDGE — сюда же или новый файл в `feed-delight/`, плюс строка в `docs/PROJECT_MAP.md`.
