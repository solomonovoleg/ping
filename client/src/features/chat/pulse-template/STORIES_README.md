# PULSE · MobileStoriesViewer — Документация

> Дизайн-система: PULSE messenger, 2040-эстетика  
> Компонент: Просмотр сторис · два режима  
> Версия: 1.0.0 · Март 2026

---

## Два режима одного компонента

| Режим | Описание |
|---|---|
| `"own"` | **Мои сторис** — аналитика, зрители, AI-инсайты |
| `"other"` | **Чужие сторис** — просмотр, ответ, реакции |

---

## Props

```ts
interface MobileStoriesViewerProps {
  initialMode?: "own" | "other";  // по умолч. "own"
  onClose?: () => void;           // вызывается при нажатии ✕
}
```

### Использование

```tsx
import { MobileStoriesViewer } from "@/features/chat/pulse-template";

// Мои сторис
<MobileStoriesViewer initialMode="own" onClose={() => setOpen(false)} />

// Чужие сторис
<MobileStoriesViewer initialMode="other" onClose={() => setOpen(false)} />
```

В dev откройте **`/dev/pulse-template/stories`** для предпросмотра в рамке 390px.

---

## Режим `"own"` — Мои сторис

### Что показывает

```
┌─────────────────────────────────────┐
│  ✕      ОС  •  Олег   ···   [Own]  │  ← хедер + toggle
│  ████████████████░░░░░░   9:41     │  ← прогресс сторис
│                                     │
│       [Story background]            │  ← градиентный фон сторис
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👁 DecayRing  · 47 зрителей │   │  ← живая панель аналитики
│  │ EmotionalSpectrum           │   │
│  │ StoryDNA score              │   │
│  │ AI Insights (3 подсказки)   │   │
│  │ [▲ Список зрителей]         │   │  ← slide-up список
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Под-компоненты (только в режиме own)

#### `DecayRing`
SVG-дуга таймера жизни сторис. Цвет меняется в зависимости от оставшегося времени:
- 🟢 > 67% времени — зелёный
- 🟡 33–67% — жёлтый  
- 🔴 < 33% — красный

```tsx
// Внутренний компонент, используется автоматически
// hoursLeft / totalHours управляют состоянием
```

#### `EmotionalSpectrum`
Горизонтальный bar-chart эмоций:

| Эмодзи | Эмоция | Цвет |
|---|---|---|
| 😍 | Восхищение | `#f43f5e` |
| 🤩 | Восторг | `#f97316` |
| 🔥 | Огонь | `#818cf8` |
| 😲 | Удивление | `#22d3ee` |

#### `StoryDNA Score`
Число от 0 до 100 — AI-метрика качества сторис. Анимируется при открытии (count-up).

#### Viewer List (slide-up)
Панель списка зрителей в трёх категориях:
- **Аналитики** (`#818cf8`) — топ-вовлечённые
- **Фанаты** (`#fb7185`) — постоянные зрители  
- **Новые** (`#22d3ee`) — впервые смотрят

---

## Режим `"other"` — Чужие сторис

### Что показывает

```
┌─────────────────────────────────────┐
│  ✕   [avatar] Имя · 47 зрителей    │  ← хедер
│  ████████████████░░░░░░             │  ← прогресс
│                                     │
│       [Story background]            │  ← контент сторис
│                                     │
│  🤖 AI Summary                      │  ← AI-резюме сторис
│                                     │
│  [Ответить…]  ❤️  ↗  🎤            │  ← reply bar
└─────────────────────────────────────┘
```

### Reply bar
- **Поле ответа** — `h-10` (40px), `white-space: nowrap`, `text-overflow: ellipsis`
- **Кнопки**: like (❤️), share (↗), mic (🎤) — каждая `w-10 h-10`

---

## Анимации

| Имя keyframe | Где используется | Параметры |
|---|---|---|
| `storiesReveal` | Открытие всего компонента | scale 0.92→1, opacity 0→1, 380мс ease-out |
| `slideUp` | Панель зрителей снизу | translateY 100%→0, 420мс ease-out |
| `fadeIn` | AI Summary, инсайты | opacity 0→1, 300мс |
| `avatarFloat` | Аватар в хедере | translateY ±2.5px, 4с ease-in-out |
| `pulseGlow` | Live-кружок зрителей | opacity 0.6→1, 1.5с |

---

## Дизайн-токены

```
Фон сторис:  linear-gradient(135deg, #1a0a2e, #0a1628, #0a1a0a)
IG градиент: linear-gradient(135deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)
Акцент:      #818cf8 (violet)
Стекло:      backdrop-blur-xl + rgba(0,0,0,0.4)
```

---

## Зависимости

```bash
npm install lucide-react
```

Иконки: `X`, `MoreHorizontal`, `Heart`, `Share2`, `Mic2`, `Eye`, `Flame`, `BarChart2`, `Clock`, `Info`, `ChevronUp`, `Sparkles`

---

## Файлы в репозитории

```
client/src/features/chat/pulse-template/
├── MobileStoriesViewer.tsx   ← эталонный компонент
└── STORIES_README.md         ← эта документация
```

---

## Интеграция в профиль

```tsx
// В MobileProfile.tsx:
const [storiesOpen, setStoriesOpen] = useState(false);

// Открытие при клике на аватар:
<button onClick={() => setStoriesOpen(true)}>
  {/* avatar */}
</button>

{storiesOpen && (
  <div className="absolute inset-0 z-50">
    <MobileStoriesViewer
      initialMode="own"
      onClose={() => setStoriesOpen(false)}
    />
  </div>
)}
```

---

MIT · PULSE Design System 2026
