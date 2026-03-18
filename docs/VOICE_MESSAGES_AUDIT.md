# Аудит: голосовые сообщения (запись, хранение, воспроизведение)

## Цепочка работы ГС

1. **Запись** — `useVoiceRecorder` (MediaRecorder API): webm/opus в Chrome, часто audio/mp4 в Safari.
2. **Отправка** — `useSendMessage.handleMicClick` → `uploadVoice(blob)` → `sendMessage(chatId, { type: "voice", content: url })`.
3. **Сервер** — `POST /api/upload/voice` (multer, поле `audio`), затем `POST /api/chats/:chatId/messages` с `type: "voice"`, `content: "/uploads/voice/xxx.webm"` (или URL из S3).
4. **Хранение** — в БД/памяти: `messages.content` = URL (относительный или полный от S3).
5. **Загрузка** — `GET /api/chats/:chatId/messages` или `dm-by-public-id` возвращают сообщения с `type: "voice"`, `content: "<url>"`.
6. **Отображение** — `ChatMessageRow`: для `msg.type === "voice"` рендерится `VoiceMessagePlayer`, `src = resolveUrl(msg.content)`.
7. **Воспроизведение** — `VoiceMessagePlayer`: при первом нажатии Play подставляется `src` в `<audio>`, затем `play()`.

## Исправленные проблемы

### 1. Safari / iOS: неверное расширение файла
- **Было:** клиент всегда отправлял имя `voice.webm`; Safari записывает в audio/mp4 → файл сохранялся как .webm с содержимым mp4 → плеер не воспроизводил.
- **Стало:** в `uploadVoice` расширение выбирается по `blob.type` (`.m4a` для mp4, `.ogg`, `.webm` и т.д.). На сервере в multer и при отдаче S3 используется это расширение; при отсутствии расширения выставляется .m4a для mp4, иначе .webm.

### 2. Неверное воспроизведение при смене сообщения
- **Было:** при смене `src` (другое сообщение в том же компоненте) ref сбрасывался, но у `<audio>` оставался старый `src` → при Play мог играть предыдущее голосовое.
- **Стало:** в `useEffect([src])` у плеера: сбрасываем состояние (loaded, duration, currentTime, playing, loadError), вызываем `el.removeAttribute("src")` и `el.load()`. При следующем Play подставляется актуальный `src`.

### 3. Защита от пустого content
- В `ChatMessageRow` для голосовых проверяется `typeof msg.content === "string"` и `trim()`; при пустом или нестроковом `content` показывается «Голосовое сообщение (недоступно)».

## Важные файлы

| Роль | Файл |
|------|------|
| Запись | `client/src/hooks/useVoiceRecorder.ts` |
| Отправка / upload | `client/src/features/chat/hooks/useSendMessage.ts`, `client/src/lib/chat.ts` (uploadVoice) |
| Сервер: приём файла | `server/upload/voice.ts` |
| Сервер: сохранение сообщения | `server/messages/routes.ts` (POST messages), storage |
| Отображение | `client/src/features/chat/components/ChatMessageRow.tsx` |
| Плеер | `client/src/components/VoiceMessagePlayer.tsx` |
| URL для медиа | `client/src/lib/api-base.ts` (resolveUrl), сервер `app.use("/uploads", express.static(...))` в `server/routes.ts` |

## Рекомендации

- **Тесты:** проверять голосовые в Safari/iOS и Chrome; смена чата/скролл и повторное открытие одного чата (разные сообщения в одном списке).
- **Сеть:** при открытии с другого домена (или из нативного приложения) `resolveUrl` использует `API_BASE`; нужен CORS для `/uploads` (уже выдан `Access-Control-Allow-Origin: *` в `server/routes.ts`).
- **S3:** при включённом S3 URL в `content` — полный от S3; `resolveUrl` для `http*` возвращает его как есть.
