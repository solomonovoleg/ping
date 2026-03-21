# Vosk ASR для PING MOOT

Бесплатный self-hosted backend для титров и команд в групповых звонках на обычном VPS без GPU.

## Почему Vosk

- Бесплатно, без платных API.
- Работает на CPU.
- Лучше подходит для live-распознавания на VPS, чем тяжёлый Whisper без отдельного железа.
- Для русского можно использовать маленькую модель `vosk-model-small-ru-0.22`.

## Что уже умеет приложение

- Клиент шлёт аудио-чанки в `group.asr-audio` как fallback.
- Для live partial-титров клиент шлёт PCM-поток в `group.asr-pcm`.
- Node умеет работать и с HTTP fallback, и со streaming WS backend.

Точки интеграции: `server/call-transcripts/asr-provider.ts`, `server/call-transcripts/asr-stream-session.ts`.

## Быстрый запуск на VPS

На сервере в каталоге проекта:

```bash
bash scripts/setup-vosk-asr-on-server.sh
```

Скрипт:

- ставит `python3`, `venv`, `ffmpeg`, `vosk`, `websockets`;
- скачивает русскую модель;
- поднимает systemd-сервис `ping-moot-vosk`;
- поднимает systemd-сервис `ping-moot-vosk-stream`;
- слушает `http://127.0.0.1:8099/transcribe` и `ws://127.0.0.1:8100/stream`.

## Переменные

В `deploy.env`:

```bash
export GROUP_CALLS_ENABLED=1
export VITE_GROUP_CALLS_ENABLED=1
export GROUP_CALLS_SERVER_ASR_ENABLED=1
export VITE_GROUP_CALLS_SERVER_ASR=1
export CALL_TRANSCRIPTS_ASR_URL="http://127.0.0.1:8099/transcribe"
export CALL_TRANSCRIPTS_ASR_WS_URL="ws://127.0.0.1:8100/stream"
# export CALL_TRANSCRIPTS_ASR_API_KEY="secret"
```

Важно: `scripts/deploy.sh` уже пишет эти серверные переменные в `.env` на VPS.

**Титры «не идут» при `VITE_GROUP_CALLS_SERVER_ASR=1`:** раньше клиент в первую очередь слал только PCM в `group.asr-pcm`, а Node обрабатывает его **только если** задан `CALL_TRANSCRIPTS_ASR_WS_URL` и жив Vosk stream. Без WS сообщения отбрасывались, а браузерный Web Speech не включался. Сейчас по умолчанию клиент сначала шлёт **webm-чанки** на HTTP (`CALL_TRANSCRIPTS_ASR_URL`). Поток PCM+WS включайте флагом **`VITE_GROUP_CALLS_ASR_PCM_STREAM=1`** в сборке, когда stream точно поднят.

## Что лучше использовать

- Если хочешь максимальную стабильность на слабом VPS: можно оставить только `CALL_TRANSCRIPTS_ASR_URL` и chunk fallback.
- Если хочешь более живые титры: задавай ещё `CALL_TRANSCRIPTS_ASR_WS_URL` и получишь partial/final поток через Vosk stream server.

## Ограничения

- Vosk stream лучше для low-latency титров, но качество всё равно зависит от CPU и модели.
- Chunk HTTP fallback остаётся как страховка.
- Качество зависит от модели Vosk и входного аудио.
