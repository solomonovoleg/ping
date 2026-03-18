# Android-приложение (native + веб)

Сборка — тот же веб-клиент (React), упакованный в нативную оболочку Capacitor. Доступны камера, микрофон, звонки и пуш-уведомления.

## Требования

- Node.js 20+
- **JDK 17 или 21** — уже есть, если ставил `brew install openjdk@21`. Чтобы `java` был в PATH без Android Studio, выполни один раз:
  ```bash
  sudo ln -sfn /usr/local/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
  ```
  Либо перед сборкой APK задай: `export JAVA_HOME=/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- **Android SDK** — без него Gradle не соберёт APK. Варианты:
  - **Проще всего:** установить [Android Studio](https://developer.android.com/studio). Он ставит SDK в `~/Library/Android/sdk`. После установки создай файл `android/local.properties` с одной строкой:
    ```text
    sdk.dir=/Users/admin/Library/Android/sdk
    ```
    (подставь свой путь, если другой.)
  - **Только SDK без Студии:** [Command line tools](https://developer.android.com/studio#command-tools), распаковать, установить через `sdkmanager` пакеты `platform-tools`, `platforms;android-34`, `build-tools;34.0.0`, задать `ANDROID_HOME` и в `android/local.properties` указать `sdk.dir=$ANDROID_HOME`.

## Сборка без Android Studio (через терминал)

1. Собрать веб и синхронизировать с Android:
   ```bash
   npm run build:android:prod
   ```

2. Убедиться, что есть Android SDK и `android/local.properties` с путём к нему (см. выше).

3. Собрать APK (в каталоге проекта):
   ```bash
   export JAVA_HOME=/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
   npm run android:apk
   ```
   Готовый APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

   Релизный APK: `npm run android:apk:release` — перед этим настрой подпись в `android/app/build.gradle`.

**Про Expo:** у нас **Capacitor** (веб в нативной оболочке), не React Native. Сборка через `gradlew` — это и есть вариант без Студии (нужны только JDK + Android SDK).

## Сборка через Android Studio (по желанию)

1. `npm run build:android`
2. Открыть проект: `npm run android` (или вручную File → Open → папка `android`).
3. В Студии: Run → выбрать устройство/эмулятор.

## API в нативном приложении

В приложении должен быть указан базовый URL бэкенда, иначе запросы уйдут не туда. При сборке для Android задайте переменную:

```bash
VITE_API_URL=https://your-server.com npm run build
```

Затем снова: `npx cap sync android`.

Пример для продакшена:
```bash
VITE_API_URL=https://pingos.ru npm run build:android
```

## Разрешения (уже добавлены в манифест)

- Камера — фото для аватара и т.п.
- Микрофон — запись голосовых (в веб-чате уже есть).
- Звонки — кнопка «Позвонить» в чате открывает системный набор номера (если у контакта есть номер).
- Пуш-уведомления — после входа токен FCM сохраняется через `POST /api/users/me/push-token`.

## Использование нативных возможностей в коде

В `client/src/lib/capacitor-native.ts`:

- `isNative()` — проверка, что приложение запущено в Capacitor (Android).
- `takePhotoFromCamera()` / `pickPhotoFromGallery()` — фото с камеры или из галереи (dataUrl).
- `requestPushAndGetToken()` — запрос разрешения на пуши и получение FCM-токена.
- `openDialer(phoneNumber)` — открыть набор номера / звонок.

Токен пуша при логине отправляется на бэкенд автоматически (см. `AuthContext`).

## Пуш-уведомления на бэкенде

Сейчас бэкенд только сохраняет FCM-токен в `users.fcm_token`. Чтобы реально отправлять пуши (новые сообщения и т.д.), нужно:

1. Настроить Firebase Cloud Messaging (FCM) в консоли Firebase и положить `google-services.json` в `android/app/`.
2. На сервере использовать Admin SDK (Firebase Admin) или HTTP v1 API FCM и слать запросы по сохранённым токенам.

После добавления колонки `fcm_token` выполните миграцию: `npm run db:push`.
