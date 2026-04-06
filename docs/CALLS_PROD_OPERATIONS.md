# Calls Production Operations

Практичный набор команд и настроек для стабильных 1:1 звонков в проде.

## 1) Рекомендуемый TURN блок для `deploy.env`

```env
VITE_TURN_URLS=turn:ru-turn.example.com:3478?transport=udp,turn:ru-turn.example.com:3478?transport=tcp,turns:ru-turn.example.com:443?transport=tcp,turn:eu-turn.example.com:3478?transport=udp,turn:eu-turn.example.com:3478?transport=tcp,turns:eu-turn.example.com:443?transport=tcp
VITE_TURN_USERNAME=turn_user
VITE_TURN_CREDENTIAL=turn_password
VITE_CALLS_ALLOW_P2P_ICE=0
VITE_CALLS_AUDIO_ONLY_FALLBACK=1
```

Минимум:
- 2 региона TURN (`ru` + `eu` или ближние к аудитории).
- 3 транспорта на каждый endpoint: `udp`, `tcp`, `turns:443`.

## 2) Post-deploy smoke

После сборки и деплоя:

```bash
bash scripts/calls-post-deploy-smoke.sh --api-url https://your-domain.tld --dist-dir dist/public/assets
```

Smoke проверяет:
- доступность API,
- наличие TURN строк в клиентском бандле,
- базовую валидность call env,
- опционально SLO gate (если заданы `CALLS_SLO_*`).

## 3) Автоматический SLO мониторинг (GitHub Actions)

Воркфлоу: `.github/workflows/calls-slo-monitor.yml` (каждые 15 минут + manual run).

Нужные GitHub secrets:
- `CALLS_SLO_API_URL`
- `CALLS_SLO_ADMIN_LOGIN`
- `CALLS_SLO_ADMIN_PASSWORD`
- `CALLS_SLO_SETUP_SUCCESS_MIN` (например `98.5`)
- `CALLS_SLO_FAILED_MAX` (например `1.5`)

## 4) Cron вариант на сервере (если без GitHub Actions)

Пример (`crontab -e`):

```bash
*/15 * * * * cd /var/www/ping-moot && CALLS_SLO_API_URL=https://your-domain.tld CALLS_SLO_ADMIN_LOGIN=admin CALLS_SLO_ADMIN_PASSWORD=*** node scripts/check-calls-slo.cjs >> /var/log/ping-moot-calls-slo.log 2>&1
```

## 5) Быстрый operational checklist

- Деплой не должен проходить без `VITE_TURN_*`.
- В бандле обязаны быть `turn:` и `turns:`.
- При инциденте смотреть:
  - `callsReliability.setupFunnel`
  - `callsReliability.setupLatencyMs`
  - `callsReliability.setupFailureReason`
  - `callsReliability.recentCallEvents`
- Для rollback:
  - понизить rollout фич звонков/флагов,
  - вернуть прошлую TURN топологию,
  - перезапустить процесс.
