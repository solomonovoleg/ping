# 1:1 Calls Pre-release Checklist

Чеклист для регрессионной проверки 1:1 звонков перед релизом.

## Happy path

- [ ] A звонит B -> B принимает -> оба видят `connected`.
- [ ] Во время активного звонка нет баннера `reconnecting`, если media стабилен.
- [ ] Красная кнопка у любой стороны завершает звонок в `ended`.

## Redial and lifecycle

- [ ] `hangup` у A -> через 1-2 сек A снова звонит B -> новый `callId`, успешный дозвон.
- [ ] `hangup` у A -> B сразу перезванивает -> успешный дозвон.
- [ ] После `ended` нет `already_in_call` для обеих сторон.

## Missed / timeout semantics

- [ ] A звонит B, B не отвечает до timeout: у A статус `missed` (недозвон), у B `missed` (пропущенный).
- [ ] A отменяет звонок до ответа: у B фиксируется пропущенный, без зависания в `reconnecting`.

## Glare / simultanous call

- [ ] A и B нажимают звонок почти одновременно.
- [ ] Создается одна рабочая сессия, без двух параллельных `ringing` между одной парой.

## Transport resilience

- [ ] Краткий обрыв WS во время `connected` не переводит UI в reconnect, если `pcState=connected`.
- [ ] Длительный обрыв WS приводит к `connection_lost`/`failed` и чистому завершению.
- [ ] После восстановления сети повторный звонок работает.

## Multi-tab / multi-device

- [ ] Один пользователь в двух вкладках: события звонка не каскадят `call.canceled` в активной вкладке.
- [ ] Нет reconnect-штормов (`/api/calls/token` и переоткрытий `/calls`).

## Observability and rollout gates

- [ ] В логах есть `call.state-transition` и `ws closed` с reason-классификацией.
- [ ] В `GET /api/admin/dashboard/analytics` обновляются `callsReliability` counters.
- [ ] Для rollout проверены критерии stop/rollback из `docs/CALLS_RELIABILITY.md`.
