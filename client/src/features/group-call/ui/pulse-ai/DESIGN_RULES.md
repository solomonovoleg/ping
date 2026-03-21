# PULSE · AI Групповой звонок — Дизайн-гайдлайн и правила реализации

## Стек технологий

| Слой | Технология |
|---|---|
| UI-фреймворк | React 18 + TypeScript |
| Стилизация | Tailwind CSS v3 (utility-first) + inline `style={}` для динамических значений |
| Иконки | `lucide-react` (строго этот пакет, никаких замен) |
| Анимации | CSS `@keyframes` через `<style dangerouslySetInnerHTML>` внутри компонента |
| Состояние | `useState` / `useEffect` / `useRef` / `useCallback` — только React hooks, без Zustand/Redux |
| Контекст темы | `createContext` / `useContext` — объект `Th` передаётся через `ThCtx.Provider` |
| Шрифт | `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif` |

---

## Цветовая система

### Тёмная тема (основная)
```
Фон страницы:        #080810
Фон тайлов:          #0a0a14
Фон тайлов (видео):  radial-gradient(ellipse, {color}20, #0c0c18)
Ambient overlay:     radial-gradient(ellipse 90% 70%, rgba(60,50,140,0.1), #080810)
Панель AI:           rgba(9,9,18,0.94) + backdrop-blur-xl
Пилюли контролов:    rgba(255,255,255,0.025)
```

### Светлая тема
```
Фон страницы:        #e8ecf9
Фон тайлов:          #cdd4ed
Панель AI:           rgba(245,247,255,0.97)
Пилюли контролов:    rgba(255,255,255,0.88)
```

### Акцентные цвета участников (НЕЛЬЗЯ МЕНЯТЬ)
```
Алиса   #818cf8  (indigo)
Максим  #34d399  (emerald)
Анна    #f472b6  (pink)
Денис   #fb923c  (orange)
Вы      #a78bfa  (violet)
```

### Акцент интерфейса
```
Indigo primary:  #6366f1
Violet AI:       #8b5cf6  / #c4b5fd
Опасность:       #ef4444  / rgba(239,68,68,...)
Живой индикатор: #34d399 (emerald-400) с animate-pulse
```

---

## Стеклянный морфизм (Glass Morphism) — правила

```
backdrop-filter: blur(20px) — контролы внизу
backdrop-filter: blur(24px) — панель AI
backdrop-filter: blur(18px) — субтитры
backdrop-filter: blur(12px) — топ-бар пилюли

ОБЯЗАТЕЛЬНО: полупрозрачный фон (rgba) + backdrop-blur + тонкая рамка rgba
ЗАПРЕЩЕНО:   сплошной непрозрачный фон для overlay-элементов
```

---

## Компоновка экрана

```
┌─────────────────────────────────────┬──────────┐
│  TOP BAR (logo + info + controls)   │          │
├─────────────────────────────────────┤  AI      │
│                                     │  PANEL   │
│         VIDEO AREA                  │  280px   │
│    (grid / spotlight / screenshare) │          │
│                                     │  (скры-  │
│         CAPTIONS OVERLAY            │  вается  │
│                                     │  анимац.)│
├─────────────────────────────────────┤          │
│       BOTTOM CONTROLS BAR           │          │
└─────────────────────────────────────┴──────────┘
```

- Всё в `h-screen w-full` — занимает 100% вьюпорта
- AI-панель: `w-[280px]`, анимация `duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]`
- Скрытие UI: `opacity-0 translate-y-4 pointer-events-none` (нижний бар) / `-translate-y-4` (верхний)

---

## Режимы отображения (ViewMode)

| Режим | Описание |
|---|---|
| `grid` | 2×2 сетка, все 4 участника (без self), клик → spotlight |
| `spotlight` | Главный спикер во весь экран + боковая полоска со всеми |
| `screenshare` | Фейковый Figma-экран слева + стрип участников справа |

**ПРАВИЛО:** при смене режима — нет перезагрузки, только условный рендер через `{viewMode === "..."}`.

---

## Тайл участника (Tile)

Три варианта: `card` | `strip` | `mini`

### Обязательные элементы тайла
1. **Glow blob** — `radial-gradient` размытый кружок с цветом участника
2. **Аватар** — инициалы, `border: 2px solid {color}30`, `background: {color}22`
3. **Бейдж имени** (bottom-left) — стекло + микрофон (если выкл — `MicOff` красный) + имя + bars
4. **Бейдж настроения** (top-right) — только для не-self, только `card` и `strip`
5. **Speaking ring** — `animation: speakRing 2s infinite` при highlighted

