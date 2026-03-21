# PULSE chat — эталонный шаблон (Mobile + Messenger)

Исходники скопированы из `pulse-chat-template` (мобильный и десктопный макет 1:1).

| Файл | Назначение |
|------|------------|
| `DESIGN_RULES.md` | Цвета, радиусы пузырей, ReadTick, паттерны, smart replies, STT |
| `MobileChatDark.tsx` / `MobileChatLight.tsx` | Мобильный чат 390×844, 8 настроений |
| `MessengerChatDark.tsx` / `MessengerChatLight.tsx` | Десктоп с сайдбаром 1280×720 |

**Просмотр в приложении (только dev):**

| Маршрут | Макет |
|---------|--------|
| `/dev/pulse-template` | Мобильный тёмный (`MobileChatDark`, ~390px по центру) |
| `/dev/pulse-template/desktop` | Десктоп тёмный (`MessengerChatDark`, сайдбар + тред, на весь экран) |
| `/dev/pulse-template/desktop-light` | Десктоп светлый (`MessengerChatLight`) |
| `/dev/pulse-template/stories` | Сториз, мок «мои» (`MobileStoriesViewer`) |
| `/dev/pulse-template/stories-other` | Сториз, мок «чужие» (`initialMode="other"`) |

Реальный чат — `ChatDetail`; шаблон не подменяет экран, только сверка с макетом. Реальные сториз — `StoryViewer` на ленте/профиле; см. `STORIES_README.md`.

Интеграция в продакшен-чат: выносить куски в общие компоненты и подключать к `useChatMessages` / `send.*` / `actions.*` (см. `docs/CHAT_DETAIL_RULES.md`), а не подменять экран целиком этим файлом.
