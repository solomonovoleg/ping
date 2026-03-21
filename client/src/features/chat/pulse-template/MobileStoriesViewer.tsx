import { useState, useEffect } from "react";
import {
  X,
  Heart,
  MoreHorizontal,
  Eye,
  Zap,
  Brain,
  TrendingUp,
  Clock,
  Mic,
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

const ACCENT  = "#818cf8";
const ACCENT2 = "#a78bfa";
const IG_GRAD = "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)";

const OWN_STORIES = [
  {
    bg: "radial-gradient(ellipse at 28% 22%, #4338ca 0%, #1e1b4b 42%, #080610 100%)",
    glow: "#818cf8",
    headline: "PULSE 2040",
    sub: "Будущее коммуникаций здесь",
    emoji: "🚀",
    tag: "Продукт",
  },
  {
    bg: "radial-gradient(ellipse at 72% 28%, #be185d 0%, #4c1d3e 42%, #130309 100%)",
    glow: "#fb7185",
    headline: "AI внутри",
    sub: "Понимает без слов",
    emoji: "🧠",
    tag: "Технологии",
  },
  {
    bg: "radial-gradient(ellipse at 50% 78%, #0369a1 0%, #0c3052 42%, #020d1a 100%)",
    glow: "#38bdf8",
    headline: "Новый интерфейс",
    sub: "Живой и адаптивный",
    emoji: "✨",
    tag: "Дизайн",
  },
];

const OTHER_STORIES = [
  {
    bg: "radial-gradient(ellipse at 62% 18%, #065f46 0%, #052e1c 42%, #010e07 100%)",
    glow: "#34d399",
    headline: "Токио",
    sub: "Аэропорт Ханэда · только что",
    emoji: "🗼",
    tag: "Путешествие",
  },
  {
    bg: "radial-gradient(ellipse at 38% 68%, #7c2d12 0%, #3a0f04 42%, #110401 100%)",
    glow: "#fb923c",
    headline: "Закат",
    sub: "Момент из путешествия",
    emoji: "🌅",
    tag: "Фото",
  },
];

const VIEWER_GROUPS = [
  { label: "🧠 Аналитики", count: 3, desc: "изучают детально",      color: "#818cf8" },
  { label: "❤️ Фанаты",    count: 8, desc: "смотрят всё подряд",    color: "#fb7185" },
  { label: "👀 Новые",     count: 5, desc: "первый раз в профиле",  color: "#22d3ee" },
];

const CATEGORY_COLOR: Record<string, string> = {
  "Аналитики": "#818cf8",
  "Фанаты":    "#fb7185",
  "Новые":     "#22d3ee",
};

const VIEWERS = [
  { name: "alex_k",    initials: "АК", color: "#818cf8", time: "2мин",  reaction: "❤️",  category: "Фанаты"    },
  { name: "maria_d",   initials: "МД", color: "#fb7185", time: "5мин",  reaction: "🔥",  category: "Аналитики" },
  { name: "ivan_pro",  initials: "ИВ", color: "#22d3ee", time: "9мин",  reaction: null,  category: "Новые"     },
  { name: "kate_s",    initials: "КС", color: "#a78bfa", time: "12мин", reaction: "😍",  category: "Фанаты"    },
  { name: "denis_r",   initials: "ДР", color: "#34d399", time: "16мин", reaction: null,  category: "Новые"     },
  { name: "svetlana",  initials: "СВ", color: "#fbbf24", time: "21мин", reaction: "❤️",  category: "Фанаты"    },
  { name: "max_design",initials: "МА", color: "#f472b6", time: "28мин", reaction: "🔥",  category: "Аналитики" },
  { name: "yana_k",    initials: "ЯК", color: "#60a5fa", time: "33мин", reaction: null,  category: "Аналитики" },
];

const AI_INSIGHTS = [
  "Охват на 42% выше вашего среднего · Пик в 14:23",
  "Этот сторис в топ-6% по удержанию аудитории",
  "91% досмотрели до конца · рекорд профиля",
];

/* ══════════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

/* Decay Ring — показывает сколько осталось до удаления (14ч из 24ч) */
function DecayRing({ hoursLeft = 14, totalHours = 24 }: { hoursLeft?: number; totalHours?: number }) {
  const frac = hoursLeft / totalHours;
  const R = 16;
  const C = 2 * Math.PI * R;
  const urgent = frac < 0.25;
  const color = urgent ? "#ef4444" : frac < 0.5 ? "#fbbf24" : ACCENT;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 38, height: 38 }}>
      <svg width="38" height="38" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="19" cy="19" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle cx="19" cy="19" r={R} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{hoursLeft}ч</span>
      </div>
    </div>
  );
}

