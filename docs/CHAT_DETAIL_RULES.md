# Правила страницы чата (ChatDetail) — чтобы чат не ломался

При любом изменении `client/src/pages/ChatDetail.tsx` или хуков из `client/src/features/chat/hooks/` соблюдай этот контракт.

---

## 1. Три хука — один источник правды

Страница чата **обязательно** вызывает три хука в таком порядке:

| Хук | Переменная | Ответственность |
|-----|------------|------------------|
| `useChatMessages` | — | Загрузка чата и сообщений, скролл, подписки (новые сообщения, печатает, голос), `loading` / `error` |
| `useSendMessage` | **`send`** | Поле ввода, отправка, редактирование, ответ, вложения, голосовые |
| `useMessageActions` | **`actions`** | Меню по long-press, реакции, копировать, удалить, переслать, избранное, выбор сообщений |

- **Не удаляй** вызов любого из этих хуков и не меняй порядок (от `send` зависит `onEdit` в `actions`).
- **Не используй** «голые» переменные вроде `editingId`, `message`, `setMessage`, `setMessageMenu` — они живут внутри хуков. В JSX и колбэках всегда пиши **`send.…`** или **`actions.…`** (например `send.editingId`, `send.setMessage`, `actions.closeMenu()`).

---

## 2. Именование в коде

- Всё, что связано с **вводом и отправкой** (текст, редактирование, ответ, вложения, голос) — только через **`send`**:  
  `send.message`, `send.editingId`, `send.setMessage`, `send.handleSend`, `send.replyingTo` и т.д.
- Всё, что связано с **меню сообщения и действиями над сообщениями** — только через **`actions`**:  
  `actions.messageMenu`, `actions.setMessageMenu`, `actions.selectedIds`, `actions.handleForward`, `actions.handleMessagePointerDown` и т.д.

Так при рефакторинге сразу видно источник данных, и TypeScript подсветит ошибку, если `send` или `actions` не объявлены.

---

## 3. Загрузка и ошибки

- В `useChatMessages` на **каждой** ветке, где выставляется `setError(...)`, обязательно вызывай **`setLoading(false)`**, иначе экран зависнет в скелетоне.
- В ChatDetail при долгой загрузке (например после 20 с) показывается подсказка и кнопка «Повторить» — не удаляй этот таймаут и вызов `loadChatAndMessages()`.

---

## 4. Черновик (draft)

- Восстановление черновика при открытии чата идёт через **ref** (`sendDraftRef`), потому что `send` создаётся после `useChatMessages`, а колбэк `onDraftRestore` вызывается из хука. Не заменяй это на прямой вызов `send.setMessage` в колбэке (будет обращение к несуществующему `send`).

---

## 5. Перед коммитом

- [ ] В ChatDetail все обращения к состоянию/хендлерам отправки и меню идут через `send.*` и `actions.*`.
- [ ] Нет голых `editingId`, `message`, `setMessage`, `setMessageMenu` и т.п. в JSX или эффектах.
- [ ] В `useChatMessages` у каждой ветки с `setError` есть `setLoading(false)`.

Если править хуки (`useSendMessage`, `useMessageActions`, `useChatMessages`) — после правок проверь, что ChatDetail по-прежнему использует только возвращаемые ими объекты и не опирается на внутренние переменные хуков.
