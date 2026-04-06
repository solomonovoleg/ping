# EDGE MONEY — баллы за минуты звонка 1:1

- Хук: `handleCallEndedForEdgeMoney` вызывается из `server/calls/session.ts` при `endSession`, если был `connectedAt`.
- Учитываются **полные минуты** `(endedAt - connectedAt) / 60_000`, только **ЛС на двоих**, не service-chat.
- Оба участника получают одинаковое число минут в счётчик `(user, chat, edge)`.
- Правило в EDGE: `video_call_minutes` (аудио и видео); порог = минут за один блок начисления.
- **Групповые звонки не учитываются** (только 1:1 и только ЛС на двоих).
- EDGE: `GET /v1/money/call-accrual-targets`, событие `video_call_minutes_milestone`, ключ гранта `money_video_call`.
