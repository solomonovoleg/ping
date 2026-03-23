# Звонки 1:1 — краевые случаи (как устроено сейчас)

Краткий разбор вопросов «как в лучших мессенджерах»: дубли, одновременный набор, обрыв, перезагрузка. Детали сигналинга и инварианты — `docs/CALLS_RELIABILITY.md`.

---

## 0. Красная кнопка — явное завершение

Локальный **сброс** (`hangup` / отмена исходящего): `endCallInternal(..., { immediateIdle: true })` — сразу `cleanupFull()` → состояние `idle`, модалка закрывается, **отменяется** отложенный `resume-check`, сбрасывается `statusText` («восстановление…»). Иначе после закрытия звонка открытый заново WS мог слать `resume-check`, а в снапшоте оставался текст reconnect.

Удалённый `call.hungup` / `call.canceled` — по-прежнему короткий экран «завершён» (3 с), затем idle.

---

## 1. Дублирование WebSocket / «двойные вебхуки»

| Что | Как сделано |
|-----|-------------|
| Сокет | По умолчанию **multi-socket** (вкладки/девайсы не выбивают друг друга), single-socket только флагом `CALLS_SINGLE_SOCKET_PER_USER=1`. Для call-событий действует call-route binding (`userId+callId -> ws`) в `server/calls/ws.ts`. |
| Обработчик сообщений звонка | В `callMessageHandlerRef.current` записывается **один** колбэк из `useCallStore` (зависимость `realtime.callMessageHandlerRef` — стабильный ref-объект, эффект по сути один раз на монтирование). |
| `onopen` / `onclose` | Вешаются **один раз** на экземпляр `WebSocket` в `attachWsHandlers`; при замене сокета старый не обнуляет ref чужого закрытия. |
| Anti-storm | На клиенте в `RealtimeSocketTransport` есть backoff + jitter + circuit breaker при частых быстрых reconnect. |

Итого: **нет** второго параллельного подписчика на те же события; дубли сигналов лечатся политикой «один сокет» и очередью сообщений на сервере.

---

## 2. Оба набрали друг друга почти одновременно (glare)

| Этап | Поведение |
|------|-----------|
| До `await` в `call.invite` | Если ты уже **callee** входящего от этого же контакта — ответ `glare_use_incoming` + повтор `call.incoming` на существующий `callId` (клиент: `mergeOutgoingGlareToIncoming`). |
| После `await` (гонка) | Добавлено **`findRingingSessionBetween`** сразу перед `createSession`: если между этой парой уже есть **ringing**, не создаём вторую сессию — либо повторно шлём входящее тому, кто callee, либо glare инициатору второго invite. |

Итог: стремимся к **одной** сессии на пару в фазе звонка, без «сиротских» записей в памяти.

---

## 3. Взял трубку — пропала связь

| Слой | Поведение |
|------|-----------|
| **WebSocket** | При закрытии сокета — таймер `CALLS_DISCONNECT_GRACE_MS` (по умолчанию 25 с): если за это время сокет не восстановился, сессия завершается, второй получает `call.hungup`. |
| **Клиент при обрыве WS** | `onTransportDisconnected` → UI `reconnecting`, `call.resume-check` после восстановления WS. |
| **WebRTC** | `connectionstatechange`: `disconnected`/`failed` → таймауты, тосты, завершение по политике в `call-controller`. |

Если медиа держится, а WS поднялся — `syncCallUiWithPeerIfStable` может вернуть `connected` без лишнего renegotiate.

---

## 4. Закрыл страницу / приложение и открыл снова

| Сценарий | Поведение |
|----------|-----------|
| Звонок ещё **ringing** на сервере | Новый WS → при необходимости сервер шлёт картину звонка; клиент при `resume-available` с `sessionState: ringing` и `idle` может снова показать **входящий** (`handleResumeAvailable`). |
| Звонок **уже в разговоре** | `call.resume-check` → `call.resume-available` с `shouldInitiateOffer` / `sessionState`; контроллер поднимает peer и договаривается заново (исходящий — offer). |
| Сессия уже снята grace-таймером | `resume-check` без сессии — тихо, без паники (лог на сервере). |

Ограничение: полное закрытие вкладки **сбрасывает** локальный WebRTC — восстановление идёт через **новый** signaling + renegotiation, а не «магическое» продолжение старого peer.

---

## 5. Что ещё можно довести до «идеала» (бэклог)

- **Единый mutex** на пару `(userA, userB)` на всю длину `call.invite` (включая первые await) — если появятся редкие гонки до текущего барьера.
- **callActiveRef** в realtime: не считать любой обрыв WS концом звонка, если звонка не было (см. `CALL_REALTIME_IMPROVEMENT_PLAN.md`).
- Метрики/алерты: счётчик `resume-check` miss, длительность до `connected`, процент failed ICE + пороги предупреждений в мониторинге.

---

## Связанные файлы

- `server/calls/ws.ts` — invite, grace, `messageChain`
- `server/calls/session.ts` — `findRingingSessionBetween`, сессии
- `client/src/features/call/call-controller.ts` — glare UI, resume, reconnect
- `client/src/lib/realtime-socket-transport.ts` — один WS
- `client/src/features/call/useCallStore.ts` — привязка `callMessageHandlerRef`
