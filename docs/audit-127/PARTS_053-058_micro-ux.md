# Аудит: части 053–058 (микро-улучшения UI)

Согласовано с `.cursor/rules/quality-first.mdc` и `docs/UIX_SPECIALIST_GUIDE.md`.

---

<a id="part-053"></a>
## Часть 053 — Тап, haptic, мгновенный отклик

**Идеи:** `active:scale` на критичных кнопках; Capacitor Haptics только на явное действие; избегать хаптика на скролле.

**Текущее:** Правила проекта задают стандарт; выборочная проверка экранов чата и ленты.

### Metrics — Часть 053

| Метрика | Значение |
|---------|----------|
| **Coverage** | 35% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 |
| **Evidence** | `.cursor/rules/quality-first.mdc` |

---

<a id="part-054"></a>
## Часть 054 — Скелетоны и пустые состояния

**Идеи:** Единый `Skeleton` pulse; `ListEmptyState` с одним CTA.

**Текущее:** Много экранов соответствует; регрессии на борде/edge.

### Metrics — Часть 054

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 |
| **Evidence** | `components/ui/skeleton`, `components/ui/empty` |

---

<a id="part-055"></a>
## Часть 055 — Анимации и lib/motion

**Идеи:** Только константы DURATION/EASING из `lib/motion`; reduced-motion ветка.

**Текущее:** Документировано в правилах; grep по `framer-motion` для аудита остатков.

### Metrics — Часть 055

| Метрика | Значение |
|---------|----------|
| **Coverage** | 35% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 |
| **Evidence** | `client/src/lib/motion` |

---

<a id="part-056"></a>
## Часть 056 — Списки и смена чата

**Идеи:** Сброс сообщений при смене `chatId`; не показывать старый заголовок с новым телом.

**Текущее:** Исправления в UNSTABLE для 404; виртуализация — см. `docs/CHAT_THREAD_VIRTUALIZATION.md`.

### Metrics — Часть 056

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Telegram) |
| **Evidence** | `docs/UNSTABLE_OR_POORLY_WORKING.md`, `docs/CHAT_THREAD_VIRTUALIZATION.md` |

---

<a id="part-057"></a>
## Часть 057 — Сеть: ошибки и retry

**Идеи:** `retryable` в JSON ошибках (`server/middleware/network`); клиентские повторы для идемпотентных GET.

**Текуще:** Timeout middleware на `/api`; не везде пользователь видит «Повторить».

### Metrics — Часть 057

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 |
| **Evidence** | `server/middleware/network/request-timeout-middleware.ts` |

---

<a id="part-058"></a>
## Часть 058 — Типографика и плотность

**Идеи:** Единая шкала `text-sm/base/lg` для тредов; минимум touch target `var(--uix-touch-min)`.

**Текуще:** Tailwind-токены; профиль PULSE плотнее ленты — осознанно.

### Metrics — Часть 058

| Метрика | Значение |
|---------|----------|
| **Coverage** | 35% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 |
| **Evidence** | `.cursor/rules/quality-first.mdc`, Tailwind theme |
