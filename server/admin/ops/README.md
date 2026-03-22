# Модуль `ops` (операции платформы)

Небольшие HTTP-слои + репозитории (Drizzle). Каждый файл ≤ ~200 строк (исключение: `disk-stats.service.ts` — агрегатор обхода диска и БД).

| Файл | Назначение |
|------|------------|
| `i18n.ru.ts` | Тексты ответов API (RU) |
| `platform.repo.ts` | Чтение/запись `platform_settings` |
| `platform.public-http.ts` | `GET /api/platform/announcement` |
| `platform.admin-http.ts` | `GET/PATCH /api/admin/ops/platform` |
| `traffic-shield.admin-http.ts` | `GET /api/admin/ops/traffic-shield` (метрики API + 429) |
| `disk-stats.service.ts` | Сбор размеров `uploads/*`, разбивка чат-медиа по БД, `pg_database_size` / `pg_total_relation_size` |
| `host-snapshot.ts` | Память, loadavg, размер папки проекта (`du` / обход), доли относительно тома и проекта |
| `disk.admin-http.ts` | `GET /api/admin/ops/disk` (админка «Диск») |
| `reports.repo.ts` | Жалобы `content_reports` |
| `reports.user-http.ts` | `POST /api/reports` (сессия) |
| `reports.admin-http.ts` | Список и разбор жалоб (admin+) |
| `audit-http.ts` | Расширенный `/api/admin/audit-log` + CSV |

Миграция: `scripts/migrate-admin-ops.cjs`.
