# App Store Submission Pack (2026)

Готовый пакет для App Store Connect под текущую архитектуру PING (мессенджер + UGC + звонки + push).

## 1) Notes for Review (готовый текст)

Вставьте в App Store Connect -> App Review Information -> Notes.

```text
PING review notes (production-like build)

Test account #1 (primary):
- Login (phone/email): <FILL>
- Password: <FILL>
- Invite/referral code (if required): <FILL or N/A>

Test account #2 (for chat/call checks):
- Login (phone/email): <FILL>
- Password: <FILL>

Review environment:
- Backend base URL: https://pingos.ru
- Region restrictions: none
- Feature flags in this build: default production flags

Quick reviewer flow (2-3 minutes):
1) Log in with Test account #1.
2) Open feed and open any post.
3) Open chat and send a text message.
4) Log in on second device/account #2 and reply.
5) Place an audio/video call between accounts (if calls are in scope for this build).
6) UGC safety checks:
   - message: long-press -> "Пожаловаться"
   - post: menu -> "Пожаловаться"
   - profile: menu -> "Пожаловаться" / "Заблокировать"
   - story: story actions -> "Пожаловаться на сториз"
7) Account deletion path:
   Settings -> Delete account -> confirmation dialog.

Moderation operations:
- Users can report abusive content in-app.
- Reports are processed in admin queue (target SLA: within 24 hours).

Public legal URLs used by this build:
- Privacy Policy: https://pingos.ru/privacy
- Terms of Use: https://pingos.ru/terms
- Support email: support@pingos.ru

In-app legal access:
- Settings -> More -> Privacy Policy / Terms of use
- Login/registration screen also links to both legal documents.
```

## 2) App Privacy (рекомендованная матрица)

Ниже рабочая матрица для заполнения App Privacy. Перед отправкой сверяйте с текущим релизом и SDK.

- Tracking: `No` (если не добавляете ad/tracking SDK).
- Data Linked to User: `Yes` для аккаунтных и контентных данных.
- Data Used to Track: `No`.

### Data types (рекомендуемые категории)

1. Contact Info
   - Phone Number
   - Purpose: App Functionality (account/auth), Security/Fraud Prevention

2. User Content
   - Messages (text/voice/media), Posts, Comments, Stories, Profile content
   - Purpose: App Functionality, Moderation/Safety

3. Contacts
   - Address book numbers (only user-initiated matching flow)
   - Purpose: App Functionality (find contacts in app)

4. Identifiers
   - User ID, session/account identifiers, push token
   - Purpose: App Functionality, Security, Notifications

5. Usage Data (если фактически используете)
   - Product interaction / last activity
   - Purpose: App Functionality, Service quality

Важно:
- Не отмечайте лишние категории, которых фактически нет.
- Если добавите новый SDK/телеметрию/рекламу, обновите App Privacy до отправки.

### AI data handling (добавить в Notes при необходимости)

Если в билде есть AI-функции (AI-чат, AI-корректура текста, перевод сообщений), добавьте в `Notes for Review` короткое пояснение:

```text
AI features data handling:
- Some user-initiated features (AI chat, text proofreading, translation) send text to a third-party AI processor (OpenRouter) only to generate responses/corrections/translations.
- The app shows an in-app disclosure before first use of AI tools.
- AI processing is not used for advertising tracking.
```

## 3) Age Rating (анкета Connect, 2026)

Для текущего типа приложения (UGC + messaging) ориентируйтесь на консервативно-честные ответы:

- User-Generated Content: `Yes`
- Messaging/Communication between users: `Yes`
- Content moderation/report/block present: `Yes` (в Notes это указано)
- Sexual content/nudity: по факту продукта (обычно `No`, если запрещено правилами)
- Profanity/violence: отмечать по факту допускаемого контента и политики

Правило:
- Рейтинг и анкета должны соответствовать тому, что реально доступно пользователю в релизе.
- Если меняете возможности UGC, пересматривайте age rating перед каждым большим релизом.

## 4) Privacy Manifest / Required Reasons

В проекте добавлен app-level privacy manifest:
- `ios/App/App/PrivacyInfo.xcprivacy`

Минимум перед отправкой:
- Проверить, что файл попадает в target Resources.
- В Xcode Organizer/Validation убедиться, что нет предупреждений по required reasons.
- Если появляется новая required reason API категория, добавить валидный reason-код до сабмита.

## 5) Pre-submit Gate (короткий финальный проход)

Перед нажатием Submit:

1. Логин тест-аккаунтом работает на чистом iPhone.
2. Chat/feed/report/block/account delete проходят без ошибок.
3. Privacy/Terms/Support URL в Connect == ссылкам в приложении.
4. Скриншоты/описание/What's New соответствуют именно этому билду.
5. Сборка собрана на минимально допустимых SDK/Xcode из Apple Upcoming Requirements.

## 6) Быстрый copy checklist для релиз-менеджера

```text
[ ] Review Notes заполнены с 2 рабочими аккаунтами
[ ] Invite code добавлен (если регистрация закрытая)
[ ] Privacy Policy URL = https://pingos.ru/privacy
[ ] Terms URL = https://pingos.ru/terms
[ ] Support contact = support@pingos.ru
[ ] App Privacy анкета синхронизирована с фактическим сбором данных
[ ] AI data handling раскрыт в Privacy Policy и (при наличии AI в билде) в Notes for Review
[ ] Age Rating анкета обновлена под текущий UGC/messaging функционал
[ ] Privacy manifest/required reasons без warning в validation
[ ] Metadata (screenshots/description/whats-new) совпадает с билдом
[ ] Финальный smoke на физическом iPhone пройден
```