/* Emotional Spectrum — bar с распределением реакций */
function EmotionalSpectrum() {
  const segments = [
    { emoji: "❤️", pct: 44, color: "#fb7185" },
    { emoji: "🔥", pct: 33, color: "#fb923c" },
    { emoji: "😍", pct: 14, color: "#818cf8" },
    { emoji: "😮", pct:  9, color: "#22d3ee" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Brain style={{ width: 11, height: 11, color: ACCENT }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>ЭМОЦИОНАЛЬНЫЙ СПЕКТР</span>
      </div>
      {/* Bar */}
      <div className="flex rounded-full overflow-hidden" style={{ height: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, background: s.color, opacity: 0.82, transition: "width 0.6s ease" }} />
        ))}
      </div>
      {/* Legend */}
      <div className="flex gap-3">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span style={{ fontSize: 11 }}>{s.emoji}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Story DNA score */
function StoryDNA({ percentile = 94 }: { percentile?: number }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
      style={{ background: `${ACCENT}14`, border: `1px solid ${ACCENT}35` }}>
      <div className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 36, height: 36, background: `${ACCENT}22` }}>
        <Zap style={{ width: 16, height: 16, color: ACCENT }} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>
          Story DNA · {percentile}-й перцентиль
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.42)" }}>
          Лучше чем {percentile}% ваших историй
        </span>
      </div>
      <div className="ml-auto flex flex-col items-center">
        <span style={{ fontSize: 20, fontWeight: 900, color: ACCENT, letterSpacing: "-0.04em", lineHeight: 1 }}>{percentile}</span>
        <span style={{ fontSize: 8, color: ACCENT + "88", fontWeight: 600 }}>балл</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

interface StoriesViewerProps {
  initialMode?: "own" | "other";
  onClose?: () => void;
}

