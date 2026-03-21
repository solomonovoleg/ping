# PULSE · Чат — Дизайн-гайдлайн и правила реализации

## Файлы шаблона

| Файл | Назначение |
|---|---|
| `MessengerChatDark.tsx` | Десктоп 1-на-1 чат, тёмная тема, 1280×720 |
| `MessengerChatLight.tsx` | Десктоп 1-на-1 чат, светлая тема, 1280×720 |
| `MobileChatDark.tsx` | Мобильный чат, тёмная тема, 390×844, 8 настроений |
| `MobileChatLight.tsx` | Мобильный чат, светлая тема, 390×844, 8 настроений |

---

## Стек технологий

| Слой | Технология |
|---|---|
| UI-фреймворк | React 18 + TypeScript |
| Стилизация | Tailwind CSS v3 + inline `style={}` для динамики |
| Иконки | `lucide-react` строго (никаких замен) |
| Анимации | CSS `@keyframes` через `<style>` внутри компонента |
| SVG-паттерны | Инлайн `<svg>` с `<pattern>` — только так, без внешних файлов |
| Состояние | `useState` / `useEffect` / `useRef` — только React hooks |
| Шрифт | `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif` |

---

## Цветовая система

### Тёмная тема
```
Фон страницы:          #080810
Сайдбар:               rgba(10,10,22,0.97)
Граница сайдбара:      rgba(255,255,255,0.05)
Фон чата:              #080810
Входящий пузырь:       rgba(255,255,255,0.07)  (базовый, меняется с настроением)
Исходящий пузырь:      rgba(60,60,80,0.95)     (базовый, меняется с настроением)
Поле ввода:            rgba(255,255,255,0.04)
```

### Светлая тема
```
Фон страницы:          #eef1fb
Сайдбар:               rgba(255,255,255,0.85)
Граница сайдбара:      rgba(99,102,241,0.1)
Входящий пузырь:       rgba(255,255,255,0.9)
Исходящий пузырь:      rgba(99,102,241,0.85)
Поле ввода:            rgba(255,255,255,0.7)
```

### Акцент интерфейса
```
Индиго primary:  #6366f1 / #818cf8
Прочитано:       #a5b4fc (тёмная) / #6366f1 (светлая)
Online точка:    #4ade80 (зелёная, animate-pulse)
Ошибка/удаление: #f87171
```

---

## 8-Mood система (только мобильный чат)

Настроение меняет **всё** — цвет акцента, пузыри, SVG-паттерн фона, анимацию.  
Переключение **невидимое** — никаких видимых кнопок, только фоновое состояние.  
Переход между настроениями: `5s cubic-bezier(0.4,0,0.2,1)` на всех цветовых свойствах.

```typescript
type MoodKey = "casual"|"romantic"|"business"|"conflict"|"fun"|"relax"|"support"|"gaming";
```

| Ключ | Emoji | Акцент | Название |
|---|---|---|---|
| `casual` | 💬 | `#818cf8` | Нейтрал |
| `romantic` | 💕 | `#f472b6` | Романтика |
| `business` | 💼 | `#60a5fa` | Деловой |
| `conflict` | ⚡ | `#f87171` | Конфликт |
| `fun` | 🎉 | `#fb923c` | Веселье |
| `relax` | 🌊 | `#2dd4bf` | Релакс |
| `support` | 🤗 | `#c084fc` | Поддержка |
| `gaming` | 🎮 | `#4ade80` | Гейминг |

### Структура объекта настроения
```typescript
{
  label:       string;           // Название
  emoji:       string;           // Иконка-эмодзи
  bg:          string;           // (не используется, паттерн через MoodPattern)
  accentColor: string;           // Основной акцент
  accentGlow:  string;           // rgba(...) для box-shadow glow
  bubbleIn:    string;           // Цвет входящих пузырей
  bubbleOut:   string;           // Цвет исходящих пузырей
  animation:   "none"|"tense"|"playful"|"calm";
}
```

### Переходная строка (MT — Mood Transition)
```typescript
const MT = "color 5s cubic-bezier(0.4,0,0.2,1), background 5s cubic-bezier(0.4,0,0.2,1), border-color 5s cubic-bezier(0.4,0,0.2,1), box-shadow 5s cubic-bezier(0.4,0,0.2,1), fill 5s cubic-bezier(0.4,0,0.2,1), stroke 5s cubic-bezier(0.4,0,0.2,1), opacity 5s cubic-bezier(0.4,0,0.2,1)";
```
Применяется к **каждому** элементу, цвет которого зависит от настроения.

---

## SVG Mood Паттерны (MoodPattern)

Каждое настроение имеет уникальный SVG-паттерн фона — анимированный, очень тонкий.  
Компонент `<MoodPattern mood={mood} color={accentColor} />` абсолютно позиционируется в фоне чата.