### Настроения (Mood)
```
speaking   → #818cf8  "Говорит"
engaged    → #34d399  "Вовлечён"
calm       → #60a5fa  "Слушает"
distracted → #f87171  "Отвлечён"
```

---

## Speaking Bars

5 вертикальных баров `width: 2px, borderRadius: 2px`.  
Активные: `animation: barPop 0.85s ease-in-out {i*0.11}s infinite alternate`  
Неактивные: высота `3px`, цвет `rgba(255,255,255,0.18)` (тёмная) / `rgba(30,30,70,0.2)` (светлая)

---

## Кнопки управления (Bottom Controls)

- Пилюля: `rounded-full`, backdrop-blur, тонкая рамка
- Каждая кнопка: `w-[50px] h-[50px] rounded-full`
- Между кнопками: разделитель `w-px h-3.5`
- Активное состояние: glow `boxShadow: 0 0 14px {color}55` + фон `{color}22` + рамка `{color}44`
- Кнопка завершить: `radial-gradient(circle at 42% 30%, rgba(255,80,80,0.95), rgba(185,18,18,0.92))` + блик сверху
- `active:scale-90` на всех кнопках

---

## AI-панель

3 вкладки: `analytics` | `topics` | `actions`  
Активная: `background: rgba(139,92,246,0.22)`, `color: #c4b5fd`, рамка фиолетовая  
Неактивная: прозрачный фон

Индикатор LIVE: `#34d399` кружок + `animate-pulse`

---

## Субтитры (CaptionsOverlay)

- 3 последних строки, старые полупрозрачные (`opacity: 0.33 / 0.21`)
- Активная строка: полная непрозрачность + `animation: captionFade 0.35s`
- Мигающий курсор: `animation: captionCursor 0.9s infinite alternate`
- Позиция: `bottom: 90px`, `max-width: 680px`
- Бейдж «Живые субтитры · AI» + `Captions` иконка + зелёная точка

---

## Keyframes (обязательные)

```css
@keyframes barPop    { from{transform:scaleY(0.4)} to{transform:scaleY(1.6)} }
@keyframes speakRing {
  0%   { box-shadow: 0 0 0 0   rgba(129,140,248,0.7), 0 0 0 0   rgba(129,140,248,0.2) }
  60%  { box-shadow: 0 0 0 4px rgba(129,140,248,0.15),0 0 0 9px rgba(129,140,248,0.06) }
  100% { box-shadow: 0 0 0 8px rgba(129,140,248,0),   0 0 0 16px rgba(129,140,248,0) }
}
@keyframes captionFade   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes captionCursor { from{opacity:0.2} to{opacity:1} }
```

---

## Строгие запреты (НЕЛЬЗЯ)

1. **НЕЛЬЗЯ** менять цвета участников (`#818cf8`, `#34d399`, `#f472b6`, `#fb923c`, `#a78bfa`)
2. **НЕЛЬЗЯ** менять фон страницы `#080810` (тёмная) / `#e8ecf9` (светлая)
3. **НЕЛЬЗЯ** убирать `backdrop-filter: blur` с панелей и контролов
4. **НЕЛЬЗЯ** использовать другую библиотеку иконок вместо `lucide-react`
5. **НЕЛЬЗЯ** добавлять внешние CSS-файлы — только Tailwind + inline style
6. **НЕЛЬЗЯ** делать кнопки без `active:scale-90`
7. **НЕЛЬЗЯ** менять размеры: тайл аватара `card=56px`, `strip=40px`, `mini=28px`
8. **НЕЛЬЗЯ** убирать speaking ring анимацию у активного спикера
9. **НЕЛЬЗЯ** менять ширину AI-панели `280px`
10. **НЕЛЬЗЯ** менять font-family — только системный стек с Inter
11. **НЕЛЬЗЯ** заменять `ThCtx` контекст другим механизмом передачи темы
12. **НЕЛЬЗЯ** добавлять скроллбар в основной области — `scrollbarWidth: "none"` везде

---

## Зависимости (package.json)

```json
{
  "lucide-react": "latest",
  "react": "^18",
  "react-dom": "^18",
  "tailwindcss": "^3"
}
```

Компонент не требует никаких дополнительных пакетов кроме указанных.  
`cn()` — утилита из `clsx` + `tailwind-merge`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
