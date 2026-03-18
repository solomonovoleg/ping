# Server — модульная структура

- **auth/** — сессия, хэш паролей, маршруты: register, login, logout, me
- **chats/** — маршруты: список чатов, чат по id, создание чата
- **messages/** — маршруты: сообщения по chatId, отправка сообщения
- **storage/** — хранилище (in-memory): types, users-store, chats-store, messages-store, mem-storage, index

Файлы до ~200–300 строк. Роуты подключаются в `routes.ts`.