| Настроение | Паттерн |
|---|---|
| `casual` | Диагональная штриховка + точечная сетка, opacity ~0.05 |
| `romantic` | Сердечки SVG, плавающие, opacity 0.06 |
| `business` | Тонкая сетка (grid), opacity 0.04 |
| `conflict` | Зигзаги/молнии, opacity 0.06 |
| `fun` | Конфетти-круги разных размеров, opacity 0.07 |
| `relax` | Волны (синусоида), opacity 0.05 |
| `support` | Звёздочки + круги, opacity 0.055 |
| `gaming` | Пиксельная сетка + ромбы, opacity 0.06 |

**ПРАВИЛО:** opacity паттернов должна быть `0.04–0.08` — едва видны, создают текстуру.

---

## Story Ring (аватар в хедере)

3-слойная структура вокруг аватара собеседника:

```
Слой 1 (внешний): conic-gradient(#818cf8, #c084fc, #f472b6, #38bdf8, #818cf8)
                  position: absolute, inset: -3px, borderRadius: 50%
                  animation: storyRingSpin 3s linear infinite

Слой 2 (зазор):   тёмная тема: #080810, светлая: #eef1fb
                  inset: -1px, borderRadius: 50%

Слой 3 (внутренний): цвет текущего настроения (accentColor)
                     плотно обёртывает аватар
```

