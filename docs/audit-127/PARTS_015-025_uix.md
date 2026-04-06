# Аудит: части 015–025 (UIX и близость к «гигантам»)

Эталоны сравнения: **Telegram** (чаты), **Instagram** (лента/профиль/сториз), **WhatsApp** (простота звонков). Доки: `docs/UIX_SPECIALIST_GUIDE.md`, `docs/QUALITY_CHECKLIST.md`, `client/src/features/chat/pulse-template/DESIGN_RULES.md`.

---

<a id="part-015"></a>
## Часть 015 — Навигация и IA

**Наблюдения:** wouter-маршруты, нижнее меню с центральным логотипом (ПИНГОК long-press), разделение feed/chat/profile/settings.

**Сильные стороны:** Предсказуемые корневые разделы; deep links с whitelist.

**Зазоры:** Глубокие вложенности (пост в профиле, edge fullscreen) — проверить единый паттерн «Назад» и сохранение скролла.

### Metrics — Часть 015

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 (Telegram) |
| **Evidence** | `client/src/pages/`, `NavPulseCenterLogoButton`, `docs/EDGE_PRODUCT_SPEC.md` §навигация |

---

<a id="part-016"></a>
## Часть 016 — Чат: pulse-template vs ChatDetail

**Наблюдения:** Эталон в `pulse-template/` (Mobile/Desktop); прод — `ChatDetail` и `docs/CHAT_DETAIL_RULES.md` (только `send.*` / `actions.*`).

**Сильные стороны:** Явный контракт хуков; PULSE-компоненты переносятся по частям.

**Зазоры:** Визуальный паритет неполный — пользователь может ощущать «две версии» продукта; dev-маршруты `/dev/pulse-template` не должны расходиться с прод-логикой.

### Metrics — Часть 016

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 (Telegram) |
| **Evidence** | `features/chat/pulse-template/`, `docs/CHAT_DETAIL_RULES.md` |

---

<a id="part-017"></a>
## Часть 017 — Лента: карточки

**Наблюдения:** EDGE companion карточки с Embla/«delight» слоем (`features/edge-companion/feed-delight/`).

**Сильные стороны:** Продуманные микровзаимодействия; отдельный полноэкранный поток.

**Зазоры:** Плотность информации vs Instagram — не перегружать карточку; производительность списка при видео.

### Metrics — Часть 017

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Instagram) |
| **Evidence** | `features/edge-companion/`, `features/feed/` |

---

<a id="part-018"></a>
## Часть 018 — Профиль PULSE

**Наблюдения:** Параллакс обложки, кольцо сториз, вкладки, сетка постов, мемоизация счётчиков.

**Сильные стороны:** Высокий уровень полировки; разнесение на подкомпоненты с `memo`.

**Зазоры:** Время первой отрисовки на слабых устройствах; согласованность тёмной/светлой темы с глобальными настройками.

### Metrics — Часть 018

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Instagram) |
| **Evidence** | `features/profile/pulse-profile/`, `features/profile/user-profile/` |

---

<a id="part-019"></a>
## Часть 019 — UI звонков

**Наблюдения:** Оверлей входящего, контролы, интеграция с `CallContext`.

**Сильные стороны:** Документированные сценарии регрессии (`docs/CALLS_1TO1_RELEASE_CHECKLIST.md`).

**Зазоры:** Ясность состояния «соединяемся» vs «нет сети»; групповой UI сложнее эталона Zoom.

### Metrics — Часть 019

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 (WhatsApp) |
| **Evidence** | `features/call/`, `features/group-call/` |

---

<a id="part-020"></a>
## Часть 020 — Формы и ошибки

**Наблюдения:** Логин, настройки, создание поста — разные паттерны валидации.

**Сильные стороны:** TanStack Query даёт единый стиль refetch/error на многих экранах.

**Зазоры:** Тексты ошибок API не всегда человекочитаемы; нужен единый маппинг код→строка.

### Metrics — Часть 020

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 |
| **Evidence** | `features/auth/login/`, `components/ui/` |

---

<a id="part-021"></a>
## Часть 021 — Loading, empty, error

**Наблюдения:** Правила в `.cursor/rules/quality-first.mdc`: ListEmptyState, Skeleton, retry.

**Сильные стороны:** Явная договорённость в репо; много экранов уже следуют.

**Зазоры:** Регрессии на редких экранах (борд, админка); пустой экран при загрузке всё ещё возможен в старых ветках.

### Metrics — Часть 021

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Telegram) |
| **Evidence** | `docs/QUALITY_CHECKLIST.md`, `components/ui/empty`, `components/ui/skeleton` |

---

<a id="part-022"></a>
## Часть 022 — Доступность (a11y)

**Наблюдения:** aria-label на иконках в ряде мест; axe в dev (`main.tsx`).

**Сильные стороны:** Статусы исходящих с подписями в футере сообщения (см. журнал PROJECT_MAP).

**Зазоры:** Модалки и bottom sheets — фокус-ловушка и порядок tab; видео/сториз — субтитры/альтернативы.

### Metrics — Часть 022

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Green |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 |
| **Evidence** | `OutgoingMessageFooter.tsx`, Radix primitives |

---

<a id="part-023"></a>
## Часть 023 — Motion

**Наблюдения:** Константы `client/src/lib/motion`, `usePrefersReducedMotion`.

**Сильные стороны:** Единая договорённость в правилах Cursor.

**Зазоры:** Проверить все framer-motion участки на ветку reduced-motion; избегать layout-thrash в списках.

### Metrics — Часть 023

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 |
| **Evidence** | `client/src/lib/motion`, `framer-motion` usage grep |

---

<a id="part-024"></a>
## Часть 024 — Дизайн-система

**Наблюдения:** `components/ui/*` (Radix + Tailwind 4), токены touch-min.

**Сильные стороны:** Повторное использование примитивов; админская оболочка изолирована `[data-admin-shell]`.

**Зазоры:** Кастомные экраны борда/edge могут отходить от токенов — периодический визуальный аудит.

### Metrics — Часть 024

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 |
| **Evidence** | `client/src/components/ui/`, `features/admin-shell/` |

---

<a id="part-025"></a>
## Часть 025 — Паритет с мессенджерами (сводка UIX)

**Вывод:** Чаты и профиль близки к премиум-ожиданию; звонки и групповые сценарии ниже WhatsApp/Telegram по предсказуемости recovery; EDGE слой уникален — паритет с «гигантами» не применим, важна внутренняя консистентность.

### Metrics — Часть 025

| Метрика | Значение |
|---------|----------|
| **Coverage** | N/A (сводка) |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 1 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 (среднее по категориям) |
| **Evidence** | части 015–024 |
