# План улучшений: звонки + realtime WebSocket

План опирается на разбор текущей реализации (`useCall`, `useRealtimeSocket`, `useCallSignaling`, `useWebRtcPeer`) и описывает, **что уже хорошо**, **какие риски есть** и **в каком порядке чинить**.

---

## Что уже хорошо

- Нормальная **state-модель звонка** (`idle` → `calling` / `ringing` / `connecting` → `in-call`, плюс `failed`).
- **Fallback для `getUserMedia`** — правильно для iOS / Safari / WebView.
- Защита от **раннего offer / ICE** (`pendingOfferRef`, `pendingIceRef`, ожидание стрима).
- **`cleanup`** и отдельный **`cleanupPeerOnly`** (медиа/peer vs полный сброс).
- **Retry / reconnect** для сокета и фоновые попытки токена.
- Разделение **входящего / исходящего** сценария.
- После мини-рефакторинга: вынесены **`useRealtimeSocket`**, **`useCallSignaling`**, **`useWebRtcPeer`** — оркестрация в `useCall`.

---

## Проблемы и направления решений

### 1. Самая опасная: `ws.onclose` всегда вызывает `endCall()`

**Суть:** тот же сокет обслуживает **чаты** и **звонки**. При любом обрыве сокета вызывается полный call-cleanup и тост «Соединение прервано», даже если звонка не было. При переподключении во время переходов возможен **ложный** `endCall`.

**Плохо:** проверять `state` прямо в `onclose` — **stale closure**.

**Лучше:** завести **`callActiveRef`**, синхронизировать с реальным активным звонком через `useEffect` (или обновлять в тех же местах, где меняется «есть ли активный звонок»):

```ts
// Идея: true только для calling | ringing | connecting | in-call
callActiveRef.current = ["calling", "ringing", "connecting", "in-call"].includes(state);
```

В `onclose`:

- если **`!callActiveRef.current`** — не вызывать `endCall`, только `scheduleReconnect` (и не показывать тост про звонок);
- если активен звонок — `endCall({ connectionLost: true, notifyPeer: false })` + reconnect.

**Файлы:** `useRealtimeSocket.ts` (или тонкий колбэк из `useCall`, который читает только ref).

---

### 2. Stale closures: `attachWsHandlers` vs `ensureOpenWs`

**Суть:** если где-то вешается **прямой** вызов `attachWsHandlers(socket)`, а не **`attachWsHandlersRef.current(socket)`**, новый сокет может получить **старую** версию замыканий (`endCall`, `cleanup`, `sendSignal`, …).

**Лучше:** **одна точка входа** — всегда `attachWsHandlersRef.current(socket)` при открытии сокета (и в фоновом `connect`, и в `ensureOpenWs`).

**Файлы:** `useRealtimeSocket.ts`.

---

### 3. Утечка listener `connectionstatechange` на `RTCPeerConnection`

**Суть:** `addEventListener` без гарантированного `removeEventListener`; опора на `peer.destroy()` как побочный эффект — на Safari / WebView нежелательна.

**Лучше:** хранить **`detachConnectionStateRef`** (или возвращать `unsubscribe` из хелпера), при новом peer — снимать старый listener, в **`cleanup` / `cleanupPeerOnly`** — явно отписываться.

**Файлы:** `useWebRtcPeer.ts`.

---

### 4. `closeWs()` → `onclose` → `endCall()` — смешение «намеренное закрытие» и «обрыв»

**Суть:** при unmount / явном закрытии сокета срабатывает тот же `onclose`, что и при сетевом обрыве → риск ложного «соединение потеряно» и лишней call-логики.

**Лучше:** флаг **`isIntentionalWsCloseRef`**: перед `close()` ставить `true`, в `onclose` читать и сбрасывать; при intentional — **не** звать `endCall` из-за чата, только очистить ref сокета и при необходимости не показывать тост.

**Согласование с п.1:** при intentional close без активного звонка — только закрытие; при активном звонке политика продуктовая (завершать звонок или нет — зафиксировать в коде явно).

**Файлы:** `useRealtimeSocket.ts`, при необходимости колбэк из `useCall`.

---

### 5. Дублирование создания `SimplePeer` (4+ похожих блока)

**Суть:** одинаковая связка `signal` / `connect` / `stream` / `error` / `close` в `runOutgoingCall`, `acceptCall`, обработчике `offer` в `onmessage`, ветке «offer пришёл после getUserMedia». Любой фикс нужно дублировать → риск рассинхрона.

**Лучше:** одна **фабрика** в `useWebRtcPeer` (уже есть `createPeer` с `PeerEvents`) — **все** сценарии только через неё; в `useCall` не размножать обработчики вручную.

**Файлы:** `useWebRtcPeer.ts`, упростить `useCall.ts`.

---

### 6. `pendingOfferRef`: непоследовательный сброс

**Суть:** где-то `pendingOfferRef.current = null`, где-то нет после успешного применения offer → риск повторной обработки старого SDP при гонках / reconnect.

