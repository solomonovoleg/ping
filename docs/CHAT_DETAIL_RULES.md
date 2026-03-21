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

---

## 6. PULSE mobile DM (макет `pulse-template`)

Для **личного чата на мобильной ширине** (`useIsMobile`) к корневому контейнеру страницы вешаются классы **`chat-pulse-dm-mobile`** (тёмная тема) или **`chat-pulse-dm-light-mobile`** (светлая). Стили хедера и композера задаются в `client/src/index.css` под этими классами; логика **`send.*` / `actions.*`** не дублируется и не выносится в шаблонный файл.

Полосы над капсулой размечены классами **`chat-composer-meta`** (печатает / голос), **`chat-composer-strip`** (ответ, правка), **`chat-composer-strip--draft`**, **`chat-composer-recording-strip`**, **`chat-composer-spell-row`** / **`chat-composer-spell-suggestions`**. Пузыри в этом режиме — проп **`pulseMobileDm`** + **`pulseDmAccent`** у `ChatMessageRow` (текст без активного vibe), по мотивам `pulse-template` (`bubbleIn` / `bubbleOut`).

В **PULSE mobile DM** порядок композера как в `MobileChatDark.tsx`: скрепка → капсула (только поле и «!» STT) → отдельный круг **`chat-composer-video-round`** (видеокружок, иконка камеры как в макете) → микрофон/отправка. Кнопка эмодзи в строке в этом режиме скрыта (эмодзи — с клавиатуры или отдельным шагом, если вернём в UI).

Запись голоса / предпросмотр голоса / запись и превью видеокружка в этом режиме — **`PulseDmComposerMedia`** внутри `chat-composer-bar` (без старых полноэкранных модалок); отправка только через **`send.*`** (`discardVoiceRecording`, `handleMicClick`, `cancelVoicePreview`, `sendRecordedVoice`, `startVideoNoteRecording`, `stopVideoNoteRecording`, `cancelVideoNote`, `sendRecordedVideoNote`). Исходящий видеокружок в ленте при **`pulseMobileDm` + isMe** — **`PulseDmSentVideoNote`**: как `video-circle-snippet.tsx` — один тап за **320ms** переключает **140↔230** и **play/pause**, **3+ тапа** → полноэкранный оверлей с **autoplay**, дуга прогресса по `timeupdate`, кольцо **`pulse-dm-ringPulseVideo`** в compact. У успешно отправленного видеокружка футер времени/галочек перенесён в кружок (`footerLabel`), стандартный футер строки для этого случая отключается в `ChatDetail`.
