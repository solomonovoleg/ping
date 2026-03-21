# Модуль `ops` (операции платформы)

Небольшие HTTP-слои + репозитории (Drizzle). Каждый файл ≤ ~200 строк.

| Файл | Назначение |
|------|------------|
| `i18n.ru.ts` | Тексты ответов API (RU) |
| `platform.repo.ts` | Чтение/запись `platform_settings` |
| `platform.public-http.ts` | `GET /api/platform/announcement` |
| `platform.admin-http.ts` | `GET/PATCH /api/admin/ops/platform` |
| `traffic-shield.admin-http.ts` | `GET /api/admin/ops/traffic-shield` (метрики API + 429) |
| `reports.repo.ts` | Жалобы `content_reports` |
| `reports.user-http.ts` | `POST /api/reports` (сессия) |
| `reports.admin-http.ts` | Список и разбор жалоб (admin+) |
| `audit-http.ts` | Расширенный `/api/admin/audit-log` + CSV |

Миграция: `scripts/migrate-admin-ops.cjs`.
