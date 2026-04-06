# Настройка TURN для звонков

Без TURN звонки работают по P2P (STUN только помогает найти внешний адрес). За симметричным NAT или строгим файрволом соединение может не установиться — в этом случае нужен TURN-сервер, который ретранслирует медиа-трафик.

## Быстрый вариант: coturn на том же VPS

1. Установите coturn (например, на Ubuntu: `apt install coturn`).
2. Включите и настройте:
   - В `/etc/turnserver.conf` или через переменные окружения задайте:
     - `listening-port=3478`
     - `fingerprint`, `lt-cred-mech`
     - Секрет для временных учётных данных (или статичный user/password).
3. Откройте порты 3478 (UDP/TCP) и диапазон relay (по умолчанию 49152–65535 UDP).
4. В `.env` на клиенте (или в `deploy.env` перед сборкой) задайте:
   ```env
   VITE_TURN_URLS=turn:ВАШ_ДОМЕН:3478
   VITE_TURN_USERNAME=ваш_логин
   VITE_TURN_CREDENTIAL=ваш_пароль
   ```
   Или один URL без учёта: `VITE_TURN_URL=turn:ВАШ_ДОМЕН:3478` (если coturn настроен без аутентификации).

## Wi‑Fi ↔ LTE и разные операторы

Прямой P2P между домашним Wi‑Fi и мобильным LTE часто **не собирается** (разные NAT). Нужны **рабочий TURN** и открытые **relay-порты** на VPS (см. таблицу ниже про security group). В клиенте для **личных звонков 1:1** в production при полной паре `VITE_TURN_*` по умолчанию включается **`iceTransportPolicy: "relay"`** — весь медиа-трафик идёт через coturn. Отключить и снова разрешить P2P где возможно: **`VITE_CALLS_ALLOW_P2P_ICE=1`** в `deploy.env` и пересборка. Групповой mesh relay не форсирует (нагрузка на TURN).

### Рекомендуемая topology для production

- Минимум **2 TURN endpoint** (разные регионы): например `ru-turn.*` + `eu-turn.*`.
- Для каждого endpoint держать сразу 3 пути:
  - `turn:host:3478?transport=udp`
  - `turn:host:3478?transport=tcp`
  - `turns:host:443?transport=tcp` (или `5349`)
- Причина: LTE/VPN сети часто режут UDP или нестандартные порты; TLS на 443 даёт последний fallback.

Пример:

```env
VITE_TURN_URLS=turn:ru-turn.example.com:3478?transport=udp,turn:ru-turn.example.com:3478?transport=tcp,turns:ru-turn.example.com:443?transport=tcp,turn:eu-turn.example.com:3478?transport=udp,turn:eu-turn.example.com:3478?transport=tcp,turns:eu-turn.example.com:443?transport=tcp
VITE_TURN_USERNAME=turn_user
VITE_TURN_CREDENTIAL=turn_password
```

## Проверка

После сборки клиента с заданными переменными в браузере при звонке в WebRTC будут использоваться указанные TURN-серверы. В логах coturn (`/var/log/turnserver.log` или stdout) должны появляться сессии при звонках из проблемных сетей.

### Убедиться, что TURN попал в бандл (после `npm run build` / деплоя)

1. **Переменные только на этапе сборки:** `VITE_*` читает Vite при `npm run build`. В `deploy.sh` все `VITE_*` из `deploy.env` экспортируются перед сборкой — без них в бандле будет только STUN.
2. **Проверка артефакта:** подставь свой хост из `VITE_TURN_URLS` и выполни из корня репозитория:
   ```bash
   rg -l "turn:" dist/public/assets/*.js 2>/dev/null | head -3
   ```
   Должен найтись хотя бы один chunk со строкой `turn:` (URL подставляется как литерал).
3. **Код:** `client/src/features/call/call-ice-config.ts` → `getIceServers()` / `getCallRtcConfiguration()` (1:1 и group). Подключение создаётся в `webrtc-peer.ts` и `mesh-link.ts`.
4. **Pre-deploy:** `scripts/pre-deploy-check.sh` напоминает, если TURN URL не задан (остаётся только STUN), и предупреждает, если задан **только один** из `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` (неполная пара). Анонимный TURN (оба пустые) — без этого предупреждения.

### Типичные ошибки

| Симптом | Что проверить |
|--------|----------------|
| В проде нет TURN | В `deploy.env` нет `VITE_TURN_*` или деплой без экспорта `VITE_*` перед сборкой. |
| Coturn отклоняет | Заданы **оба** `VITE_TURN_USERNAME` и `VITE_TURN_CREDENTIAL`, совпадают с `user=…` в `turnserver.conf`. Если задан только URL без пары логин/пароль — клиент намеренно не шлёт креды (см. `call-ice-config.ts`). |
| Порты | UDP/TCP **3478** и диапазон relay (часто **49152–65535** UDP) открыты на фаерволе и в облаке. |
| Облачный security group | На многих VPS **UFW выключен**, но панель провайдера режет UDP **49152–65535** — без этого relay TURN **не работает** при `iceTransportPolicy: relay` и для части LTE-сценариев. Открой входящий UDP на этот диапазон на публичный IP сервера. |

## Облачные TURN

Можно использовать коммерческие TURN (Twilio, Xirsys, Metered и др.): вы получите URL и учётные данные, их нужно прописать в `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` и пересобрать клиент.
