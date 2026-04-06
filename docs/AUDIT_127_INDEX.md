# PING MOOT — полный аудит (127 частей)

Мастер-индекс: каждая часть имеет блок **Metrics** (см. [docs/audit-127/METRICS_TEMPLATE.md](audit-127/METRICS_TEMPLATE.md)). Статус **Заполнено** — текст и метрики внесены в соответствующий файл.

| Часть | Категория | Тема | Документ |
|------|-----------|------|----------|
| 001 | 1 Функциональность | Auth, онбординг, deep return | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-001) |
| 002 | 1 | Чаты, сообщения, медиа | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-002) |
| 003 | 1 | Звонки 1:1 | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-003) |
| 004 | 1 | Групповые звонки | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-004) |
| 005 | 1 | Лента и посты | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-005) |
| 006 | 1 | Комментарии | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-006) |
| 007 | 1 | Сториз | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-007) |
| 008 | 1 | Профиль, подписки, блок | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-008) |
| 009 | 1 | Уведомления и пуш | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-009) |
| 010 | 1 | Настройки и данные | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-010) |
| 011 | 1 | EDGE companion + EDGE Money (сквозной сценарий) | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-011) |
| 012 | 1 | ПИНГОК МИКРО и напоминания | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-012) |
| 013 | 1 | Борд: SENDER, BUSINESS, API HUB, треки | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-013) |
| 014 | 1 | Админка, VK parser, медиа-студия | [PARTS_001-014_functionality.md](audit-127/PARTS_001-014_functionality.md#part-014) |
| 015 | 2 UIX | Навигация и информационная архитектура | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-015) |
| 016 | 2 | Чат: pulse-template vs ChatDetail | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-016) |
| 017 | 2 | Лента: карточки и плотность | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-017) |
| 018 | 2 | Профиль PULSE | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-018) |
| 019 | 2 | UI звонков | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-019) |
| 020 | 2 | Формы, валидация, ошибки | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-020) |
| 021 | 2 | Состояния: загрузка, пусто, ошибка | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-021) |
| 022 | 2 | Доступность (a11y) | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-022) |
| 023 | 2 | Motion и reduced-motion | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-023) |
| 024 | 2 | Единый стиль компонентов | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-024) |
| 025 | 2 | Сравнение с гигантами (сводка UIX) | [PARTS_015-025_uix.md](audit-127/PARTS_015-025_uix.md#part-025) |
| 026 | 3 Безопасность | Сессии и cookies | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-026) |
| 027 | 3 | CORS, CSRF, security headers | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-027) |
| 028 | 3 | Авторизация маршрутов, IDOR | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-028) |
| 029 | 3 | Загрузки файлов и MIME | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-029) |
| 030 | 3 | WebSocket: чаты и звонки | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-030) |
| 031 | 3 | Rate limit и api-shield | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-031) |
| 032 | 3 | Секреты и .env | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-032) |
| 033 | 3 | SQL / Drizzle, массовые выборки | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-033) |
| 034 | 3 | XSS и пользовательский контент | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-034) |
| 035 | 3 | Блокировки и приватность | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-035) |
| 036 | 3 | Админка и роли | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-036) |
| 037 | 3 | Пуш-токены и FCM | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-037) |
| 038 | 3 | Capacitor / WebView | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-038) |
| 039 | 3 | EDGE / PARSER процессы | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-039) |
| 040 | 3 | api-hub и внешние ключи | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-040) |
| 041 | 3 | Логи и PII | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-041) |
| 042 | 3 | Зависимости npm (CVE-обзор) | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-042) |
| 043 | 3 | Threat modeling мессенджера | [PARTS_026-043_security.md](audit-127/PARTS_026-043_security.md#part-043) |
| 044 | 4 Мобайл | Capacitor, deep links | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-044) |
| 045 | 4 | Android: разрешения, фон, батарея | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-045) |
| 046 | 4 | Android: звук и звонки | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-046) |
| 047 | 4 | Android: сборка, подпись | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-047) |
| 048 | 4 | iOS: Info.plist, ATS, фон | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-048) |
| 049 | 4 | iOS: аудиосессия / CallKit | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-049) |
| 050 | 4 | Пуши iOS и Android | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-050) |
| 051 | 4 | OTA, версии, обновления | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-051) |
| 052 | 4 | Store compliance (краткий чек) | [PARTS_044-052_mobile.md](audit-127/PARTS_044-052_mobile.md#part-052) |
| 053 | 5 Микро-UX | Тап, haptic, мгновенный отклик | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-053) |
| 054 | 5 | Скелетоны и пустые состояния | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-054) |
| 055 | 5 | Анимации и lib/motion | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-055) |
| 056 | 5 | Списки и смена чата | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-056) |
| 057 | 5 | Сеть: ошибки и retry | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-057) |
| 058 | 5 | Типографика и плотность | [PARTS_053-058_micro-ux.md](audit-127/PARTS_053-058_micro-ux.md#part-058) |
| 059 | 6 Качество | 5 рекомендаций: состояния экранов | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-059) |
| 060 | 6 | 5 рекомендаций: дизайн-система | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-060) |
| 061 | 6 | 5 рекомендаций: ошибки и обратная связь | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-061) |
| 062 | 6 | 5 рекомендаций: перформанс списков | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-062) |
| 063 | 6 | 5 рекомендаций: навигация | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-063) |
| 064 | 6 | 5 рекомендаций: офлайн и обрыв | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-064) |
| 065 | 6 | 5 рекомендаций: формы | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-065) |
| 066 | 6 | 5 рекомендаций: звонки и медиа | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-066) |
| 067 | 6 | 5 рекомендаций: доступность | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-067) |
| 068 | 6 | 5 рекомендаций: ощущение премиума | [PARTS_059-068_quality.md](audit-127/PARTS_059-068_quality.md#part-068) |
| 069 | 7 Функции | Auth и сессия | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-069) |
| 070 | 7 | Онбординг и deep return | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-070) |
| 071 | 7 | Список чатов и папки | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-071) |
| 072 | 7 | Экран чата и отправка | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-072) |
| 073 | 7 | Медиа в чате и вложения | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-073) |
| 074 | 7 | Стикеры | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-074) |
| 075 | 7 | Chat Vibe | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-075) |
| 076 | 7 | Сохранённые и поиск по сообщениям | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-076) |
| 077 | 7 | Голосовые сообщения | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-077) |
| 078 | 7 | Отложенные сообщения | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-078) |
| 079 | 7 | AI Chat | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-079) |
| 080 | 7 | AI Search | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-080) |
| 081 | 7 | Звонки 1:1 | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-081) |
| 082 | 7 | Групповые звонки | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-082) |
| 083 | 7 | Транскрипты звонков | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-083) |
| 084 | 7 | Контакты и подписки | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-084) |
| 085 | 7 | Блокировки пользователя | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-085) |
| 086 | 7 | Глобальная лента | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-086) |
| 087 | 7 | Посты CRUD | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-087) |
| 088 | 7 | Просмотры и вовлечённость поста | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-088) |
| 089 | 7 | Комментарии и @упоминания | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-089) |
| 090 | 7 | Сториз | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-090) |
| 091 | 7 | Внутриигровые уведомления | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-091) |
| 092 | 7 | Push-уведомления | [PARTS_069-094_functions.md](audit-127/PARTS_069-094_functions.md#part-092) |
| 093 | 7 | Профиль PULSE | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-093) |
| 094 | 7 | Закрепы в профиле | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-094) |
| 095 | 7 | Жалобы UGC | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-095) |
| 096 | 7 | Настройки | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-096) |
| 097 | 7 | Рефералы и приглашения | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-097) |
| 098 | 7 | Напоминания | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-098) |
| 099 | 7 | Голосовые задачи / планировщик | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-099) |
| 100 | 7 | ПИНГОК МИКРО | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-100) |
| 101 | 7 | Service chat | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-101) |
| 102 | 7 | Орфография и перевод | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-102) |
| 103 | 7 | Превью ссылок | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-103) |
| 104 | 7 | EDGE companion | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-104) |
| 105 | 7 | EDGE creator / кампании | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-105) |
| 106 | 7 | EDGE Money | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-106) |
| 107 | 7 | SENDER | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-107) |
| 108 | 7 | Business Chat | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-108) |
| 109 | 7 | Board API HUB | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-109) |
| 110 | 7 | Треки (борд) | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-110) |
| 111 | 7 | История звонков (борд) | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-111) |
| 112 | 7 | Загрузки медиа | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-112) |
| 113 | 7 | Админ ops | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-113) |
| 114 | 7 | VK parser / PARSER | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-114) |
| 115 | 7 | Медиа-студия | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-115) |
| 116 | 7 | Store moderation (Apple/Google) | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-116) |
| 117 | 7 | Realtime чат (WS) | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-117) |
| 118 | 7 | Feed worker / снапшот | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-118) |
| 119 | 7 | api-hub | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-119) |
| 120 | 7 | Валидация жалоб (сервер) | [PARTS_095-120_functions.md](audit-127/PARTS_095-120_functions.md#part-120) |
| 121 | 8 Критическое | Данные и миграции | [PARTS_121-124_critical.md](audit-127/PARTS_121-124_critical.md#part-121) |
| 122 | 8 | WebSocket и звонки: отказоустойчивость | [PARTS_121-124_critical.md](audit-127/PARTS_121-124_critical.md#part-122) |
| 123 | 8 | Медиа и хранилище | [PARTS_121-124_critical.md](audit-127/PARTS_121-124_critical.md#part-123) |
| 124 | 8 | Многосервисность | [PARTS_121-124_critical.md](audit-127/PARTS_121-124_critical.md#part-124) |
| 125 | 9 Итог | Сильные стороны (синтез) | [PARTS_125-127_synthesis.md](audit-127/PARTS_125-127_synthesis.md#part-125) |
| 126 | 9 | Сводная таблица Metrics ×127 + бэклог | [PARTS_125-127_synthesis.md](audit-127/PARTS_125-127_synthesis.md#part-126) |
| 127 | 9 | Оценки 1–5 и roadmap 30/60/90 | [PARTS_125-127_synthesis.md](audit-127/PARTS_125-127_synthesis.md#part-127) |

**Статус:** Заполнено (первичный аудит по коду и документации репозитория, апрель 2026).

См. также: [docs/PROJECT_MAP.md](PROJECT_MAP.md), [docs/UNSTABLE_OR_POORLY_WORKING.md](UNSTABLE_OR_POORLY_WORKING.md), [docs/CALLS_RELIABILITY.md](CALLS_RELIABILITY.md).
