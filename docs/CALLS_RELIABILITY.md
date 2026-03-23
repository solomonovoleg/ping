# Надёжность звонков 1:1 — инварианты и чеклист

Документ фиксирует **причины срыва** сигналинга/WebRTC и **правила**, чтобы регрессии не повторялись. **Краевые сценарии** (дубли WS, glare, обрыв, перезагрузка) — `docs/CALLS_EDGE_CASES.md`. Детальный план рефакторинга общего realtime — `docs/CALL_REALTIME_IMPROVEMENT_PLAN.md`; TURN — `docs/CALLS_TURN_SETUP.md`, env — `docs/ENV_REFERENCE.md`.

---

## 1. Что ломает звонки (по убыванию «часто в проде»)

| Риск | Симптом | Где лечится |
|------|---------|-------------|
| **Два WebSocket `/calls` у одного пользователя** | `call.accept` / отмена уходит «не тому» сокету; второй таб/переподключение съедает сессию | Сервер: `closeExistingCallSocketsForUser` в `server/calls/ws.ts` перед `add(ws)`. Клиент: один транспорт, закрытие предыдущего сокета перед новым; в `onclose` не сбрасывать `wsRef`, если закрылся **не** текущий экземпляр (`client/src/lib/realtime-socket-transport.ts`). |
| **Параллельная обработка `message` на одном WS** | `call.invite` с `await` к БД ещё не создал сессию, а следующий кадр уже `call.offer` / ICE → `getSession` пустой, SDP **молча теряется** | Сервер: **очередь на сокет** (`messageChain` в `server/calls/ws.ts`) — каждое входящее сообщение ждёт завершения предыдущего. Библиотека `ws` **не await’ит** `async`-обработчик. |
| **Неверный порядок на принимающей стороне** | Offer/ICE применены до готовности `RTCPeerConnection` и медиа → таймаут, `failed` | `client/src/features/call/call-controller.ts`: сначала `ensurePeer` (медиа + PC), затем `call.accept`, затем `applyPendingOfferAndIce`; при ошибке до accept — `reject`, после accept — `hangup`. |
| **Нет TURN / неверные креды** | Работает в одной сети, «зависает» через NAT/мобильный интернет | `VITE_TURN_*` в бандле, coturn на VPS, проверка `scripts/pre-deploy-check.sh` и `docs/CALLS_TURN_SETUP.md`. |
| **Обрыв WS во время звонка** | Ложный конец звонка или зависание без ICE | FSM + resume (`call-state-machine.ts`, обработка `resume-available`); не дублировать «хвостовые» обработчики на старом сокете. |
| **Nginx / прокси** | Обрыв долгих WS | Таймауты `proxy_read_timeout` / `proxy_send_timeout` для upgrade (см. деплой-гайды про звонки). |

---

## 2. Инварианты (считать контрактом)

1. **Один активный сокет сигналинга звонков на пользователя** на сервере (политика: последнее подключение выигрывает; старое закрывается с понятным кодом/логом).
2. **На клиенте** для пути звонков — один актуальный `WebSocket` в ref; закрытие старого экземпляра не должно обнулять ref нового.
3. **Accept после готовности peer**: не вызывать серверный accept до локальной готовности к приёму SDP/ICE (иначе гонка с инициатором).
4. **ICE servers** в клиенте совпадают с тем, что реально доступно с устройств пользователя (STUN+TURN в проде).
5. **Сообщения по одному `/calls` сокету** обрабатываются **строго по очереди** на сервере (после любого `await` внутри обработчика следующий JSON не стартует, пока не завершится предыдущий шаг цепочки).

---

## 3. Наблюдаемость (быстрая диагностика)

- Логи сервера `/calls`: при подозрении на дубликаты смотреть метрики/логи с **количеством сокетов на `userId`** (после фикса — **1** при одном клиентском подключении).
- Клиент: последовательность `resume-check` → `resume-available` → переходы FSM; лишние циклы — проверить cooldown/debounce и незакрытые старые сокеты.
- WebRTC: `connectionState` / `iceConnectionState` в devtools (Chrome `webrtc-internals`).
- Сервер: `call.state-transition` и `ws closed` в `server/calls/ws.ts` (единый структурный формат для парсинга логов).
- Админка: `GET /api/admin/dashboard/analytics` содержит `callsReliability`:
  - `callStateTransition.total|toConnected|toEnded|toMissed|toFailed`
  - `wsReconnectReason.normal|abnormal_or_network|superseded|policy_or_auth|other`
- Клиент transport: `[realtime] /calls ws closed` + `reconnect circuit breaker enabled` — ранний сигнал reconnect-штормов.

