# Использование UIX-токенов

В проекте в `client/src/index.css` заданы переменные для единых **пропорций**, **типографики** и **motion**. Используйте их, чтобы интерфейс оставался консистентным (см. также **docs/DESIGN_SYSTEM.md** — архитектура дизайн-системы).

## Шкала отступов (spacing)

| Переменная       | Значение | Когда использовать |
|------------------|----------|--------------------|
| `--uix-space-1`   | 4px      | Минимальный зазор (между иконкой и текстом) |
| `--uix-space-2`   | 8px      | Внутри компактных блоков |
| `--uix-space-3`   | 12px     | Внутри карточек, между полями формы |
| `--uix-space-4`   | 16px     | Отступ контента от края экрана, между секциями |
| `--uix-space-5`   | 24px     | Между крупными блоками |
| `--uix-space-6`   | 32px     | Большие отступы |
| `--uix-space-7`   | 48px     | Крупные секции |
| `--uix-space-8`   | 64px     | Редко, для очень больших пауз |

**В Tailwind:** используйте произвольные значения, например:
- `p-[var(--uix-space-4)]` — padding 16px
- `gap-[var(--uix-space-3)]` — gap 12px
- `mb-[var(--uix-space-5)]` — margin-bottom 24px

Со временем можно заменить разрозненные `p-4`, `gap-2`, `px-4` на токены, чтобы везде был один ритм.

## Типографика

| Переменная                | Значение | Назначение |
|---------------------------|----------|------------|
| `--uix-text-title`        | 1.5rem (24px) | Заголовок экрана (Чаты, Лента, Настройки) |
| `--uix-text-list-primary` | 1rem (16px)   | Основной текст в списке (имя чата, имя пользователя) |
| `--uix-text-list-secondary` | 0.875rem (14px) | Вторичный текст (подпись, превью сообщения) |
| `--uix-text-caption`      | 0.75rem (12px) | Время, подсказки, мета-информация |
| `--uix-text-input`        | 1.0625rem (17px) | Поля ввода (как в iOS) |

**Пример в компоненте:**
```css
.screen-title { font-size: var(--uix-text-title); font-weight: 700; }
.list-primary { font-size: var(--uix-text-list-primary); }
.list-secondary { font-size: var(--uix-text-list-secondary); color: var(--color-muted-foreground); }
```

В JSX с Tailwind через произвольное значение:
```html
<h1 className="text-[length:var(--uix-text-title)] font-bold">Чаты</h1>
```

## Минимальная область касания

`--uix-touch-min: 44px` — минимальная высота/ширина кликабельной области для удобства и доступности. Кнопки и пункты списка лучше делать не меньше 44px по высоте.

Пример: `min-h-[var(--uix-touch-min)]` для кнопок и строк списка.

## Motion (длительность и easing)

| Переменная | Значение | Когда использовать |
|------------|----------|---------------------|
| `--uix-duration-fast` | 75ms | Hover, active, переключатели |
| `--uix-duration-normal` | 200ms | Открытие модалки, появление блока |
| `--uix-duration-slow` | 300ms | Более заметные переходы |
| `--uix-easing-out` | cubic-bezier(0.33, 1, 0.68, 1) | Выезд, масштаб |
| `--uix-easing-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | Симметричные переходы |

Пример: `transition: color var(--uix-duration-fast) var(--uix-easing-out);`

## Готовые классы (utility)

В `index.css` заданы классы, чтобы не дублировать значения:

| Класс | Назначение |
|-------|------------|
| `.uix-content-x` | Горизонтальный padding контента (16px) |
| `.uix-text-title` | Заголовок экрана (размер + bold) |
| `.uix-text-list-primary` | Основная строка списка |
| `.uix-text-list-secondary` | Вторичная строка (цвет muted) |
| `.uix-text-caption` | Время, подсказки |
| `.uix-text-input` | Размер текста в полях ввода |
| `.uix-list-row` | min-height 44px для строк списка |

Компонент **PageShell** (`components/layout/PageShell.tsx`) объединяет `.uix-content-x` и заголовок с `.uix-text-title`.
