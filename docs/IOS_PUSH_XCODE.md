# Пуши на iOS (Xcode) — чеклист

В репозитории уже есть: **entitlements** (`aps-environment`: development / production) и **UIBackgroundModes → remote-notification**. Остальное — в Xcode и в Apple Developer.

## 1. Apple Developer (обязательно)

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → приложение **`ru.pingmoot.app`**.
3. Включи capability **Push Notifications** (сохрани).

Без этого Apple не примет токен для удалённых пушей.

## 2. Xcode

1. Открой `ios/App/App.xcworkspace` (не `.xcodeproj`).
2. Target **App** → **Signing & Capabilities**.
3. Убедись, что **Team** выбран (у тебя в проекте уже есть `DEVELOPMENT_TEAM`).
4. Нажми **+ Capability** → **Push Notifications** (если Xcode сам не подхватил; entitlements уже в проекте).
5. По желанию: **+ Capability** → **Background Modes** → отметь **Remote notifications** (в `Info.plist` уже есть `remote-notification` — дублирование не страшно).

**Сборка с Mac на телефон (Run)** → используется **development** APNs (`App.Debug.entitlements`).  
**Archive / TestFlight / App Store** → **production** (`App.Release.entitlements`).

## 3. Сервер (отдельно от Xcode)

Чтобы пуш **доходил** после того как iOS всё разрешил: на VPS в `.env` нужен **`FCM_SERVER_KEY`** (см. `deploy.env.example`). Без ключа бэкенд пуши не отправляет.

Для связки **текущий бэкенд (FCM)** + **iOS** обычно нужен ещё **Firebase**: приложение iOS в Firebase, **APNs Auth Key** загружен в Firebase, **`GoogleService-Info.plist`** в проект — иначе токен может не совпасть с тем, что ждёт `server/push/send.ts`.

## 4. Как проверить «в лоб»

1. Залогинься в приложении → разреши уведомления.
2. Убедись, что **`POST /api/users/me/push-token`** успешен (или в БД заполнен `users.fcm_token`).
3. Пуш по коду уходит **другому пользователю** при новом сообщении — с самого себя пуш не прилетит.