---

## 4. Чеклист перед релизом / после правок звонков

- [ ] На сервере при новом handshake `/calls` закрывается предыдущий сокет этого пользователя.
- [ ] Клиент при открытии нового сокета закрывает предыдущий (OPEN/CONNECTING).
- [ ] В `onclose` сравнение «это тот же инстанс, что в ref» перед disconnect/gлобальным сбросом.
- [ ] Порядок accept / offer / ICE на callee не нарушен.
- [ ] На сервере для `/calls` сохранена **сериализация** обработки `message` (регресс: снова `async` без очереди → потеря offer).
- [ ] В прод-бандле есть TURN (или осознанный режим только STUN для dev).
- [ ] Прогнать сценарий: **два таба** — ожидаемо один «живой» сигналинг; второй не должен оставлять «тихий» мёртвый сокет на сервере.
- [ ] Прогнать **reload** во время `ringing` / `connecting` — восстановление или чистый отказ без залипания UI.
- [ ] Проверить, что дубликаты `call.hangup`/`call.cancel` не меняют состояние второй раз (идемпотентный `endSession`).
- [ ] Проверить, что `call.canceled` во входящем дозвоне даёт у принимающего **пропущенный**, а не «завершён».
- [ ] Проверить, что при `RTCPeerConnectionState === connected` UI не показывает reconnect-баннер.

---

## 5. Флаги и канареечный rollout

- Флаг server policy:
  - `CALLS_SINGLE_SOCKET_PER_USER=1` — строгий single-socket режим (для controlled canary).
  - по умолчанию — multi-socket с call-route binding (активный call-context получает сигналинг таргетированно).
- Канареечный план:
  1. **Canary (5-10%)**: включить флаг для ограниченной группы/инстанса.
  2. **20%**: если нет роста `wsReconnectReason.abnormal_or_network` и `toFailed`.
  3. **50%**: при стабильной доле `toConnected / total` и без жалоб на redial.
  4. **100%**: после 24ч без регрессий по hangup/redial.
- Критерии rollback (без отката деплоя):
  - резкий рост `toFailed` или повторяющиеся reconnect-штормы;
  - жалобы на `already_in_call` после ручного `hangup`;
  - деградация сценария `hangup -> redial`.
- Быстрый rollback: вернуть флаг/конфиг и перезапустить процесс, код трогать не нужно.

---

## 6. Видеозвонки (тот же сигналинг, другие треки)

От аудио отличается только клиент:

| Шаг | Поведение |
|-----|-----------|
| Исходящий | `ensurePeer("video")` → `getUserMedia` audio+video (несколько fallback-ограничений в `webrtc-peer.ts`) → `call.invite` с `mediaType: "video"` → `createOffer` → `call.offer`. |
| Входящий | Буфер `call.offer` / ICE до `accept` → `ensurePeer` по `incoming.mediaType` → `call.accept` → `applyPendingOfferAndIce`. |
| SDP | `transformSdp` — приоритет **Opus** + **H264** (важно для Safari/iOS). |
| Сервер | Тот же `messageChain` на `/calls`, тот же relay `offer` / `answer` / `ice-candidate`; в сессии хранится `mediaType` для UI/пуша. |
| UI | `CallModal`: `playsInline`, удалённый поток — `play()` + «тап для воспроизведения» при блокировке автоплея; в фазе не `connected` скрытый `<video>` держит **удалённый аудио** для видеозвонка. |
| TURN | Обязателен за NAT; без изменений относительно аудио. |
| Громкая связь | Маршрут `CallAudioRoute` вызывается только при `mediaType === "audio"` (`call-controller`), видео на динамик не форсится отдельно. |

---

## 7. Связанные файлы (ориентир)

| Слой | Файлы |
|------|--------|
| Сервер WS | `server/calls/ws.ts` |
| Клиент транспорт | `client/src/lib/realtime-socket-transport.ts` |
| Оркестрация звонка | `client/src/features/call/call-controller.ts`, `call-state-machine.ts` |
| WebRTC / медиа | `client/src/features/call/webrtc-peer.ts` |
| ICE | `client/src/features/call/call-ice-config.ts` |
| UI звонка (видео/аудио) | `client/src/components/CallModal.tsx` |

---

## 8. Примечание: «никогда» в продакшене

Гарантировать отсутствие сбоев **невозможно** (сети, ОС, баги браузеров). Цель этого документа — **убрать известные логические гонки**, зафиксировать политику сокетов и дать **повторяемый чеклист** при следующих изменениях.
