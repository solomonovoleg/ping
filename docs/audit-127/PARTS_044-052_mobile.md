# Аудит: части 044–052 (готовность Android и iOS)

Стек: Capacitor, `android/`, `ios/`. Сверять с `docs/DEPLOY_RULES.md`, store-moderation разделами в `features/store-moderation/`.

---

<a id="part-044"></a>
## Часть 044 — Capacitor и deep links

**Наблюдения:** Сборка веба в `client/dist`, синхронизация в нативные проекты. Deep return на вебе через `auth-return-path`.

**Готовность:** Базовая гибридная схема зрелая; критично тестировать Universal/App Links на реальных устройствах.

**Зазоры:** Согласование `server.url` / `VITE_*` с прод-доменом; открытие внешних ссылок в in-app browser vs Safari/Chrome.

### Metrics — Часть 044

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 |
| **Evidence** | `capacitor.config.ts`, `client/src/lib/auth-return-path.ts` |

---

<a id="part-045"></a>
## Часть 045 — Android: разрешения, фон, батарея

**Наблюдения:** `AndroidManifest.xml` — камера, микрофон, уведомления; поведение в фоне для WS/звонков.

**Зазоры:** Doze и ограничения фоновой сети; foreground service для звонка если требуется политика Google.

### Metrics — Часть 045

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 4 |
| **ParityVsGiants** | 3 |
| **Evidence** | `android/app/src/main/AndroidManifest.xml` |

---

<a id="part-046"></a>
## Часть 046 — Android: звук и звонки

**Наблюдения:** `CallAudioRoutePlugin.java`, `MainActivity.java` — нативная маршрутизация аудио.

**Зазоры:** Согласованность с WebRTC audio focus; тест гарнитуры/Bluetooth.

### Metrics — Часть 046

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 4 |
| **ParityVsGiants** | 3 |
| **Evidence** | `android/.../CallAudioRoutePlugin.java`, `docs/CALLS_RELIABILITY.md` |

---

<a id="part-047"></a>
## Часть 047 — Android: сборка и подпись

**Наблюдения:** `build.gradle`, версии SDK, applicationId.

**Зазоры:** Play App Signing, ProGuard/R8 правила для Capacitor плагинов; 64-bit requirement.

### Metrics — Часть 047

| Метрика | Значение |
|---------|----------|
| **Coverage** | 35% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green при CI |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `android/app/build.gradle` |

---

<a id="part-048"></a>
## Часть 048 — iOS: Info.plist, ATS, фон

**Наблюдения:** Разрешения камеры/микрофона/фото; ATS для API origin.

**Зазоры:** Произвольные HTTP исключения в ATS — только если неизбежно; Background Modes для VoIP/push.

### Metrics — Часть 048

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `ios/App/App/Info.plist` |

---

<a id="part-049"></a>
## Часть 049 — iOS: аудиосессия / CallKit

**Наблюдения:** Нативный слой для звонков может требовать CallKit для приёмлемого UX входящего.

**Зазоры:** Без CallKit входящий в фоне слабее нативных звонков; согласовать с продуктовой целью.

### Metrics — Часть 049

| Метрика | Значение |
|---------|----------|
| **Coverage** | 30% |
| **HealthScore** | 2 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 4 |
| **ParityVsGiants** | 2 (FaceTime) |
| **Evidence** | `ios/`, `docs/CALLS_1TO1_RELEASE_CHECKLIST.md` |

---

<a id="part-050"></a>
## Часть 050 — Пуши (обе платформы)

**Наблюдения:** FCM; регистрация токена на сервере; тост при ошибке на клиенте (UNSTABLE).

**Зазоры:** Разрешение уведомлений iOS; каналы Android 8+; дедупликация пуш+in-app.

### Metrics — Часть 050

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 |
| **Evidence** | `features/push/`, `server/notifications/` |

---

<a id="part-051"></a>
## Часть 051 — Версии и OTA

**Наблюдения:** Версия в нативных проектах + `.build-number` на вебе для «Версия N» в UI.

**Зазоры:** Принудительное обновление WebView-шелла при ломающих API; коммуникация пользователю.

### Metrics — Часть 051

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | N/A |
| **Evidence** | `script/build.ts`, `.build-number`, `deploy/README.md` |

---

<a id="part-052"></a>
## Часть 052 — Store compliance (краткий чек)

**Наблюдения:** Блоки store-moderation в админке клиента покрывают UGC, Privacy, метаданные, Google Play.

**Чеклист:** Удаление аккаунта; политика контента; экспорт данных; скриншоты из реального UI; Data safety формулировки.

### Metrics — Часть 052

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Green (процесс) |
| **UXFriction** | N/A |
| **ParityVsGiants** | N/A |
| **Evidence** | `features/store-moderation/`, Apple/Google разделы в PROJECT_MAP |