export function MobileStoriesViewer({ initialMode = "own", onClose }: StoriesViewerProps = {}) {
  const [mode, setMode]             = useState<"own" | "other">(initialMode);
  const [storyIdx, setStoryIdx]     = useState(0);
  const [progress, setProgress]     = useState(0);         // 0–1 within current story
  const [paused, setPaused]         = useState(false);
  const [viewerPanel, setViewerPanel] = useState(false);   // slide-up analytics
  const [liked, setLiked]           = useState(false);
  const [likeAnim, setLikeAnim]     = useState(false);
  const [muted, setMuted]           = useState(false);
  const [liveCount]                 = useState(2);         // live viewers count
  const [insightIdx, setInsightIdx] = useState(0);

  const stories = mode === "own" ? OWN_STORIES : OTHER_STORIES;
  const story   = stories[storyIdx] ?? stories[0];
  const DURATION = 5000; // ms per story

  /* Auto-advance progress */
  useEffect(() => {
    if (paused || viewerPanel) return;
    const interval = 80;
    const step = interval / DURATION;
    const t = setInterval(() => {
      setProgress(p => {
        if (p + step >= 1) {
          // next story
          setStoryIdx(i => {
            const next = i + 1;
            if (next >= stories.length) return i; // stay on last
            return next;
          });
          return 0;
        }
        return p + step;
      });
    }, interval);
    return () => clearInterval(t);
  }, [paused, viewerPanel, stories.length]);

  /* Reset progress on story change */
  useEffect(() => { setProgress(0); }, [storyIdx]);

  /* Reset state on mode change */
  useEffect(() => {
    setStoryIdx(0);
    setProgress(0);
    setViewerPanel(false);
    setLiked(false);
  }, [mode]);

  /* Rotate AI insights */
  useEffect(() => {
    const t = setInterval(() => setInsightIdx(i => (i + 1) % AI_INSIGHTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const totalViewers = VIEWERS.length;

  const handleLike = () => {
    setLiked(v => !v);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);
  };

  const tapLeft  = () => { if (storyIdx > 0) { setStoryIdx(i => i - 1); setProgress(0); } };
  const tapRight = () => {
    if (storyIdx < stories.length - 1) { setStoryIdx(i => i + 1); setProgress(0); }
  };

  return (
    <div className="relative select-none"
      style={{
        width: 390, height: 844,
        background: "#000",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter',sans-serif",
        overflow: "hidden",
      }}>

      <style>{`
        @keyframes heartPop {
          0%   { transform: scale(1);    opacity: 1; }
          40%  { transform: scale(1.55); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes liveBlip {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.4; transform:scale(0.8); }
        }
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        @keyframes glowPulse {
          0%,100% { opacity: 0.35; }
          50%     { opacity: 0.7; }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes insightSlide {
          0%   { opacity:0; transform:translateY(4px); }
          15%  { opacity:1; transform:translateY(0); }
          85%  { opacity:1; transform:translateY(0); }
          100% { opacity:0; transform:translateY(-4px); }
        }
      `}</style>

      {/* ── STORY BACKGROUND ─────────────────────────── */}
      <div className="absolute inset-0" key={`${mode}-${storyIdx}`}
        style={{ background: story.bg, transition: "background 0.4s ease" }}>

        {/* Glow blobs */}
        <div className="absolute" style={{
          width: 260, height: 260,
          top: "15%", left: "50%", transform: "translateX(-50%)",
          background: story.glow,
          borderRadius: "50%",
          filter: "blur(90px)",
          opacity: 0.25,
          animation: "glowPulse 3s ease-in-out infinite",
        }} />

        {/* Abstract geometry */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.12 }}>
          <circle cx="195" cy="320" r="180" fill="none" stroke="white" strokeWidth="0.8" />
          <circle cx="195" cy="320" r="120" fill="none" stroke="white" strokeWidth="0.5" />
          <circle cx="195" cy="320" r="60"  fill="none" stroke="white" strokeWidth="0.4" />
          <line x1="15"  y1="320" x2="375" y2="320" stroke="white" strokeWidth="0.4" />
          <line x1="195" y1="140" x2="195" y2="500" stroke="white" strokeWidth="0.4" />
        </svg>

        {/* Holographic shimmer overlay */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.04) 100%)",
        }} />
      </div>

      {/* ── GRADIENT OVERLAYS ────────────────────────── */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 200, background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)" }} />
      <div className="absolute bottom-0 left-0 right-0" style={{ height: 280, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)" }} />

      {/* ── TAP ZONES ────────────────────────────────── */}
      <div className="absolute inset-0 flex" style={{ zIndex: 5 }}>
        <div className="flex-1 h-full" onClick={tapLeft}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
        <div className="flex-1 h-full" onClick={tapRight}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
      </div>

      {/* ══════════════════════════════════════════════
          TOP CHROME
          ══════════════════════════════════════════════ */}
      <div className="absolute left-0 right-0" style={{ top: 0, zIndex: 20 }}>

        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1">
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>9:41</span>
          <div className="flex items-center gap-1.5">
            {[4,3,2,1].map(i => (
              <div key={i} style={{ width: 3, height: 3+i*2, borderRadius: 1, background: i > 1 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)" }} />
            ))}
            <div style={{ width: 22, height: 11, border: "1px solid rgba(255,255,255,0.7)", borderRadius: 3, display:"flex", alignItems:"center", marginLeft: 4 }}>
              <div style={{ width: 14, height: 7, background: "rgba(255,255,255,0.82)", margin: "0 1px", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="flex gap-1 px-3 mb-2">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 rounded-full overflow-hidden"
              style={{ height: 2.5, background: "rgba(255,255,255,0.22)" }}>
              <div className="h-full rounded-full"
                style={{
                  width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%",
                  background: "rgba(255,255,255,0.92)",
                  transition: "width 0.08s linear",
                  boxShadow: i === storyIdx ? "0 0 6px rgba(255,255,255,0.6)" : "none",
                }} />
            </div>
          ))}
        </div>

        {/* Author row */}
        {mode === "own" ? (
          /* ── My story header ── */
          <div className="flex items-center px-4 py-1">
            <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
              <div className="absolute inset-[-2px] rounded-xl" style={{ background: IG_GRAD }} />
              <div className="absolute inset-[-0.5px] rounded-[10px]" style={{ background: "rgba(0,0,0,0.3)" }} />
              <div className="relative z-10 w-full h-full rounded-[9px] flex items-center justify-center font-black text-xs"
                style={{ background: "rgba(30,20,80,0.8)", color: ACCENT }}>ОС</div>
            </div>
            <div className="ml-2.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "white" }}>Олег Соломонов</span>
                <div className="flex items-center justify-center rounded-full" style={{ width: 14, height: 14, background: ACCENT }}>
                  <span style={{ fontSize: 8, color: "white", fontWeight: 900 }}>✓</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>Мой сторис · {["только что","1мин","3мин"][storyIdx]}</span>
                <div className="flex items-center gap-1">
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3ee", animation: "liveBlip 1.2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 9.5, color: "#22d3ee", fontWeight: 600 }}>{liveCount} смотрят</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <DecayRing hoursLeft={14 - storyIdx * 4} />
              <button className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
                onClick={() => setMuted(m => !m)}>
                {muted
                  ? <VolumeX style={{ width: 13, height: 13, color: "rgba(255,255,255,0.7)" }} />
                  : <Volume2  style={{ width: 13, height: 13, color: "rgba(255,255,255,0.7)" }} />}
              </button>
              <button className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <MoreHorizontal style={{ width: 15, height: 15, color: "rgba(255,255,255,0.8)" }} />
              </button>
              <button onClick={() => onClose?.()}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.8)" }} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Other's story header ── */
          <div className="flex items-center px-4 py-1">
            <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
              <div className="absolute inset-[-2px] rounded-xl" style={{ background: IG_GRAD }} />
              <div className="absolute inset-[-0.5px] rounded-[10px]" style={{ background: "rgba(0,0,0,0.25)" }} />
              <div className="relative z-10 w-full h-full rounded-[9px] flex items-center justify-center font-black text-xs"
                style={{ background: "rgba(5,45,20,0.85)", color: "#34d399" }}>МД</div>
            </div>
            <div className="ml-2.5 flex-1">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "white" }}>maria_design</span>
                <div className="flex items-center justify-center rounded-full" style={{ width: 14, height: 14, background: "#34d399" }}>
                  <span style={{ fontSize: 8, color: "white", fontWeight: 900 }}>✓</span>
                </div>
              </div>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>
                {["только что · Токио", "2 часа назад"][storyIdx]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 rounded-full text-white"
                style={{ fontSize: 11.5, fontWeight: 700, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                Подписаться
              </button>
              <button onClick={() => onClose?.()}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.8)" }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          STORY CONTENT (center)
          ══════════════════════════════════════════════ */}
      <div className="absolute left-0 right-0 flex flex-col items-center justify-center gap-3"
        style={{ top: "28%", zIndex: 10, pointerEvents: "none" }}>

        {/* Tag pill */}
        <div className="px-3 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.18)",
            animation: "fadeIn 0.5s ease",
          }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.06em" }}>
            {story.tag.toUpperCase()}
          </span>
        </div>

        {/* Emoji */}
        <span style={{ fontSize: 64, lineHeight: 1, animation: "fadeIn 0.5s ease 0.1s both", filter: "drop-shadow(0 0 20px rgba(255,255,255,0.3))" }}>
          {story.emoji}
        </span>

        {/* Headline */}
        <h1 style={{
          fontSize: 42, fontWeight: 900, color: "white",
          letterSpacing: "-0.04em", lineHeight: 1, textAlign: "center",
          textShadow: `0 0 40px ${story.glow}88, 0 2px 20px rgba(0,0,0,0.5)`,
          animation: "fadeIn 0.5s ease 0.15s both",
        }}>
          {story.headline}
        </h1>

        {/* Sub */}
        <p style={{
          fontSize: 15, color: "rgba(255,255,255,0.65)", fontWeight: 500, textAlign: "center",
          animation: "fadeIn 0.5s ease 0.2s both",
        }}>
          {story.sub}
        </p>
      </div>

      {/* ══════════════════════════════════════════════
          BOTTOM — OWN MODE
          ══════════════════════════════════════════════ */}
      {mode === "own" && !viewerPanel && (
        <div className="absolute left-0 right-0" style={{ bottom: 0, zIndex: 20 }}>

          {/* AI Insight strip */}
          <div className="mx-4 mb-3 px-3 py-2 rounded-2xl flex items-center gap-2.5"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(16px)", border: `1px solid ${ACCENT}30` }}>
            <Brain style={{ width: 13, height: 13, color: ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.72)", fontWeight: 500, animation: "insightSlide 4s ease infinite", flex: 1 }}>
              {AI_INSIGHTS[insightIdx]}
            </span>
            <TrendingUp style={{ width: 12, height: 12, color: "#34d399", flexShrink: 0 }} />
          </div>

          {/* Stats bar */}
          <div className="mx-4 mb-3 flex items-center gap-4">
            {/* Viewers pill */}
            <button
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl flex-1"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)" }}
              onClick={() => setViewerPanel(true)}>
              {/* Mini avatars */}
              <div className="flex items-center" style={{ gap: 0 }}>
                {VIEWERS.slice(0,3).map((v, i) => (
                  <div key={i} className="flex items-center justify-center rounded-full font-bold"
                    style={{ width: 20, height: 20, fontSize: 7, color: "white", background: v.color, border: "1.5px solid rgba(0,0,0,0.5)", marginLeft: i > 0 ? -7 : 0, zIndex: 3-i, position:"relative" }}>
                    {v.initials}
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-start gap-0">
                <span style={{ fontSize: 13, fontWeight: 800, color: "white", lineHeight: 1 }}>{totalViewers}</span>
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>просмотров</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Eye style={{ width: 12, height: 12, color: "rgba(255,255,255,0.4)" }} />
                <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>детали →</span>
              </div>
            </button>

            {/* Story DNA badge */}
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-2xl flex-shrink-0"
              style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}40`, backdropFilter: "blur(16px)" }}>
              <Zap style={{ width: 13, height: 13, color: ACCENT }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>94-й</span>
            </button>
          </div>

          {/* Swipe-up hint */}
          <button className="w-full flex flex-col items-center pb-8 pt-1 gap-1"
            onClick={() => setViewerPanel(true)}>
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 3.5, height: 3.5, borderRadius:"50%", background:"rgba(255,255,255,0.35)", animation:`liveBlip 1.4s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontWeight: 600, letterSpacing: "0.04em" }}>
              АНАЛИТИКА · ПРОВЕСТИ ВВЕРХ
            </span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          BOTTOM — OTHER MODE
          ══════════════════════════════════════════════ */}
      {mode === "other" && (
        <div className="absolute left-0 right-0" style={{ bottom: 0, zIndex: 20 }}>

          {/* AI Summary card */}
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-2xl flex items-start gap-2.5"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Brain style={{ width: 13, height: 13, color: "#34d399", flexShrink: 0, marginTop: 1 }} />
            <div className="flex flex-col gap-0.5 flex-1">
              <span style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: "0.05em" }}>AI · SUMMARY</span>
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
                {storyIdx === 0
                  ? "Путешествие в Токио. Автор делится атмосферой аэропорта. Настроение: позитивное 😊"
                  : "Закат в городе. Эстетический момент из поездки. Настроение: меланхоличное 🌅"}
              </span>
            </div>
            <div className="flex-shrink-0 px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>
                {storyIdx === 0 ? "😊" : "🌅"}
              </span>
            </div>
          </div>

          {/* Reply row */}
          <div className="flex items-center gap-2.5 px-4 pb-8">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold flex-shrink-0"
              style={{ background: `${ACCENT}22`, color: ACCENT, fontSize: 9 }}>ОС</div>

            <button className="flex-1 flex items-center px-4 rounded-full min-w-0 overflow-hidden"
              style={{ height: 40, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", width: "100%" }}>Ответить…</span>
            </button>

            {/* Mic reply */}
            <button className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Mic style={{ width: 16, height: 16, color: "rgba(255,255,255,0.7)" }} />
            </button>

            {/* Like */}
            <button onClick={handleLike}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{
                background: liked ? "rgba(251,113,133,0.2)" : "rgba(255,255,255,0.1)",
                border: `1px solid ${liked ? "rgba(251,113,133,0.4)" : "rgba(255,255,255,0.15)"}`,
                animation: likeAnim ? "heartPop 0.5s ease" : "none",
              }}>
              <Heart style={{ width: 18, height: 18, color: liked ? "#fb7185" : "rgba(255,255,255,0.7)", fill: liked ? "#fb7185" : "none" }} />
            </button>

            {/* Share */}
            <button className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Share2 style={{ width: 15, height: 15, color: "rgba(255,255,255,0.7)" }} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          VIEWER ANALYTICS PANEL (own mode, slide-up)
          ══════════════════════════════════════════════ */}
      {viewerPanel && mode === "own" && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setViewerPanel(false)} />

          {/* Panel */}
          <div className="relative rounded-t-[28px] overflow-hidden"
            style={{
              background: "rgba(10,8,24,0.97)",
              backdropFilter: "blur(32px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              maxHeight: 640,
              animation: "slideUp 0.4s cubic-bezier(0.34,1.2,0.64,1)",
            }}>

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="rounded-full" style={{ width: 40, height: 4, background: "rgba(255,255,255,0.2)" }} />
            </div>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex flex-col gap-0.5">
                <span style={{ fontSize: 16, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
                  Кто смотрел
                </span>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{totalViewers} просмотров</span>
                  <div className="flex items-center gap-1">
                    <div style={{ width: 5, height: 5, borderRadius:"50%", background:"#22d3ee", animation:"liveBlip 1.2s ease-in-out infinite" }} />
                    <span style={{ fontSize: 11, color: "#22d3ee", fontWeight: 600 }}>{liveCount} сейчас</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewerPanel(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <X style={{ width: 15, height: 15, color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 500, scrollbarWidth: "none" }}>

              {/* Story DNA */}
              <div className="px-5 mb-4">
                <StoryDNA percentile={94} />
              </div>

              {/* AI Groups */}
              <div className="px-5 mb-4">
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
                  AI · СЕГМЕНТЫ АУДИТОРИИ
                </span>
                <div className="flex gap-2 mt-2">
                  {VIEWER_GROUPS.map((g, i) => (
                    <button key={i} className="flex-1 flex flex-col gap-1 px-2.5 py-2.5 rounded-2xl transition-all"
                      style={{ background: `${g.color}12`, border: `1px solid ${g.color}28` }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: g.color }}>{g.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: "white", lineHeight: 1 }}>{g.count}</span>
                      <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emotional Spectrum */}
              <div className="px-5 mb-4 py-3 rounded-2xl mx-5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <EmotionalSpectrum />
              </div>

              {/* Viewer list */}
              <div className="px-5 mb-2">
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
                  АКТИВНОСТЬ
                </span>
              </div>
              {VIEWERS.map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5"
                  style={{ borderBottom: i < VIEWERS.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="flex items-center justify-center rounded-xl font-bold"
                      style={{ width: 36, height: 36, background: v.color + "28", color: v.color, fontSize: 11, border: `1.5px solid ${v.color}40` }}>
                      {v.initials}
                    </div>
                    {v.reaction && (
                      <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full"
                        style={{ width: 16, height: 16, background: "rgba(10,8,24,0.9)", fontSize: 9, border: "1px solid rgba(255,255,255,0.08)" }}>
                        {v.reaction}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{v.name}</span>
                      <span className="px-1.5 py-0.5 rounded-full" style={{
                        fontSize: 9, fontWeight: 600,
                        background: (CATEGORY_COLOR[v.category] ?? "#818cf8") + "18",
                        color: CATEGORY_COLOR[v.category] ?? "#818cf8",
                      }}>
                        {v.category}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{v.time} назад</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5">
                    {v.reaction && (
                      <span style={{ fontSize: 14 }}>{v.reaction}</span>
                    )}
                    <button className="px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
                      Ответить
                    </button>
                  </div>
                </div>
              ))}

              {/* Decay timer at bottom of panel */}
              <div className="mx-5 my-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Clock style={{ width: 15, height: 15, color: "rgba(255,255,255,0.4)" }} />
                <div className="flex flex-col gap-0.5 flex-1">
                  <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                    Сторис исчезнет через {14 - storyIdx * 4}ч {32 - storyIdx * 5}мин
                  </span>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)" }}>
                    Создан {["только что", "4 часа назад", "8 часов назад"][storyIdx]}
                  </span>
                </div>
                <button className="px-3 py-1.5 rounded-full"
                  style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}35`, fontSize: 11, fontWeight: 700, color: ACCENT }}>
                  +24ч
                </button>
              </div>

              <div style={{ height: 32 }} />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODE TOGGLE (floating, bottom-right)
          ══════════════════════════════════════════════ */}
      {!viewerPanel && (
        <div className="absolute z-50" style={{ bottom: mode === "own" ? 110 : 120, right: 16 }}>
          <button
            onClick={() => setMode(m => m === "own" ? "other" : "own")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}>
            <div className="relative flex items-center rounded-full"
              style={{ width: 30, height: 16, background: mode === "own" ? `${ACCENT}55` : "rgba(255,255,255,0.15)" }}>
              <div className="absolute flex items-center justify-center w-3 h-3 rounded-full transition-all duration-300"
                style={{ left: mode === "own" ? 1.5 : 15, background: mode === "own" ? ACCENT : "rgba(255,255,255,0.6)" }} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              {mode === "own" ? "Мой сторис" : "Чужой"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
