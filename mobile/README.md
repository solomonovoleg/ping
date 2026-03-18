# PING — мобильное приложение (Expo / React Native)

Тот же бэкенд (pingos.ru), вход по номеру и паролю, чаты и настройки.

## Требования

- Node.js 20+
- npm или yarn

## Установка

```bash
cd mobile
npm install
```

Перед первым запуском добавь иконки (иначе Expo подставит дефолтные): положи в `assets/` файлы `icon.png`, `splash-icon.png`, `adaptive-icon.png` (см. [Expo assets](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)).

## Запуск

```bash
npm start
```

Откроется Metro. Для Android: нажми `a` или отсканируй QR код в приложении Expo Go. Для iOS: `i` (нужен Mac с Xcode).

## Переменные окружения

- `EXPO_PUBLIC_API_URL` — URL бэкенда (по умолчанию `https://pingos.ru`). Для локального сервера: `EXPO_PUBLIC_API_URL=http://192.168.x.x:3080 npm start`.

## Сборка APK без Android Studio (EAS Build)

1. Установи EAS CLI: `npm i -g eas-cli`
2. Войди в Expo: `eas login`
3. Настрой проект (один раз): `eas build:configure`
4. Сборка Android APK: `npm run build:android` (профиль development) или `eas build -p android --profile production`

APK скачается с сайта Expo. Android Studio и JDK на своём компьютере не нужны.

## Что есть в приложении

- Вход по номеру и паролю (Bearer token сохраняется в SecureStore)
- Список чатов, экран чата, отправка сообщений
- Кнопка «Позвонить» (открывает `tel:`)
- Настройки: профиль, выход
- Пуш-уведомления: токен Expo Push отправляется на бэкенд после входа

Камера и запись голоса можно добавить через `expo-camera` и `expo-av` по мере надобности.