**Правило:** после **успешного** `peer.signal(offer)` и применения накопленного ICE — **в одном месте** обнулять `pendingOfferRef` (и документировать это правило в комментарии у ref).

**Файлы:** `useCall.ts`.

---

### 7. `target-offline` vs `target-waiting` и одна переменная `error`

**Суть:** «Абонент не в сети, пробуем дозвон…» — **процессный статус**, а не ошибка; смешение с настоящими ошибками ломает UI (красный текст vs идущий звонок).

**Лучше:** разделить минимум на:

- **`error`** — реальная ошибка (permission, ICE, таймаут без надежды и т.д.);
- **`statusText`** (или `callStatusMessage`) — нейтральное/информационное сообщение для `calling` (waiting, offline retry).

**Файлы:** `useCall.ts`, `CallModal.tsx`, при необходимости тип контекста.

---

### 8. `setState("idle")` после ошибок vs состояние `"failed"`

**Суть:** после части ошибок остаётся `error`, но state уже `idle` — UI не знает, показывать ли retry; `"failed"` введён, но используется не везде.

**Лучше:** единая политика: если процесс звонка **уже шёл** и провалился (медиа, WS, offer timeout, peer error) — **`failed`** + `error` + сохранённые refs для **`retryCall`**. `idle` — когда пользователь явно вышел или отклонил.

**Файлы:** `useCall.ts`, `CallModal.tsx`.

---

### 9. Chat realtime всё ещё «рядом» с транспортом звонков

**Суть:** баг в переподключении чата может «убить» звонок из-за общего `onclose` / общей модели (см. п.1). Архитектурно транспорт один, но **обработчики** лучше разнести.

**Лучше (этап 2):** выделить **`useChatRealtime(transport)`** или подписки чата в отдельном модуле, который получает **только** API сокета (`send`, `onMessage` с фильтром по типам). `useCall` не должен знать про `typing` / `voice-recording` — только брать transport из контекста.

**Файлы:** новый хук/модуль + `CallContext` / провайдер realtime.

---

### 10. Риск двойного `call-accept` при гонке offer / getUserMedia

**Суть:** ветка «offer уже есть» и «ждём offer» опирается на `acceptingWaitingOfferRef` + флаги — хрупко.

**Лучше:** явная **стадия принятия**: например  
`AcceptPhase = "none" | "waiting-offer" | "getting-media" | "creating-peer" | "accepted"`  
и **инвариант**: `call-accept` отправляется ровно один раз на сессию принятия (guard в одном месте).

**Файлы:** `useCall.ts`.

---

### 11. `cleanup()` слишком грубый для сценариев retry

**Суть:** нужны разные уровни: только медиа/peer, только handshake, полный сброс сессии — чтобы **`retryCall`** стабильно знал `otherUserId` / `chatId` / `isVideo`.

**Лучше:** явно разделить (имена условные):

- `resetMediaAndPeer()`
- `resetIncomingHandshake()`
- `resetCallSessionMeta()`

и вызывать комбинации в `endCall` / `failed` / `reject` по таблице.

**Файлы:** `useCall.ts`.

---

### 12. Мелочь: неиспользуемый `_otherName` в `runOutgoingCall`

**Суть:** параметр есть, не используется — путает читателя («забыли в UI/сигналинг?»).

**Лучше:** либо использовать (если нужен для отображения/логов), либо убрать из сигнатуры и всех вызовов.

**Файлы:** `useCall.ts`, вызовы `startCall` / `retryCall`.

---

## Жёсткий порядок внедрения (без философии)

1. **Защитить `ws.onclose`** — не убивать call state при reconnect чатов (`callActiveRef` + при п.4 intentional close).
2. **Единая точка `attachWsHandlersRef.current(socket)`** в `ensureOpenWs` и фоновом connect.
3. **Фабрика peer** — все сценарии через один `createPeer` / фабрику в `useWebRtcPeer` (убрать копипасту в `useCall`).
4. **Разделить `error` и процессный статус** (`statusText` / `callStatusMessage`).
5. **`callActiveRef`** (если не сделан в шаге 1 полностью) — довести синхронизацию со state machine.
6. **Отделить chat realtime от call hook** — отдельный слой подписок на том же transport (этап архитектуры).
7. Параллельно второстепенно: **detach `connectionstatechange`**, **pendingOffer сброс**, **`AcceptPhase`**, **трёхуровневый cleanup**, **политика `failed` vs `idle`**, **убрать `_otherName` или использовать**.

---

## Связанные документы

- `docs/CALLS_MODULE_AUDIT.md` — прежний аудит модуля звонков.
- `docs/CHAT_DETAIL_RULES.md` — при изменении хуков чата и страницы чата.
- Хуки: `client/src/hooks/useCall.ts`, `useRealtimeSocket.ts`, `useCallSignaling.ts`, `useWebRtcPeer.ts`.

После внедрения пунктов 1–4 имеет смысл обновить **`docs/CALLS_MODULE_AUDIT.md`** и **`docs/UNSTABLE_OR_POORLY_WORKING.md`** (если есть регрессии/фиксы).