### Keyframe
```css
@keyframes storyRingSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

---

## Анатомия пузыря сообщения

### Исходящий (outgoing)
- `border-radius: 18px 18px 4px 18px` (острый угол снизу-справа)
- Цвет: `MOODS[mood].bubbleOut` (меняется с настроением)
- Прочитано: компонент `ReadTick` — 2 маленькие пилюли (`width:14, height:3, borderRadius:99`)
- Время: мелкий текст, opacity ~0.5, в правом нижнем углу

### Входящий (incoming)
- `border-radius: 4px 18px 18px 18px` (острый угол снизу-слева)
- Цвет: `MOODS[mood].bubbleIn`

### Типы сообщений
1. **Текст** — обычный пузырь
2. **Голосовое** — waveform из 30 баров (`BARS` массив), кнопка Play/Pause, таймер
3. **Видео-кружок** — круглый превью (desktop) или прямоугольный (mobile), кнопка Play, длительность
4. **Фото** — скруглённое изображение-заглушка с иконкой
5. **AI-предложение** — пузырь с иконкой `Brain`, фиолетовый акцент

---

## Компонент ReadTick (прочитано)

```tsx
function ReadTick({ color }: { color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[0.55, 1].map((op, i) => (
        <div key={i} style={{
          width: 14, height: 3, borderRadius: 99,
          background: color, opacity: op,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}
```
Цвет передаётся динамически — соответствует акцентному цвету настроения.

---

## Waveform голосового сообщения

```typescript
const BARS = [3,5,8,12,9,14,10,6,11,15,8,5,13,9,4,7,12,10,6,14,9,5,11,8,15,7,4,10,13,6];
```
48 значений для десктопа, 30 для мобильного. Каждый бар `width:2px, borderRadius:2px`.  
При воспроизведении: пройденные бары — акцентный цвет, оставшиеся — `rgba(255,255,255,0.15)`.

---

## STT (Speech-to-Text) — только MobileChatDark

Машина состояний кнопки `!` (заменяет Smile в инпуте):

```
idle → (нажать) → stt-rec → (2500ms) → stt-transcribing → (3600ms) → idle
```

- `stt-rec`: индиго waveform + «Слушаю...» + анимированные бары
- `stt-transcribing`: слово за словом появляется текст (190+random*120ms на слово)
- `STT_WORDS_D = ["Можешь","скинуть","мне","макеты","в","высоком","качестве?"]`

---

## Компоновка десктоп-чата (MessengerChat*)

```
┌──────────────┬─────────────────────────────┐
│   SIDEBAR    │        CHAT AREA            │
│   260px      │                             │
│              │  ┌─── HEADER ───────────┐   │
│  Logo + поиск│  │  Аватар + имя + ст.  │   │
│              │  │  Звонок/Видео/Ещё    │   │
│  Список чатов│  └──────────────────────┘   │
│  (5 чатов)   │                             │
│              │  ┌─── MESSAGES ─────────┐   │
│              │  │  Входящие / исходящие│   │
│              │  │  AI suggestion       │   │
│              │  │  Smart Replies       │   │
│              │  └──────────────────────┘   │
│  NAV BAR     │  ┌─── INPUT BAR ────────┐   │
│  (5 иконок)  │  │  + / Smile / Mic     │   │
│              │  └──────────────────────┘   │
└──────────────┴─────────────────────────────┘
```

---

## Компоновка мобильного чата (MobileChat*)

```
┌──────────────────────────────┐  390px
│  STATUS BAR (9:41, Battery)  │
├──────────────────────────────┤
│  ← Назад  [Story Ring + Аватар]  Имя / статус  📞 📹 ⋮  │
├──────────────────────────────┤
│                              │
│  SVG MOOD PATTERN (фон)      │
│                              │
│  MESSAGES AREA               │
│  (пузыри чередуются)         │
│                              │
├──────────────────────────────┤
│  Smart Replies (если есть)   │
├──────────────────────────────┤
│  [+]  [Инпут]  [! STT] [🎤]  │
└──────────────────────────────┘
```

---

## Навигация (сайдбар десктопа)

5 пунктов: `MessageCircle | LayoutList | PULSE (центр) | LayoutGrid | Settings`  
Центральный элемент «PULSE» — логотип без иконки, всегда неактивен как nav-item.  
Активный пункт: акцентный цвет + glow. Неактивный: opacity ~0.35.

---

## Статусы собеседника (цикл)

```typescript
const STATUS_LIST = [
  "В сети",
  "Печатает...",
  "Записывает голосовое",
  "В сети",
  "Записывает видео",
  "В сети",
];
```
Цикл через `useEffect` + `setInterval` каждые 3–4 секунды.

---

## Keyframes (обязательные)

```css
/* Паттерны дрейфуют очень медленно */
@keyframes patDrift1 { from{transform:translate(0,0)} to{transform:translate(36px,36px)} }
@keyframes patDrift2 { from{transform:translate(0,0)} to{transform:translate(-24px,24px)} }
@keyframes patDrift3 { from{transform:translate(0,0)} to{transform:translate(48px,-24px)} }

/* Анимации настроений */
@keyframes tensePulse  { 0%,100%{opacity:0.04} 50%{opacity:0.09} }
@keyframes playfulBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes calmFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }

/* Story ring */
@keyframes storyRingSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

/* Swipe reply */
@keyframes replyBounce { 0%{transform:scale(0.7)} 60%{transform:scale(1.15)} 100%{transform:scale(1)} }
```

---

## Свайп-ответ (Swipe to Reply)

- Порог начала: `translateX > 0` (только вправо для входящих, влево для исходящих)
- Активация иконки Reply: при `translateX >= 45px`
- Пружинный возврат при отпускании: `transition: transform 0.3s spring`
- Максимальный сдвиг: `90px`
- При активации: haptic feedback (если нативно), иконка Reply с анимацией `replyBounce`

---

## Контекстное меню сообщения (MessageContextMenu)

Появляется при долгом нажатии (mobile) или ПКМ (desktop):

```
[😊 Реакция] [↩ Ответить] [📋 Копировать] [➡ Переслать] [🗑 Удалить]
```

- Стиль: glass card, `backdrop-blur(20px)`, `border-radius: 16px`
- Позиция: выше сообщения с небольшим отступом
- Закрытие: клик вне области

---

## Smart Replies

3 варианта быстрых ответов, показываются только для последнего входящего:  
`["Буду! 🙌", "Уже знаю", "Напомни завтра"]`  
Стиль: пилюли с рамкой цвета акцента, при нажатии — заполняют инпут.

---

## AI Suggestion (мессенджер)

Пузырь с иконкой `Brain` из lucide-react:
- Фон: `rgba(139,92,246,0.1)` + рамка `rgba(139,92,246,0.25)`
- Цвет текста: `#c4b5fd`
- Подпись: «AI предлагает» с анимированной точкой

---

## Строгие запреты (НЕЛЬЗЯ)

1. **НЕЛЬЗЯ** менять `border-radius` пузырей — `18px 18px 4px 18px` и `4px 18px 18px 18px`
2. **НЕЛЬЗЯ** убирать 5-секундный переход при смене настроения — это ключевой эффект
3. **НЕЛЬЗЯ** делать видимые кнопки переключения настроений — только скрытый механизм
4. **НЕЛЬЗЯ** использовать другую библиотеку иконок вместо `lucide-react`
5. **НЕЛЬЗЯ** менять фон страницы: тёмная `#080810`, светлая `#eef1fb`
6. **НЕЛЬЗЯ** убирать SVG mood-паттерны из мобильного чата
7. **НЕЛЬЗЯ** убирать story ring с аватара — 3 слоя обязательны
8. **НЕЛЬЗЯ** делать скроллбар видимым — `scrollbarWidth: "none"` везде
9. **НЕЛЬЗЯ** менять шрифт — только системный стек с Inter
10. **НЕЛЬЗЯ** использовать `border-radius` меньше `12px` на карточках и пузырях
11. **НЕЛЬЗЯ** делать фоны непрозрачными в overlay-элементах — только rgba + backdrop-blur
12. **НЕЛЬЗЯ** менять компонент `ReadTick` — 2 пилюли строго, без галочек
13. **НЕЛЬЗЯ** убирать glow у активного акцентного элемента (`box-shadow: 0 0 Xpx accentGlow`)
14. **НЕЛЬЗЯ** менять скорость анимации story ring — `3s linear infinite`

---

## Зависимости

```json
{
  "lucide-react": "latest",
  "react": "^18",
  "react-dom": "^18",
  "tailwindcss": "^3",
  "@radix-ui/react-avatar": "latest"
}
```

Компонент `Avatar` / `AvatarFallback` — из `@radix-ui/react-avatar`.  
Утилита `cn()`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
