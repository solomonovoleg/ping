# BUSINESS STATUS REQUESTS (MVP)

## Цель

Добавить безопасный и простой процесс получения бизнес-статуса:

- пользователь подает заявку из `EditProfile`;
- заявка попадает в админ-очередь;
- решение принимает только `admin` / `super_admin`.

## Статусы

### `users.business_status`

- `none` — заявки нет;
- `pending` — есть активная заявка на модерации;
- `approved` — бизнес-статус подтвержден;
- `rejected` — заявка отклонена;
- `revision_required` — заявка отправлена на пересмотр (новая заявка подается заново).

### `business_status_requests.status`

- `submitted` — новая активная заявка;
- `approved` — заявка одобрена;
- `rejected` — заявка отклонена;
- `revision_required` — заявка отправлена на пересмотр.

## Ограничения и правила

- Одна активная заявка (`submitted`) на пользователя:
  - enforced в БД через partial unique index `business_status_requests_user_active_submitted_uidx`.
- Новая заявка доступна только когда `users.business_status`:
  - `none`, `rejected`, `revision_required`.
- При создании заявки:
  - `users.business_status` переключается в `pending`.
- Форма заявки:
  - `reason` (обязательно),
  - до 3 ссылок `http/https`,
  - `consentModeration=true` (обязательно).

## Контакты одобренного бизнес-профиля

- Только при `users.business_status = approved` владелец может редактировать:
  - `users.business_contact_phone`
  - `users.business_address`
- В публичном профиле контакты показываются только для `approved`.
- Для не-`approved` профильных статусов сервер возвращает `businessContactPhone = null` и `businessAddress = null`.

## API

### Пользователь

- `POST /api/users/me/business-status-request`
  - body: `{ reason, links[], consentModeration }`
  - `201` при успехе.
- `GET /api/users/me/business-status-request`
  - возвращает:
    - `businessStatus`,
    - `activeRequest`,
    - `latestRequest`.

### Админ

- `GET /api/admin/business-status-requests?status=submitted|approved|rejected|revision_required`
- `POST /api/admin/business-status-requests/:id/approve`
- `POST /api/admin/business-status-requests/:id/reject`
- `POST /api/admin/business-status-requests/:id/revision`

Для админ-эндпоинтов обязательна роль `admin` или `super_admin`.

## Аудит

При модерации пишется `writeAuditLog` с action:

- `business_status.approve`
- `business_status.reject`
- `business_status.revision`

## UI точки входа

- Пользователь: `client/src/pages/EditProfile.tsx`
- Админка: `client/src/pages/admin/BusinessStatusRequestsSection.tsx` + `client/src/pages/admin/Users.tsx`
