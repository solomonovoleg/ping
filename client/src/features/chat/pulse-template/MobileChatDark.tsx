import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft, Phone, Video, MoreVertical, Smile, Paperclip,
  Mic, Play, Pause, Brain, Forward, Image, X, Reply, Copy, Trash2, Send,
  Camera, Lock, Square, Trash,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ─── READ RECEIPT ────────────────────────────────────────────────── */
function ReadTick({ color }: { color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {/* Two tiny pills — futuristic minimal receipt indicator */}
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

/* ─── STATUS CYCLE ────────────────────────────────────────────────── */
const STATUS_LIST = [
  "В сети",
  "Печатает...",
  "Записывает голосовое",
  "В сети",
  "Записывает видео",
  "В сети",
];

/* ─── MOOD CONFIG ─────────────────────────────────────────────────── */
type MoodKey = "casual"|"romantic"|"business"|"conflict"|"fun"|"relax"|"support"|"gaming";

const MOODS: Record<MoodKey, {
  label: string; emoji: string;
  bg: string; accentColor: string; accentGlow: string;
  bubbleIn: string; bubbleOut: string;
  animation: "none"|"tense"|"playful"|"calm";
}> = {
  casual:   { label:"Нейтрал",   emoji:"💬", bg:"", accentColor:"#818cf8", accentGlow:"rgba(99,102,241,0.35)",  bubbleIn:"rgba(255,255,255,0.07)", bubbleOut:"rgba(60,60,80,0.95)",    animation:"none"    },
  romantic: { label:"Романтика", emoji:"💕", bg:"", accentColor:"#f472b6", accentGlow:"rgba(244,114,182,0.4)",  bubbleIn:"rgba(255,240,248,0.09)", bubbleOut:"rgba(219,39,119,0.82)", animation:"calm"    },
  business: { label:"Деловой",   emoji:"💼", bg:"", accentColor:"#60a5fa", accentGlow:"rgba(96,165,250,0.35)",  bubbleIn:"rgba(230,240,255,0.07)", bubbleOut:"rgba(37,99,235,0.85)",  animation:"none"    },
  conflict: { label:"Конфликт",  emoji:"⚡", bg:"", accentColor:"#f87171", accentGlow:"rgba(248,113,113,0.4)",  bubbleIn:"rgba(255,230,230,0.08)", bubbleOut:"rgba(185,28,28,0.88)",  animation:"tense"   },
  fun:      { label:"Веселье",   emoji:"🎉", bg:"", accentColor:"#fb923c", accentGlow:"rgba(251,146,60,0.4)",   bubbleIn:"rgba(255,248,230,0.08)", bubbleOut:"rgba(234,88,12,0.86)",  animation:"playful" },
  relax:    { label:"Релакс",    emoji:"🌊", bg:"", accentColor:"#2dd4bf", accentGlow:"rgba(45,212,191,0.38)",  bubbleIn:"rgba(230,255,254,0.07)", bubbleOut:"rgba(13,148,136,0.85)", animation:"calm"    },
  support:  { label:"Поддержка", emoji:"🤗", bg:"", accentColor:"#c084fc", accentGlow:"rgba(192,132,252,0.38)", bubbleIn:"rgba(245,235,255,0.08)", bubbleOut:"rgba(124,58,237,0.84)", animation:"calm"    },
  gaming:   { label:"Гейминг",   emoji:"🎮", bg:"", accentColor:"#4ade80", accentGlow:"rgba(74,222,128,0.4)",   bubbleIn:"rgba(230,255,240,0.07)", bubbleOut:"rgba(21,128,61,0.88)",  animation:"playful" },
};

const BARS = [3,5,8,12,9,14,10,6,11,15,8,5,13,9,4,7,12,10,6,14,9,5,11,8,15,7,4,10,13,6];
const STT_WORDS_D = ["Можешь","скинуть","мне","макеты","в","высоком","качестве?"];

/* single shared transition string for ALL mood-coloured elements — 5s eased */
const MT = "color 5s cubic-bezier(0.4,0,0.2,1), background 5s cubic-bezier(0.4,0,0.2,1), border-color 5s cubic-bezier(0.4,0,0.2,1), box-shadow 5s cubic-bezier(0.4,0,0.2,1), fill 5s cubic-bezier(0.4,0,0.2,1), stroke 5s cubic-bezier(0.4,0,0.2,1), opacity 5s cubic-bezier(0.4,0,0.2,1)";

/* ─── MOOD PATTERNS (Telegram-style animated tile backgrounds) ────── */
function MoodPattern({ mood, color }: { mood: MoodKey; color: string }) {
  const id = `mp-${mood}`;
  const base: React.CSSProperties = {
    position: "absolute", top: "-15%", left: "-15%",
    width: "130%", height: "130%", overflow: "visible",
  };

  if (mood === "casual") return (
    <>
      {/* Fine grain — diagonal hatching in near-invisible white */}
      <svg style={{ ...base, opacity: 0.045, animation: "patDrift1 40s linear infinite" }}>
        <defs><pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="36" y2="36" stroke="rgba(255,255,255,1)" strokeWidth="0.6"/>
          <line x1="36" y1="0" x2="0" y2="36" stroke="rgba(255,255,255,1)" strokeWidth="0.6"/>
        </pattern></defs>
        <rect width="100%" height="100%" fill={`url(#${id})`}/>
      </svg>
      {/* Coarse dot grid — barely visible */}
      <svg style={{ ...base, opacity: 0.055, animation: "patDrift3 55s linear infinite" }}>
        <defs><pattern id={id+"d"} width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="24" cy="24" r="1.2" fill="rgba(255,255,255,1)"/>
        </pattern></defs>
        <rect width="100%" height="100%" fill={`url(#${id+"d"})`}/>
      </svg>
    </>
  );

  if (mood === "romantic") return (
    <svg style={{ ...base, opacity: 0.1, animation: "patDrift2 34s ease-in-out infinite" }}>
      <defs><pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M40,14 C55,4 76,18 40,46 C4,18 25,4 40,14Z" fill="none" stroke={color} strokeWidth="1"/>
        <path d="M40,14 C55,4 76,18 40,46 C4,18 25,4 40,14Z" fill={color} opacity="0.04"/>
        <circle cx="40" cy="64" r="3" fill={color} opacity="0.25"/>
        <circle cx="12" cy="40" r="2" fill={color} opacity="0.15"/>
        <circle cx="68" cy="40" r="2" fill={color} opacity="0.15"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  if (mood === "business") return (
    <svg style={{ ...base, opacity: 0.065, animation: "patDrift3 38s linear infinite" }}>
      <defs><pattern id={id} width="64" height="24" patternUnits="userSpaceOnUse">
        <line x1="0" y1="12" x2="64" y2="12" stroke={color} strokeWidth="0.7" strokeDasharray="5 7"/>
        <circle cx="0"  cy="12" r="1.5" fill={color} opacity="0.6"/>
        <circle cx="64" cy="12" r="1.5" fill={color} opacity="0.6"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  if (mood === "conflict") return (
    <svg style={{ ...base, opacity: 0.1, animation: "patDrift1 18s linear infinite" }}>
      <defs><pattern id={id} width="44" height="66" patternUnits="userSpaceOnUse">
        <path d="M22,0 L44,22 L22,44 L44,66" fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
        <path d="M0,0 L22,22 L0,44 L22,66" fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  if (mood === "fun") return (
    <svg style={{ ...base, opacity: 0.11, animation: "patDrift2 26s ease-in-out infinite" }}>
      <defs><pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
        <circle cx="18" cy="18" r="6" fill="none" stroke={color} strokeWidth="1.1"/>
        <polygon points="54,8 64,26 44,26" fill="none" stroke={color} strokeWidth="1.1"/>
        <rect x="7" y="46" width="14" height="14" rx="3" fill="none" stroke={color} strokeWidth="1.1" transform="rotate(18 14 53)"/>
        <circle cx="58" cy="58" r="3.5" fill={color} opacity="0.35"/>
        <polygon points="38,50 46,65 30,65" fill={color} opacity="0.12"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  if (mood === "relax") return (
    <svg style={{ ...base, opacity: 0.08, animation: "patDrift3 40s ease-in-out infinite" }}>
      <defs><pattern id={id} width="130" height="45" patternUnits="userSpaceOnUse">
        <path d="M0,22 C22,8 43,36 65,22 C87,8 108,36 130,22" fill="none" stroke={color} strokeWidth="1"/>
        <path d="M0,32 C22,18 43,46 65,32 C87,18 108,46 130,32" fill="none" stroke={color} strokeWidth="0.55" opacity="0.45"/>
        <circle cx="65" cy="22" r="2.5" fill={color} opacity="0.3"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  if (mood === "support") return (
    <svg style={{ ...base, opacity: 0.08, animation: "patDrift2 32s ease-in-out infinite" }}>
      <defs><pattern id={id} width="74" height="74" patternUnits="userSpaceOnUse">
        <circle cx="37" cy="37" r="24" fill="none" stroke={color} strokeWidth="0.9"/>
        <circle cx="37" cy="37" r="14" fill="none" stroke={color} strokeWidth="0.6" opacity="0.5"/>
        <circle cx="62" cy="18" r="9" fill="none" stroke={color} strokeWidth="0.6" opacity="0.3"/>
        <circle cx="8"  cy="62" r="6" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );

  /* gaming */
  return (
    <svg style={{ ...base, opacity: 0.09, animation: "patDrift1 22s linear infinite" }}>
      <defs><pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
        <circle cx="17" cy="17" r="2" fill={color}/>
        <rect x="0.5" y="0.5" width="33" height="33" fill="none" stroke={color} strokeWidth="0.3" opacity="0.25"/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={`${12 + i*22}%`} y={`${8+(i%2)*28}%`}
          width="44" height="44" rx="5"
          fill="none" stroke={color} strokeWidth="0.9" opacity="0.18"/>
      ))}
    </svg>
  );
}

/* ─── FLOATING MOOD ELEMENTS ─────────────────────────────────────── */
function MoodShape({ mood, color, size }: { mood: MoodKey; color: string; size: number }) {
  const c = size / 2;
  const w = size, h = size;

  if (mood === "romantic") return (
    <svg width={w} height={h} viewBox="0 0 20 18" fill="none">
      <path d="M10,17 C10,17 1,11 1,5.5 C1,2.5 3.5,0.5 6,0.5 C7.7,0.5 9,1.8 10,3.2 C11,1.8 12.3,0.5 14,0.5 C16.5,0.5 19,2.5 19,5.5 C19,11 10,17 10,17Z"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.10"/>
    </svg>
  );
  if (mood === "casual") return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <circle cx={c} cy={c} r={c-1.5} stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.08"/>
      <circle cx={c} cy={c} r={c*0.32} fill={color} fillOpacity="0.22"/>
    </svg>
  );
  if (mood === "business") return (
    <svg width={w} height={h*0.45} viewBox={`0 0 ${w} ${h*0.45}`} fill="none">
      <line x1="0" y1={h*0.22} x2={w} y2={h*0.22} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="0"   cy={h*0.22} r="2" fill={color}/>
      <circle cx={w}   cy={h*0.22} r="2" fill={color}/>
    </svg>
  );
  if (mood === "conflict") return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={`M${w*0.62},1 L${w*0.22},${h*0.46} L${w*0.50},${h*0.46} L${w*0.38},${h-1} L${w*0.78},${h*0.54} L${w*0.50},${h*0.54}Z`}
        stroke={color} strokeWidth="1" fill={color} fillOpacity="0.12" strokeLinejoin="round"/>
    </svg>
  );
  if (mood === "fun") return (
    <svg width={w} height={h} viewBox="0 0 20 20" fill="none">
      <path d="M10,1 L12.4,7.6 L19.5,7.6 L13.9,11.9 L16.2,18.5 L10,14.2 L3.8,18.5 L6.1,11.9 L0.5,7.6 L7.6,7.6Z"
        stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.09"/>
    </svg>
  );
  if (mood === "relax") return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <circle cx={c} cy={c} r={c-1.5} stroke={color} strokeWidth="1.3" fill="none"/>
      <circle cx={c*0.65} cy={c*0.62} r={c*0.2} fill={color} fillOpacity="0.28"/>
    </svg>
  );
  if (mood === "support") return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <circle cx={c} cy={c} r={c-1} stroke={color} strokeWidth="1.4" fill="none"/>
      <circle cx={c} cy={c} r={c*0.52} stroke={color} strokeWidth="0.8" fill="none" opacity="0.45"/>
    </svg>
  );
  /* gaming */
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <rect x="1.5" y="1.5" width={w-3} height={h-3} stroke={color} strokeWidth="1.5" rx="2.5" fill={color} fillOpacity="0.07"/>
      <rect x={w*0.3} y={h*0.3} width={w*0.4} height={h*0.4} fill={color} fillOpacity="0.22"/>
    </svg>
  );
}

const FLOAT_ITEMS = [
  { l: 7,  b: 10, s: 16, dur: 13, del: 0,   p: 1 },
  { l: 20, b: 6,  s: 11, dur: 16, del: 2.6, p: 2 },
  { l: 36, b: 18, s: 19, dur: 11, del: 1.0, p: 3 },
  { l: 54, b: 8,  s: 14, dur: 14, del: 4.0, p: 1 },
  { l: 70, b: 15, s: 18, dur: 12, del: 3.2, p: 2 },
  { l: 84, b: 5,  s: 12, dur: 15, del: 0.8, p: 3 },
  { l: 46, b: 22, s: 10, dur: 17, del: 5.8, p: 1 },
];

/* Hearts: scattered all over the chat area, each fades in/out independently */
const HEART_POS = [
  { l: 8,  t: 18, s: 18, dur: 7,  del: 0   },
  { l: 24, t: 42, s: 13, dur: 9,  del: 1.8 },
  { l: 42, t: 12, s: 20, dur: 6,  del: 3.2 },
  { l: 58, t: 55, s: 15, dur: 8,  del: 0.6 },
  { l: 72, t: 28, s: 11, dur: 10, del: 4.5 },
  { l: 85, t: 68, s: 17, dur: 7,  del: 2.1 },
  { l: 16, t: 72, s: 12, dur: 9,  del: 5.8 },
  { l: 50, t: 82, s: 14, dur: 8,  del: 1.2 },
  { l: 33, t: 60, s: 10, dur: 11, del: 6.9 },
  { l: 78, t: 48, s: 16, dur: 6,  del: 3.7 },
  { l: 63, t: 20, s: 13, dur: 9,  del: 0.3 },
  { l: 6,  t: 50, s: 9,  dur: 7,  del: 7.4 },
];

function FloatingElements({ mood, color }: { mood: MoodKey; color: string }) {
  /* Romantic: hearts scattered over whole chat, fade in-out independently */
  if (mood === "romantic") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 3 }}>
        {HEART_POS.map((h, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${h.l}%`, top: `${h.t}%`,
            animation: `heartFade ${h.dur}s ${h.del}s ease-in-out infinite`,
            willChange: "opacity, transform",
          }}>
            <svg width={h.s} height={h.s} viewBox="0 0 20 18" fill="none">
              <path d="M10,17 C10,17 1,11 1,5.5 C1,2.5 3.5,0.5 6,0.5 C7.7,0.5 9,1.8 10,3.2 C11,1.8 12.3,0.5 14,0.5 C16.5,0.5 19,2.5 19,5.5 C19,11 10,17 10,17Z"
                stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12"/>
            </svg>
          </div>
        ))}
      </div>
    );
  }

  const drawColor = mood === "casual" ? "rgba(255,255,255,0.55)" : color;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 3 }}>
      {FLOAT_ITEMS.map((item, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${item.l}%`,
          bottom: `${item.b}%`,
          animation: `floatPath${item.p} ${item.dur}s ${item.del}s ease-in-out infinite`,
          willChange: "transform, opacity",
        }}>
          <MoodShape mood={mood} color={drawColor} size={item.s} />
        </div>
      ))}
    </div>
  );
}

/* ─── SOUND UTILITY ──────────────────────────────────────────────── */
let _actx: AudioContext | null = null;
function getActx() {
  if (typeof window === "undefined") return null;
  if (!_actx) _actx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_actx.state === "suspended") _actx.resume();
  return _actx;
}
function tone(f0: number, f1: number, dur: number, vol = 0.10, type: OscillatorType = "sine") {
  try {
    const ctx = getActx(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(f0, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 8), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur + 0.02);
  } catch { /* silent */ }
}
/* ─── шелест-удаление: белый шум → bandpass → два всплеска «шш-шш-ц» ── */
function shushDelete() {
  try {
    const ctx = getActx(); if (!ctx) return;
    const sr = ctx.sampleRate;
    /* цветной шум с мягкой огибающей */
    const mkNoise = (dur: number) => {
      const len = Math.ceil(sr * (dur + 0.12));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      /* розовый шум (−3dB/октава) — значительно мягче белого */
      let b0=0,b1=0,b2=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        d[i] = (b0 + b1 + b2 + w*0.0556) * 0.11;
      }
      return buf;
    };
    /* мягкий низкочастотный «вуш» — тело звука */
    const whoosh = () => {
      const src = ctx.createBufferSource();
      src.buffer = mkNoise(0.38);
      const lpf = ctx.createBiquadFilter();
      lpf.type = "bandpass"; lpf.frequency.value = 800; lpf.Q.value = 0.7;
      const gain = ctx.createGain();
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.055, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.022, t0 + 0.20);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      src.start(t0); src.stop(t0 + 0.42);
    };
    /* тихий высокочастотный «шш» — лёгкий воздух */
    const whisper = (startSec: number, dur: number, freq: number) => {
      const src = ctx.createBufferSource();
      src.buffer = mkNoise(dur);
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass"; bpf.frequency.value = freq; bpf.Q.value = 4.5;
      /* мягкий шельф убирает грубую верхнюю резкость */
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf"; shelf.frequency.value = 5000; shelf.gain.value = -10;
      const gain = ctx.createGain();
      src.connect(bpf); bpf.connect(shelf); shelf.connect(gain); gain.connect(ctx.destination);
      const t0 = ctx.currentTime + startSec;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.045, t0 + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.012, t0 + dur * 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.start(t0); src.stop(t0 + dur + 0.08);
    };
    whoosh();                       // мягкий вуш-основа
    whisper(0.04, 0.24, 2600);      // первый «шш» — тихий
    whisper(0.22, 0.18, 3200);      // второй «шш» — затухающий
  } catch { /* silent */ }
}
const SND = {
  press:    () => tone(100, 70,  0.05, 0.06),
  menuOpen: () => { tone(680, 740, 0.13, 0.08); setTimeout(() => tone(920, 960, 0.11, 0.055), 55); },
  react:    () => { tone(1100, 1380, 0.15, 0.09); setTimeout(() => tone(1720, 1720, 0.07, 0.04), 90); },
  delete:   () => shushDelete(),
  close:    () => tone(520, 360, 0.10, 0.06),
};

/* ─── PARTICLE DATA — медленный молекулярный распад ──────────────── */
const _sr = (s: number) => (((Math.sin(s * 127.1 + 311.7) * 43758.5453) % 1) + 1) / 2;
const PARTICLE_DATA = Array.from({ length: 64 }, (_, i) => ({
  /* позиция внутри пузыря (%) */
  lx: _sr(i * 3.11) * 100,
  ly: _sr(i * 2.73) * 100,
  /* финальное смещение — молекулы расходятся не далеко, дрейфуют */
  dx: (_sr(i * 5.31) - 0.5) * 80,
  dy: (_sr(i * 4.17) - 0.5) * 80,
  /* промежуточная точка дрейфа (zig-zag молекулярное движение) */
  mx: (_sr(i * 7.13) - 0.5) * 38,
  my: (_sr(i * 8.21) - 0.5) * 38,
  /* размер: маленькие «атомы» + несколько средних */
  sz: 1.2 + _sr(i * 6.71) * 3.2,
  /* задержка: широкая дисперсия, некоторые стартуют сильно позже */
  dl: _sr(i * 3.93) * 0.80,
  /* длительность: медленно — 1.6–2.8 сек */
  dr: 1.6 + _sr(i * 2.19) * 1.2,
  /* начальная прозрачность */
  op: 0.5 + _sr(i * 7.31) * 0.5,
}));

/* ─── DISSOLVE PARTICLES — молекулярное рассеивание ─────────────── */
function DissolveParticles({ x, y, w, h, color }: { x:number; y:number; w:number; h:number; color:string }) {
  const kf = PARTICLE_DATA.map((p, i) =>
    /* три точки: начало → дрейф (40%) → финал (100%) */
    `@keyframes _mo${i}{` +
    `0%{opacity:${p.op.toFixed(2)};transform:translate(0,0) scale(1)}` +
    `40%{opacity:${(p.op * 0.72).toFixed(2)};transform:translate(${p.mx.toFixed(1)}px,${p.my.toFixed(1)}px) scale(0.78)}` +
    `100%{opacity:0;transform:translate(${p.dx.toFixed(1)}px,${p.dy.toFixed(1)}px) scale(0.04)}}`
  ).join("");
  return (
    <>
      <style>{kf}</style>
      <div style={{ position:"absolute", left:x, top:y, width:w, height:h, pointerEvents:"none", zIndex:100, overflow:"visible" }}>
        {PARTICLE_DATA.map((p, i) => (
          <div key={i} style={{
            position:"absolute", left:`${p.lx}%`, top:`${p.ly}%`,
            width:p.sz, height:p.sz, borderRadius:"50%",
            background:color, opacity:p.op,
            /* ease-in-out-cubic — медленный старт, плавный дрейф, тихое угасание */
            animation:`_mo${i} ${p.dr.toFixed(2)}s ${p.dl.toFixed(2)}s cubic-bezier(0.37,0,0.63,1) forwards`,
          }}/>
        ))}
      </div>
    </>
  );
}

/* ─── CONTEXT MENU ───────────────────────────────────────────────── */
const REACTIONS_EMJ = ["❤️","😂","😮","😢","👍","🔥","🎉","👏"];
const CTX_ACTS = [
  { key:"reply",   label:"Ответить",   Icon:Reply,   danger:false },
  { key:"copy",    label:"Копировать", Icon:Copy,    danger:false },
  { key:"forward", label:"Переслать",  Icon:Forward, danger:false },
  { key:"delete",  label:"Удалить",    Icon:Trash2,  danger:true  },
];
type ReactMap = Record<string, Record<string, number>>;
type CtxMenu  = { id:string; x:number; y:number };

function ContextMenuOverlay({ menu, color, reactions, onReact, onAction, onClose }:
  { menu:CtxMenu; color:string; reactions:ReactMap; onReact:(e:string)=>void; onAction:(k:string)=>void; onClose:()=>void }
) {
  const W = 228, H = 240;
  const cx = Math.min(Math.max(menu.x - W/2, 8), 390 - W - 8);
  const cy = Math.min(Math.max(menu.y - 32, 60), 844 - H - 80);
  const msgReactions = reactions[menu.id] ?? {};
  return (
    <div style={{ position:"absolute", inset:0, zIndex:200 }} onPointerDown={onClose}>
      <div style={{ position:"absolute", inset:0, background:"rgba(4,4,14,0.55)", backdropFilter:"blur(8px)" }}/>
      <div
        style={{ position:"absolute", left:cx, top:cy, width:W, background:"rgba(16,16,30,0.97)",
          border:`1px solid ${color}30`, borderRadius:22, backdropFilter:"blur(28px)", overflow:"hidden",
          animation:"ctxIn 0.24s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Reaction strip */}
        <div style={{ display:"flex", padding:"10px 8px 8px", borderBottom:`1px solid rgba(255,255,255,0.06)`, gap:2 }}>
          {REACTIONS_EMJ.map((emj, ei) => {
            const count = msgReactions[emj] ?? 0;
            return (
              <button key={emj} onClick={() => { SND.react(); onReact(emj); }}
                style={{ flex:1, fontSize:17, padding:"4px 1px", borderRadius:10, border:"none", cursor:"pointer",
                  background: count > 0 ? color+"28" : "transparent",
                  transform: count > 0 ? "scale(1.18)" : "scale(1)",
                  transition:"transform 0.15s, background 0.15s",
                  animation:`ctxItem 0.${18 + ei*4}s cubic-bezier(0.34,1.56,0.64,1)` }}>
                {emj}
              </button>
            );
          })}
        </div>
        {/* Actions */}
        {CTX_ACTS.map((act, i) => (
          <button key={act.key} onClick={() => onAction(act.key)}
            style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding:"11px 16px",
              background:"transparent", border:"none", cursor:"pointer",
              borderBottom: i < CTX_ACTS.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              color: act.danger ? "#f87171" : "rgba(255,255,255,0.88)",
              fontSize:14, animation:`ctxItem 0.${22+i*5}s cubic-bezier(0.34,1.56,0.64,1)` }}>
            <act.Icon style={{ width:15, height:15, opacity:0.8 }}/>
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── EMOJI / STICKER PANEL DATA ────────────────────────────────── */
const EMOJI_ROWS = [
  ["😊","😂","🥰","😍","🤩","😎","🥳","😅","😭","😱"],
  ["🤔","🫡","🤫","😤","🙄","😏","🤗","😇","🥺","🫶"],
  ["❤️","🔥","👍","👏","🎉","✨","💫","🙌","💯","⚡"],
  ["🐶","🐱","🦊","🐼","🦋","🌸","🌺","🌈","⭐","🌙"],
  ["🍕","🍔","🌮","🍣","🍦","☕","🎂","🍩","🍓","🥑"],
  ["🎮","🎯","🎸","🎨","📱","🚀","🏆","💎","🔮","🎭"],
];
const STICKERS = [
  { bg:"#4c1d95", emoji:"🥰", label:"Влюблён" },
  { bg:"#7f1d1d", emoji:"😤", label:"Злой"    },
  { bg:"#064e3b", emoji:"😎", label:"Крутой"  },
  { bg:"#1e3a5f", emoji:"😭", label:"Плачет"  },
  { bg:"#713f12", emoji:"🤩", label:"В восторге" },
  { bg:"#134e4a", emoji:"🤫", label:"Тихо"    },
  { bg:"#3b0764", emoji:"🥳", label:"Праздник" },
  { bg:"#1c1917", emoji:"😱", label:"Шок"     },
  { bg:"#0c4a6e", emoji:"🤔", label:"Думает"  },
];
const GIFS = ["🎬","🎥","📽️","🎞️","🎦","🎠","🌊","🌋","🎆","🎇","✨","💫"];

/* ─── REACTIONS DISPLAY ──────────────────────────────────────────── */
function Rxn({ id, reactions, color }: { id:string; reactions:ReactMap; color:string }) {
  const rec = reactions[id] ?? {};
  const entries = Object.entries(rec).filter(([,c]) => c > 0);
  if (!entries.length) return null;
  return (
    <div className="flex gap-1.5 mt-1">
      {entries.map(([emj, cnt]) => (
        <span key={emj} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border"
          style={{ background:"rgba(255,255,255,0.06)", borderColor:`${color}30`,
            animation:"reactionIn 0.28s cubic-bezier(0.34,1.56,0.64,1)" }}>
          {emj} <span style={{ color:"rgba(255,255,255,0.5)", fontSize:11 }}>{cnt}</span>
        </span>
      ))}
    </div>
  );
}

/* ─── MOOD SWITCHER BAR ───────────────────────────────────────────── */
function MoodBar({ current, onChange }: { current: MoodKey; onChange: (m: MoodKey) => void }) {
  const keys = Object.keys(MOODS) as MoodKey[];
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-1.5" style={{ scrollbarWidth:"none" }}>
      {keys.map(k => {
        const m = MOODS[k];
        const active = k === current;
        return (
          <button key={k} onClick={() => onChange(k)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border mood-tr"
            style={active
              ? { background: m.accentColor + "22", borderColor: m.accentColor + "66", color: m.accentColor }
              : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}>
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────────────────── */
export function MobileChatDark() {
  const [mood, setMood] = useState<MoodKey>("casual");
  const [prevMood, setPrevMood] = useState<MoodKey | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [expandedVideo, setExpandedVideo] = useState(false);
  const [inlineExpanded, setInlineExpanded] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  /* ── settings sheet ── */
  const [showSettings, setShowSettings]   = useState(false);
  const [settingsTab, setSettingsTab]     = useState<"main"|"media">("main");
  const [bgTexture, setBgTexture]         = useState<"matte"|"solid"|"gradient">("matte");
  const [msgColorKey, setMsgColorKey]     = useState<"accent"|"grey"|"purple"|"blue">("accent");
  const [spellCheck, setSpellCheck]       = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  /* ── swipe between screens ── */
  const [swipeX, setSwipeX]               = useState(0);
  const [swipeDone, setSwipeDone]         = useState<"left"|"right"|null>(null);
  const swipeTouchRef                     = useRef(0);
  const swipingRef                        = useRef(false);
  /* input + emoji panel */
  const [inputText, setInputText]       = useState("");
  const [showEmoji, setShowEmoji]       = useState(false);
  const [emojiTab, setEmojiTab]         = useState<"emoji"|"sticker"|"gif">("emoji");
  const inputRef                        = useRef<HTMLInputElement>(null);
  /* voice recording */
  const [recState, setRecState]         = useState<"idle"|"rec"|"locked"|"preview-audio"|"preview-video"|"stt-rec"|"stt-transcribing">("idle");
  const [recSec, setRecSec]             = useState(0);
  const [sttWordIdx, setSttWordIdx]     = useState(0);
  /* audio preview playback */
  const [previewPlaying, setPreviewPlaying]   = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  /* video circle preview */
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [previewVideoProgress, setPreviewVideoProgress] = useState(0);
  /* voice playback */
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceSpeed, setVoiceSpeed]     = useState<1|1.5|2>(1);
  /* context menu + dissolve */
  const [ctxMenu, setCtxMenu]           = useState<CtxMenu | null>(null);
  const [dissolvingId, setDissolvingId] = useState<string | null>(null);
  const [dissolveRect, setDissolveRect] = useState<{x:number;y:number;w:number;h:number}|null>(null);
  const [hiddenIds, setHiddenIds]       = useState<Set<string>>(new Set());
  const [reactions, setReactions]       = useState<ReactMap>({ m5: { "❤️":2, "🔥":1 } });
  const containerRef  = useRef<HTMLDivElement | null>(null);
  const msgRefs       = useRef<Record<string, HTMLDivElement | null>>({});
  const pressTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* long press */
  const startPress = (id: string, e: React.PointerEvent) => {
    SND.press();
    pressTimer.current = setTimeout(() => {
      const cr2 = containerRef.current?.getBoundingClientRect();
      setCtxMenu({ id, x: e.clientX - (cr2?.left ?? 0), y: e.clientY - (cr2?.top ?? 0) });
      SND.menuOpen();
    }, 600);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  /* react to message */
  const handleReact = (emoji: string) => {
    if (!ctxMenu) return;
    setReactions(prev => {
      const cur = prev[ctxMenu.id] ?? {};
      const cnt = cur[emoji] ?? 0;
      return { ...prev, [ctxMenu.id]: { ...cur, [emoji]: cnt > 0 ? cnt - 1 : cnt + 1 } };
    });
    setCtxMenu(null);
  };

  /* context menu action */
  const handleAction = (key: string) => {
    if (!ctxMenu) return;
    if (key === "delete") {
      const idToDel = ctxMenu.id;
      const cEl = containerRef.current; const mEl = msgRefs.current[idToDel];
      if (cEl && mEl) {
        const cr = cEl.getBoundingClientRect(); const mr = mEl.getBoundingClientRect();
        setDissolveRect({ x: mr.left - cr.left, y: mr.top - cr.top, w: mr.width, h: mr.height });
      }
      SND.delete();
      setDissolvingId(idToDel);
      setCtxMenu(null);
      setTimeout(() => {
        setHiddenIds(prev => new Set([...prev, idToDel]));
        setDissolvingId(null); setDissolveRect(null);
      }, 2800);
    } else {
      SND.close(); setCtxMenu(null);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % STATUS_LIST.length), 2800);
    return () => clearInterval(t);
  }, []);

  /* recording timer — only tick during active recording */
  useEffect(() => {
    if (recState === "idle" || recState === "preview-audio" || recState === "preview-video" || recState === "stt-rec" || recState === "stt-transcribing") { setRecSec(0); return; }
    const t = setInterval(() => setRecSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recState]);

  /* STT: rec → transcribing → idle+fill */
  useEffect(() => {
    if (recState === "stt-rec") {
      setSttWordIdx(0);
      const t = setTimeout(() => setRecState("stt-transcribing"), 2500);
      return () => clearTimeout(t);
    }
    if (recState === "stt-transcribing") {
      const t = setTimeout(() => { setInputText("Можешь скинуть мне макеты в высоком качестве?"); setRecState("idle"); }, 3600);
      return () => clearTimeout(t);
    }
  }, [recState]);

  /* STT: word-by-word reveal */
  useEffect(() => {
    if (recState !== "stt-transcribing") return;
    if (sttWordIdx >= STT_WORDS_D.length) return;
    const t = setTimeout(() => setSttWordIdx(i => i + 1), 190 + Math.floor(Math.random() * 120));
    return () => clearTimeout(t);
  }, [recState, sttWordIdx]);

  /* audio preview playback */
  useEffect(() => {
    if (!previewPlaying) return;
    const step = previewDuration > 0 ? (0.2 / previewDuration) : 0.008;
    const t = setInterval(() => {
      setPreviewProgress(p => {
        if (p >= 1) { setPreviewPlaying(false); return 0; }
        return p + step;
      });
    }, 200);
    return () => clearInterval(t);
  }, [previewPlaying, previewDuration]);

  /* video circle preview playback */
  useEffect(() => {
    if (!previewVideoPlaying) return;
    const t = setInterval(() => {
      setPreviewVideoProgress(p => {
        if (p >= 1) { setPreviewVideoPlaying(false); return 0; }
        return p + 0.004;
      });
    }, 200);
    return () => clearInterval(t);
  }, [previewVideoPlaying]);

  /* voice playback progress auto-advance */
  useEffect(() => {
    if (!voicePlaying) return;
    const t = setInterval(() => setVoiceProgress(p => p >= 1 ? (setVoicePlaying(false), 0) : p + 0.012), 200);
    return () => clearInterval(t);
  }, [voicePlaying]);

  const statusText = STATUS_LIST[statusIdx];

  const m = MOODS[mood];

  const changeMood = (newMood: MoodKey) => {
    if (newMood === mood) return;
    setPrevMood(mood);
    setMood(newMood);
    /* clear the old pattern layer after cross-fade completes */
    setTimeout(() => setPrevMood(null), 5500);
  };

  const handleVideoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current;
      clickCountRef.current = 0;
      if (count >= 3) {
        // Triple tap → fullscreen
        setExpandedVideo(true);
        setVideoPlaying(true);
      } else {
        // Single / double tap → inline expand / collapse
        setInlineExpanded(prev => !prev);
        setVideoPlaying(v => !v);
      }
    }, 320);
  };

  const tensePulse = m.animation === "tense"
    ? { animation: "tensePulse 2.5s ease-in-out infinite" } : {};

  /* ── bg texture mapping ── */
  const BG_TEXTURES = {
    matte:    "#080810",
    solid:    "linear-gradient(170deg,#0e0b1e 0%,#060510 100%)",
    gradient: "linear-gradient(160deg,#1a0a2e 0%,#0a0818 45%,#060d1c 100%)",
  };
  const chatBg = BG_TEXTURES[bgTexture];

  /* ── outgoing bubble override ── */
  const MSG_COLORS: Record<string,string|null> = {
    accent: null, grey:"rgba(65,65,85,0.95)", purple:"rgba(118,47,230,0.90)", blue:"rgba(28,85,220,0.90)",
  };
  const outBubble = MSG_COLORS[msgColorKey] ?? m.bubbleOut;

  /* ── swipe handlers ── */
  const onSwipeStart = (e: React.TouchEvent) => {
    swipeTouchRef.current = e.touches[0].clientX;
    swipingRef.current = true;
  };
  const onSwipeMove = (e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    const dx = e.touches[0].clientX - swipeTouchRef.current;
    setSwipeX(Math.max(-280, Math.min(280, dx)));
  };
  const onSwipeEnd = () => {
    swipingRef.current = false;
    if (swipeX > 90) {
      setSwipeX(420);
      setSwipeDone("right");
      setTimeout(() => { setSwipeX(0); setSwipeDone(null); }, 520);
    } else if (swipeX < -90) {
      setSwipeX(-420);
      setSwipeDone("left");
      setTimeout(() => { setSwipeX(0); setSwipeDone(null); }, 520);
    } else {
      setSwipeX(0);
    }
  };

  /* ── fake media thumbnails ── */
  const MEDIA_ITEMS = [
    { bg:"linear-gradient(135deg,#312e81,#4f46e5)", emoji:"🌆" },
    { bg:"linear-gradient(135deg,#065f46,#059669)", emoji:"🌿" },
    { bg:"linear-gradient(135deg,#7c2d12,#dc2626)", emoji:"🔥" },
    { bg:"linear-gradient(135deg,#1e3a5f,#3b82f6)", emoji:"🌊" },
    { bg:"linear-gradient(135deg,#4a044e,#c026d3)", emoji:"✨" },
    { bg:"linear-gradient(135deg,#713f12,#d97706)", emoji:"🌅" },
    { bg:"linear-gradient(135deg,#0f172a,#334155)", emoji:"🏙️" },
    { bg:"linear-gradient(135deg,#064e3b,#10b981)", emoji:"🌲" },
    { bg:"linear-gradient(135deg,#581c87,#9333ea)", emoji:"🎆" },
  ];

  return (
    <div ref={containerRef} className="flex flex-col h-screen w-full overflow-hidden select-none relative"
      style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif", background: chatBg, color:"rgba(255,255,255,0.9)",
        transition:"background 5s cubic-bezier(0.4,0,0.2,1)" }}>

      {/* ── MOOD BACKGROUND ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: m.bg, zIndex: 0, transition:"background 5s ease" }} />

      {/* Old pattern — fades out softly during transition */}
      {prevMood && (
        <div key={`prev-${prevMood}`} className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 1, animation: "moodPatOut 5s cubic-bezier(0.4,0,0.6,1) forwards" }}>
          <MoodPattern mood={prevMood} color={MOODS[prevMood].accentColor} />
        </div>
      )}

      {/* New pattern — fades in from zero over 5s */}
      <div key={`new-${mood}`} className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 2, animation: "moodPatIn 5s cubic-bezier(0.4,0,0.6,1) forwards" }}>
        <MoodPattern mood={mood} color={m.accentColor} />
      </div>

      {/* Floating animated elements per mood */}
      <FloatingElements mood={mood} color={m.accentColor} />

      {/* ── LEFT SCREEN (dialog list) — revealed when swiping right ── */}
      {swipeX > 8 && (
        <div className="absolute inset-0 flex flex-col overflow-hidden" style={{
          zIndex: 9, transform: `translateX(${swipeX - 400}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)",
          background: "#07070f" }}>
          <div className="shrink-0 flex items-center justify-between px-5 pt-12 pb-3 border-b border-white/[0.06]">
            <span className="text-[18px] font-bold text-white">Чаты</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"rgba(99,102,241,0.2)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
            {[
              { name:"Алиса Иванова", msg:"Смотри что нашла 👀", time:"14:07", unread:2, online:true, color:"#6366f1" },
              { name:"Команда PULSE", msg:"Вы: Принял, завтра обсудим", time:"13:55", unread:0, online:false, color:"#8b5cf6" },
              { name:"Макс Ветров", msg:"ок всё понял!", time:"12:30", unread:0, online:true, color:"#06b6d4" },
              { name:"Лена Ким", msg:"Посмотри на дизайн 🎨", time:"11:18", unread:5, online:false, color:"#ec4899" },
              { name:"AI Ассистент", msg:"Готово! Вот результат:", time:"Вчера", unread:0, online:true, color:"#10b981" },
            ].map((c,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] active:bg-white/[0.04]">
                <div className="relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold text-white"
                  style={{ background: `${c.color}33`, border:`2px solid ${c.color}55` }}>
                  {c.name[0]}
                  {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#07070f]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[14px] font-semibold text-white">{c.name}</span>
                    <span className="text-[11px]" style={{ color:"rgba(255,255,255,0.35)" }}>{c.time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[12px] truncate" style={{ color:"rgba(255,255,255,0.45)" }}>{c.msg}</span>
                    {c.unread > 0 && (
                      <span className="shrink-0 ml-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: c.color }}>{c.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RIGHT SCREEN (user profile) — revealed when swiping left ── */}
      {swipeX < -8 && (
        <div className="absolute inset-0 flex flex-col overflow-hidden items-center" style={{
          zIndex: 9, transform: `translateX(${swipeX + 400}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)",
          background: "#07070f" }}>
          <div className="w-full shrink-0 flex items-center gap-2 px-4 pt-12 pb-4 border-b border-white/[0.06]">
            <span className="text-[18px] font-bold text-white">Профиль</span>
          </div>
          <div className="flex flex-col items-center gap-3 pt-8 w-full px-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-[32px] font-bold text-white"
              style={{ background:`linear-gradient(135deg,${m.accentColor}55,${m.accentColor}22)`, border:`3px solid ${m.accentColor}77` }}>
              АИ
            </div>
            <div className="text-center">
              <div className="text-[18px] font-bold text-white">Алиса Иванова</div>
              <div className="text-[12px] mt-0.5" style={{ color: m.accentColor }}>● В сети</div>
            </div>
            {[["Уведомления", "🔔"],["Поиск в чате", "🔍"],["Общие файлы", "📁"],["Заблокировать", "🚫"]].map(([label, icon]) => (
              <div key={label} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background:"rgba(255,255,255,0.05)" }}>
                <span className="text-[18px]">{icon}</span>
                <span className="text-[14px] text-white">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SWIPEABLE MAIN CHAT CONTENT ── */}
      <div className="absolute inset-0 flex flex-col z-10"
        style={{ transform: `translateX(${swipeX}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)" }}
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}>

      {/* ── iOS STATUS BAR ── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-0.5 relative"
        style={{ zIndex: 10, background: "#080810" }}>
        <span className="text-[13px] font-semibold text-white tracking-tight">9:41</span>
        {/* Dynamic Island */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 rounded-full"
          style={{ width:110, height:30, background:"#000", zIndex:20 }} />
        <div className="flex items-center gap-[5px]">
          <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
            {[0,1,2,3].map(i=><rect key={i} x={i*4.3} y={11-(i+1)*2.5} width="3" height={(i+1)*2.5} rx="0.7" fill="white" opacity={0.4+i*0.15}/>)}
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <circle cx="7.5" cy="9.5" r="1.3" fill="white" opacity="0.9"/>
            <path d="M3 6a6 6 0 019 0" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.85"/>
            <path d="M0.5 3.5a10 10 0 0114 0" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6"/>
          </svg>
          <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
            <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke="white" strokeOpacity="0.4"/>
            <rect x="2" y="2" width="15" height="7" rx="1.5" fill="white"/>
            <path d="M22 3.5v4a2 2 0 000-4z" fill="white" opacity="0.38"/>
          </svg>
        </div>
      </div>

      {/* ── TOP BAR ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 relative" style={{ zIndex:10 }}>
        <div className="absolute inset-0" style={{ background:"rgba(8,8,16,0.94)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.07)" }} />
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ zIndex:1 }}>
          <ChevronLeft style={{ width:24, height:24, color: m.accentColor }} />
        </button>
        {/* Avatar with story ring + mood-colored inner ring */}
        <div className="relative shrink-0" style={{ zIndex:1 }}>
          {/* Story ring — aurora spinning gradient */}
          <div style={{ position:'absolute', inset:-3, borderRadius:'50%',
            background:'conic-gradient(#818cf8 0%,#c084fc 25%,#f472b6 50%,#38bdf8 75%,#818cf8 100%)',
            animation:'storyRingSpin 3s linear infinite', zIndex:0 }} />
          {/* Gap ring — dark background separator */}
          <div style={{ position:'absolute', inset:-1, borderRadius:'50%', background:'#080810', zIndex:1 }} />
          {/* Mood-colored inner ring */}
          <div className="relative rounded-full p-[2px] mood-tr"
            style={{ background:`linear-gradient(135deg,${m.accentColor}99,${m.accentColor}33)`, zIndex:2 }}>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-[10px] font-semibold"
                style={{ background:"rgba(30,25,60,0.9)", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2"
            style={{ borderColor:"#080810", zIndex:3 }} />
        </div>
        <div className="flex-1 min-w-0 relative" style={{ zIndex:1 }}>
          <div className="text-[15px] font-semibold text-white leading-tight">Алиса Иванова</div>
          <div className="flex items-center gap-1.5 text-[11px] overflow-hidden" style={{ color: m.accentColor }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: m.accentColor }} />
            <span className="truncate font-medium" style={{ animation:"statusFade 0.35s ease" }} key={statusIdx}>
              {statusText}
            </span>
            <span className="text-[10px] shrink-0" style={{ color:"rgba(255,255,255,0.28)" }}>
              · {m.emoji} {m.label}
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 relative" style={{ zIndex:1 }}>
          {([Phone, Video] as const).map((Icon, i) => (
            <button key={i} className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.07]">
              <Icon style={{ width:18, height:18, color:"rgba(255,255,255,0.45)" }} />
            </button>
          ))}
          <button onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/[0.07]">
            <MoreVertical style={{ width:18, height:18, color:"rgba(255,255,255,0.45)" }} />
          </button>
        </div>
      </div>

      {/* MOOD SWITCHER — hidden, moods run in background */}

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 relative" style={{ scrollbarWidth:"none", zIndex:5 }}
        onPointerDown={(e: React.PointerEvent) => {
          const el = (e.target as HTMLElement).closest("[data-mid]") as HTMLElement | null;
          if (el) startPress(el.dataset.mid!, e);
        }}
        onPointerUp={cancelPress} onPointerMove={cancelPress}
        onPointerLeave={cancelPress} onPointerCancel={cancelPress}
      >

        {/* Date */}
        <div className="flex justify-center mb-2">
          <span className="text-[11px] px-3 py-1 rounded-full border"
            style={{ background:"rgba(255,255,255,0.04)", borderColor:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.3)" }}>
            Сегодня
          </span>
        </div>

        {/* m1 — Incoming text */}
        <div data-mid="m1" ref={el => { msgRefs.current["m1"] = el; }}
          style={{ opacity: dissolvingId==="m1"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m1")?"none":undefined }}>
          <div className="flex items-end gap-1.5 max-w-[82%]">
            <Avatar className="w-7 h-7 shrink-0 mb-4">
              <AvatarFallback className="text-[9px] font-semibold" style={{ background: m.accentColor+"28", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-[20px] rounded-bl-[6px] text-[14px] leading-relaxed mood-tr"
                style={{ background: m.bubbleIn, border:`1px solid ${m.accentColor}18`, color:"rgba(255,255,255,0.88)", backdropFilter:"blur(12px)", ...tensePulse }}>
                Привет! Набросала макеты для новой фичи 🎨
              </div>
              <Rxn id="m1" reactions={reactions} color={m.accentColor}/>
              <span className="text-[10px] ml-2 mt-0.5 block" style={{ color:"rgba(255,255,255,0.28)" }}>14:01</span>
            </div>
          </div>
        </div>

        {/* m2 — Outgoing */}
        <div data-mid="m2" ref={el => { msgRefs.current["m2"] = el; }}
          style={{ opacity: dissolvingId==="m2"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m2")?"none":"flex", justifyContent:"flex-end" }}>
          <div className="flex items-end gap-1.5 max-w-[80%] flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-[14px] leading-relaxed text-white mood-tr"
                style={{ background: outBubble }}>
                О, покажи! 👀
              </div>
              <Rxn id="m2" reactions={reactions} color={m.accentColor}/>
              <div className="flex items-center justify-end gap-1.5 mt-0.5 mr-1">
                <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>14:02</span>
                <ReadTick color={m.accentColor} />
              </div>
            </div>
          </div>
        </div>

        {/* m3 — Incoming voice (Telegram style) */}
        <div data-mid="m3" ref={el => { msgRefs.current["m3"] = el; }}
          style={{ opacity: dissolvingId==="m3"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m3")?"none":undefined }}>
          <div className="flex items-end gap-1.5" style={{ maxWidth: 300 }}>
            <Avatar className="w-8 h-8 shrink-0 mb-5">
              <AvatarFallback className="text-[10px] font-semibold" style={{ background: m.accentColor+"28", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {/* bubble */}
              <div className="rounded-[20px] rounded-bl-[6px] mood-tr overflow-hidden"
                style={{ background: m.bubbleIn, border:`1px solid ${m.accentColor}18`, backdropFilter:"blur(12px)" }}>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  {/* Play/pause with circular progress ring */}
                  <div className="relative shrink-0" style={{ width:42, height:42 }}>
                    <svg width="42" height="42" style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }}>
                      <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor+"22"} strokeWidth="2.5"/>
                      <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor} strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2*Math.PI*18}`}
                        strokeDashoffset={`${2*Math.PI*18*(1-voiceProgress)}`}
                        style={{ transition:"stroke-dashoffset 0.2s linear" }}/>
                    </svg>
                    <button onClick={() => { setVoicePlaying(!voicePlaying); }}
                      className="absolute inset-0 flex items-center justify-center rounded-full transition-all"
                      style={{ background: voicePlaying ? m.accentColor : m.accentColor+"22" }}>
                      {voicePlaying
                        ? <div className="flex gap-[2.5px]">
                            {[0,1,2].map(i=><div key={i} style={{ width:2.5,height:11,borderRadius:2,background:"white",animation:`sndBar 0.55s ease-in-out ${i*0.14}s infinite alternate` }}/>)}
                          </div>
                        : <Play style={{ width:14,height:14,color: voiceProgress>0 ? "white" : m.accentColor, marginLeft:2 }}/>}
                    </button>
                  </div>

                  {/* Waveform */}
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-[2px] h-8 cursor-pointer"
                      onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setVoiceProgress(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
                      }}>
                      {BARS.map((h,i)=>{
                        const played = i / BARS.length < voiceProgress;
                        return (
                          <div key={i} style={{
                            flex:1, borderRadius:999,
                            height: Math.max(3, (h/15)*28),
                            background: played ? m.accentColor : "rgba(255,255,255,0.18)",
                            transition:"background 0.15s",
                          }}/>
                        );
                      })}
                    </div>
                    {/* time + speed */}
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] font-mono" style={{ color:"rgba(255,255,255,0.38)" }}>
                        {voiceProgress > 0
                          ? `${Math.floor(voiceProgress*42)}с / 0:42`
                          : "0:42"}
                      </span>
                      <button onClick={() => setVoiceSpeed(s => s===1 ? 1.5 : s===1.5 ? 2 : 1)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all"
                        style={{ background: m.accentColor+"22", color: m.accentColor, letterSpacing:"0.02em" }}>
                        ×{voiceSpeed}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI transcript strip */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-t" style={{ borderColor: m.accentColor+"15", background: m.accentColor+"09" }}>
                  <Brain className="shrink-0" style={{ width: 10, height: 10, color: m.accentColor + "99" }} />
                  <span className="text-[10px] italic leading-tight" style={{ color: m.accentColor+"88" }}>«Хотела рассказать о макетах...»</span>
                </div>
              </div>
              <Rxn id="m3" reactions={reactions} color={m.accentColor}/>
              <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"rgba(255,255,255,0.28)" }}>14:05</span>
            </div>
          </div>
        </div>

        {/* m4 — Outgoing video circle */}
        <div data-mid="m4" ref={el => { msgRefs.current["m4"] = el; }}
          style={{ opacity: dissolvingId==="m4"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m4")?"none":"flex", justifyContent:"flex-end" }}>
        <div className="flex items-end">
          <div className="flex flex-col items-end">
            {/* Hint label */}
            {!inlineExpanded && (
              <span className="text-[9px] mb-1 mr-1 transition-opacity" style={{ color: m.accentColor+"77" }}>
                3× для полного экрана
              </span>
            )}
            <button onClick={handleVideoClick}
              className="relative rounded-full overflow-hidden block"
              style={{
                width: inlineExpanded ? 230 : 140,
                height: inlineExpanded ? 230 : 140,
                transition: "width 0.45s cubic-bezier(0.34,1.4,0.64,1), height 0.45s cubic-bezier(0.34,1.4,0.64,1)",
                background:"radial-gradient(ellipse at 40% 35%,rgba(80,60,180,0.6),rgba(10,6,30,0.95))",
                border:`2.5px solid ${m.accentColor}80`,
              }}>
              <div className="absolute inset-0" style={{ background:`radial-gradient(ellipse at 40% 35%,${m.accentColor}22,transparent 60%)` }}/>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full opacity-20"
                  style={{ width: inlineExpanded ? 110 : 70, height: inlineExpanded ? 110 : 70,
                    background:`radial-gradient(circle,${m.accentColor}88,transparent 70%)`,
                    transition:"width 0.45s,height 0.45s" }}/>
              </div>
              {/* Play / Pause */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full flex items-center justify-center transition-all"
                  style={{ width: inlineExpanded ? 68 : 46, height: inlineExpanded ? 68 : 46,
                    background:"rgba(0,0,0,0.5)", backdropFilter:"blur(8px)",
                    transition:"width 0.45s,height 0.45s" }}>
                  {videoPlaying
                    ? <Pause style={{ width: inlineExpanded ? 26 : 18, height: inlineExpanded ? 26 : 18, color:"white", transition:"width 0.3s,height 0.3s" }}/>
                    : <Play  style={{ width: inlineExpanded ? 26 : 18, height: inlineExpanded ? 26 : 18, color:"white", marginLeft: inlineExpanded ? 4 : 3, transition:"width 0.3s,height 0.3s" }}/>}
                </div>
              </div>
              {/* Duration */}
              <span className="absolute font-mono"
                style={{ bottom: inlineExpanded ? 18 : 12, right: inlineExpanded ? 20 : 14,
                  fontSize: inlineExpanded ? 12 : 10, color:"rgba(255,255,255,0.85)",
                  background:"rgba(0,0,0,0.55)", padding:"2px 6px", borderRadius:4,
                  transition:"all 0.3s" }}>
                {videoPlaying ? "0:08" : "0:15"}
              </span>
              {/* Progress arc (shows when playing inline) */}
              {inlineExpanded && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 230 230" style={{ opacity:0.45 }}>
                  <circle cx="115" cy="115" r="111" fill="none" stroke={m.accentColor} strokeWidth="2.5"
                    strokeDasharray="697" strokeDashoffset={videoPlaying ? "349" : "697"}
                    style={{ transition:"stroke-dashoffset 8s linear", transformOrigin:"center", transform:"rotate(-90deg)" }}/>
                </svg>
              )}
              {/* Pulsing ring */}
              {!inlineExpanded && (
                <div className="absolute inset-[-4px] rounded-full pointer-events-none"
                  style={{ border:`1.5px solid ${m.accentColor}44`, animation:"ringPulse 2.5s ease-in-out infinite" }}/>
              )}
            </button>
            {/* Collapse hint when expanded */}
            {inlineExpanded && (
              <span className="text-[9px] mt-1 mr-1" style={{ color: m.accentColor+"66" }}>
                нажмите чтобы свернуть · 3× полный экран
              </span>
            )}
            <div className="flex items-center justify-end gap-1.5 mt-1.5 mr-0.5">
              <Rxn id="m4" reactions={reactions} color={m.accentColor}/>
              <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>14:07</span>
              <ReadTick color={m.accentColor} />
            </div>
          </div>
        </div>
        </div>{/* /m4 wrapper */}

        {/* m5 — Incoming + reactions */}
        <div data-mid="m5" ref={el => { msgRefs.current["m5"] = el; }}
          style={{ opacity: dissolvingId==="m5"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m5")?"none":undefined }}>
          <div className="flex items-end gap-1.5 max-w-[82%]">
            <Avatar className="w-7 h-7 shrink-0 mb-6">
              <AvatarFallback className="text-[9px] font-semibold" style={{ background: m.accentColor+"28", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-[20px] rounded-bl-[6px] text-[14px] mood-tr"
                style={{ background: m.bubbleIn, border:`1px solid ${m.accentColor}18`, color:"rgba(255,255,255,0.88)", backdropFilter:"blur(12px)" }}>
                Класс! Очень современно 🔥
              </div>
              <Rxn id="m5" reactions={reactions} color={m.accentColor}/>
              <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"rgba(255,255,255,0.28)" }}>14:09</span>
            </div>
          </div>
        </div>

        {/* m6 — AI Summary */}
        <div data-mid="m6" ref={el => { msgRefs.current["m6"] = el; }}
          style={{ opacity: dissolvingId==="m6"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m6")?"none":undefined }}>
          <div className="flex justify-center my-1">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl w-full mood-tr"
              style={{ background: m.accentColor+"14", border:`1px solid ${m.accentColor}30`, backdropFilter:"blur(10px)" }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: m.accentColor+"30" }}>
                <Brain style={{ width:14,height:14,color: m.accentColor }}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold" style={{ color: m.accentColor }}>AI сжал 24 сообщения за 3 дня</div>
                <div className="text-[11px] truncate" style={{ color:"rgba(255,255,255,0.38)" }}>Дизайн, встреча в пятницу, фото из Питера</div>
              </div>
            </div>
          </div>
        </div>

        {/* m7 — Forwarded outgoing */}
        <div data-mid="m7" ref={el => { msgRefs.current["m7"] = el; }}
          style={{ opacity: dissolvingId==="m7"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m7")?"none":"flex", justifyContent:"flex-end" }}>
          <div className="flex items-end gap-1.5 max-w-[80%] flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-[14px] leading-relaxed text-white mood-tr"
                style={{ background: outBubble }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ opacity:0.65 }}>
                  <Forward style={{ width:11,height:11 }}/>
                  <span className="text-[10px]">Максим Орлов</span>
                </div>
                Не забудь встречу в пятницу 18:00 🗓
              </div>
              <Rxn id="m7" reactions={reactions} color={m.accentColor}/>
              <div className="flex items-center justify-end gap-1.5 mt-0.5 mr-1">
                <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>14:12</span>
                <ReadTick color={m.accentColor} />
              </div>
            </div>
          </div>
        </div>

        {/* m8 — Link preview */}
        <div data-mid="m8" ref={el => { msgRefs.current["m8"] = el; }}
          style={{ opacity: dissolvingId==="m8"?0:1, transition:"opacity 0.35s", display: hiddenIds.has("m8")?"none":undefined }}>
          <div className="flex items-end gap-1.5 max-w-[85%]">
            <Avatar className="w-7 h-7 shrink-0 mb-1">
              <AvatarFallback className="text-[9px] font-semibold" style={{ background: m.accentColor+"28", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="rounded-[20px] rounded-bl-[6px] overflow-hidden mood-tr"
                style={{ background: m.bubbleIn, border:`1px solid ${m.accentColor}18`, backdropFilter:"blur(12px)" }}>
                <div className="h-20 flex items-center justify-center"
                  style={{ background:`linear-gradient(135deg,${m.accentColor}18,${m.accentColor}08)` }}>
                  <Image style={{ width:28,height:28,color: m.accentColor+"44" }}/>
                </div>
                <div className="px-3 py-2">
                  <div className="text-[10px] mb-0.5" style={{ color: m.accentColor }}>medium.com</div>
                  <div className="text-[12px] font-medium leading-snug" style={{ color:"rgba(255,255,255,0.82)" }}>Дизайн 2040: интерфейсы будущего</div>
                </div>
              </div>
              <Rxn id="m8" reactions={reactions} color={m.accentColor}/>
              <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"rgba(255,255,255,0.28)" }}>14:15</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── EMOJI / STICKER PANEL ── */}
      {showEmoji && (
        <div className="shrink-0 relative" style={{ zIndex:11, background:"rgba(8,8,16,0.98)", borderTop:`1px solid ${m.accentColor}18`, animation:"emojiPanelIn 0.28s cubic-bezier(0.34,1.2,0.64,1)" }}>
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1">
            {(["emoji","sticker","gif"] as const).map(tab => (
              <button key={tab} onClick={() => setEmojiTab(tab)}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border"
                style={{ background: emojiTab===tab ? m.accentColor+"22" : "transparent",
                  borderColor: emojiTab===tab ? m.accentColor+"55" : "transparent",
                  color: emojiTab===tab ? m.accentColor : "rgba(255,255,255,0.35)" }}>
                {tab==="emoji" ? "😊 Эмодзи" : tab==="sticker" ? "🎭 Стикеры" : "GIF"}
              </button>
            ))}
            <button onClick={() => setShowEmoji(false)} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center" style={{ background:"rgba(255,255,255,0.06)" }}>
              <X style={{ width:13,height:13,color:"rgba(255,255,255,0.4)" }}/>
            </button>
          </div>

          {/* Emoji grid */}
          {emojiTab==="emoji" && (
            <div style={{ height:196, overflowY:"auto", scrollbarWidth:"none", padding:"4px 12px 8px" }}>
              {EMOJI_ROWS.map((row, ri) => (
                <div key={ri} className="flex gap-1 mb-1">
                  {row.map(emj => (
                    <button key={emj} onClick={() => { setInputText(t => t+emj); inputRef.current?.focus(); }}
                      style={{ flex:1, fontSize:22, padding:"4px 0", borderRadius:10, background:"transparent", border:"none", cursor:"pointer",
                        transition:"transform 0.1s", lineHeight:1.2 }}
                      onPointerDown={e => (e.currentTarget.style.transform="scale(1.3)")}
                      onPointerUp={e => (e.currentTarget.style.transform="scale(1)")}>
                      {emj}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Stickers grid */}
          {emojiTab==="sticker" && (
            <div style={{ height:196, overflowY:"auto", scrollbarWidth:"none", padding:"8px 12px" }}>
              <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                {STICKERS.map((s, i) => (
                  <button key={i} onClick={() => setInputText(t => t + s.emoji + " ")}
                    style={{ borderRadius:16, overflow:"hidden", background:s.bg+"cc", border:`1px solid ${s.bg}`,
                      aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
                      cursor:"pointer", animation:`ctxItem 0.${15+i*4}s ease`, transition:"transform 0.12s" }}
                    onPointerDown={e => (e.currentTarget.style.transform="scale(0.92)")}
                    onPointerUp={e => (e.currentTarget.style.transform="scale(1)")}>
                    <span style={{ fontSize:36, lineHeight:1 }}>{s.emoji}</span>
                    <span style={{ fontSize:9, color:"rgba(255,255,255,0.55)", letterSpacing:"0.02em" }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GIF grid */}
          {emojiTab==="gif" && (
            <div style={{ height:196, padding:"8px 12px" }}>
              <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                {GIFS.slice(0,9).map((g, i) => (
                  <div key={i} style={{ borderRadius:12, aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center",
                    background:`linear-gradient(135deg,${m.accentColor}18,rgba(255,255,255,0.04))`,
                    border:`1px solid ${m.accentColor}18`, fontSize:28, animation:`ctxItem 0.${15+i*4}s ease` }}>
                    {g}
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] mt-2" style={{ color:"rgba(255,255,255,0.18)" }}>GIF-поиск · PULSE 2040</p>
            </div>
          )}
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <div className="shrink-0 relative" style={{ zIndex:10 }}>
        <div className="absolute inset-0" style={{ background:"rgba(8,8,16,0.92)", backdropFilter:"blur(24px)",
          borderTop:`1px solid ${recState==="preview-audio"||recState==="preview-video" ? m.accentColor+"55" : recState!=="idle" ? "rgba(239,68,68,0.35)" : showEmoji ? m.accentColor+"44" : m.accentColor+"18"}`,
          transition:"border-color 0.3s" }}/>

        {recState === "idle" ? (
          /* ── Normal input ── */
          <div className="relative flex items-center gap-2 px-3 py-2 pb-7">
            <button className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
              onClick={() => setShowEmoji(false)}>
              <Paperclip style={{ width:19, height:19, color:"rgba(255,255,255,0.35)" }}/>
            </button>

            <div className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full border mood-tr"
              style={{ background: inputText ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.05)",
                borderColor: (showEmoji || inputText) ? m.accentColor+"55" : m.accentColor+"28" }}>
              <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)}
                placeholder="Сообщение..."
                className="flex-1 bg-transparent outline-none text-[14px]"
                style={{ color:"rgba(255,255,255,0.88)", caretColor: m.accentColor }}
                onFocus={() => setShowEmoji(false)}
              />
              <button onClick={() => { setRecState("stt-rec"); setShowEmoji(false); }}
                title="Голосовой ввод"
                style={{ flexShrink:0, width:22, height:22, borderRadius:"50%", background: m.accentColor+"20",
                  border:`1.5px solid ${m.accentColor}55`, display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"background 0.2s, border-color 0.2s" }}>
                <span style={{ fontSize:12, fontWeight:900, color: m.accentColor, fontStyle:"italic", lineHeight:1 }}>!</span>
              </button>
            </div>

            {/* Camera (video circle) — shows only when no text */}
            {!inputText && (
              <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${m.accentColor}22` }}
                onClick={() => {
                  setPreviewVideoProgress(0);
                  setPreviewVideoPlaying(false);
                  setRecState("preview-video");
                }}>
                <Camera style={{ width:18, height:18, color: m.accentColor+"99" }}/>
              </button>
            )}

            {/* Mic → Send */}
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300"
              style={{ background: inputText ? m.accentColor : "rgba(239,68,68,0.88)", transform: inputText ? "scale(1.05)" : "scale(1)" }}
              onClick={() => {
                if (inputText) { SND.menuOpen(); setInputText(""); setShowEmoji(false); }
                else { setRecState("rec"); setShowEmoji(false); tone(220, 280, 0.12, 0.07); }
              }}>
              <div style={{ transition:"all 0.2s", transform: inputText ? "rotate(0deg) scale(1)" : "rotate(-30deg) scale(0.85)", opacity: inputText ? 1 : 0, position:"absolute" }}>
                <Send style={{ width:17, height:17, color:"white", marginRight:2, marginBottom:1 }}/>
              </div>
              <div style={{ transition:"all 0.2s", transform: inputText ? "rotate(30deg) scale(0.85)" : "rotate(0deg) scale(1)", opacity: inputText ? 0 : 1, position:"absolute" }}>
                <Mic style={{ width:18, height:18, color:"white" }}/>
              </div>
            </button>
          </div>

        ) : recState === "rec" ? (
          /* ── Recording mode (swipe-to-cancel style) ── */
          <div className="relative pb-7">
            {/* Lock icon above mic */}
            <div className="flex justify-end pr-4 pt-1 pb-0.5">
              <div className="flex flex-col items-center gap-1 animate-bounce" style={{ animationDuration:"1.8s" }}>
                <Lock style={{ width:14, height:14, color:"rgba(255,255,255,0.3)" }}/>
                <div style={{ width:1, height:10, background:"rgba(255,255,255,0.12)" }}/>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              {/* Trash = cancel */}
              <button className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background:"rgba(255,255,255,0.06)" }}
                onClick={() => setRecState("idle")}>
                <Trash style={{ width:16, height:16, color:"rgba(255,255,255,0.4)" }}/>
              </button>

              {/* Waveform + timer + slide hint */}
              <div className="flex-1 flex items-center gap-3 h-11 px-4 rounded-full"
                style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)" }}>
                {/* Pulsing red dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "recPulse 1s ease-in-out infinite", flexShrink: 0 }} />
                {/* Timer */}
                <span className="text-[13px] font-mono font-medium" style={{ color:"rgba(255,255,255,0.82)", minWidth:36 }}>
                  {`${Math.floor(recSec/60)}:${String(recSec%60).padStart(2,"0")}`}
                </span>
                {/* Live mini-waveform */}
                <div className="flex-1 flex items-center gap-[2.5px] h-5 overflow-hidden">
                  {BARS.slice(0,20).map((h,i) => (
                    <div key={i} style={{ flex:1, borderRadius:999, height:Math.max(2,(h/15)*18),
                      background:`rgba(239,68,68,${0.5+0.5*Math.sin(Date.now()/300+i)})`,
                      animation:`sndBar ${0.5+i*0.04}s ease-in-out ${i*0.07}s infinite alternate` }}/>
                  ))}
                </div>
                {/* Slide to cancel */}
                <span className="text-[10px] flex items-center gap-0.5 shrink-0" style={{ color:"rgba(255,255,255,0.3)" }}>
                  <span style={{ animation:"slideHint 1.2s ease-in-out infinite" }}>←</span>
                </span>
              </div>

              {/* Mic tap → preview */}
              <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background:"#ef4444", animation:"recPulse 1.2s ease-in-out infinite" }}
                onClick={() => {
                  setPreviewDuration(recSec || 3);
                  setPreviewProgress(0);
                  setPreviewPlaying(false);
                  setRecState("preview-audio");
                  tone(920, 680, 0.10, 0.06);
                }}>
                <Mic style={{ width:18, height:18, color:"white" }}/>
              </button>
            </div>
            {/* Tap mic to lock or send hint */}
            <p className="text-center text-[9.5px] pb-1" style={{ color:"rgba(255,255,255,0.18)" }}>
              Удержите для блокировки · Отпустите для отправки
            </p>
          </div>

        ) : recState === "locked" ? (
          /* ── Locked recording mode ── */
          <div className="relative pb-7">
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Trash cancel */}
              <button className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)" }}
                onClick={() => setRecState("idle")}>
                <Trash style={{ width:16, height:16, color:"#f87171" }}/>
              </button>
              {/* Waveform */}
              <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-full"
                style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)" }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#ef4444",animation:"recPulse 1s ease-in-out infinite" }}/>
                <span className="text-[13px] font-mono font-medium" style={{ color:"rgba(255,255,255,0.82)" }}>
                  {`${Math.floor(recSec/60)}:${String(recSec%60).padStart(2,"0")}`}
                </span>
                <div className="flex-1 flex items-center gap-[2.5px] h-5">
                  {BARS.slice(0,20).map((h,i) => (
                    <div key={i} style={{ flex:1,borderRadius:999,height:Math.max(2,(h/15)*18),
                      background:"rgba(239,68,68,0.6)",animation:`sndBar ${0.5+i*0.04}s ease-in-out ${i*0.07}s infinite alternate`}}/>
                  ))}
                </div>
              </div>
              {/* Stop → preview */}
              <button className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)" }}
                onClick={() => {
                  setPreviewDuration(recSec || 5);
                  setPreviewProgress(0);
                  setPreviewPlaying(false);
                  setRecState("preview-audio");
                  tone(920, 680, 0.10, 0.06);
                }}>
                <Square style={{ width:14, height:14, color:"rgba(255,255,255,0.6)" }}/>
              </button>
              {/* Send directly */}
              <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ background: m.accentColor }}
                onClick={() => { setRecState("idle"); SND.menuOpen(); }}>
                <Send style={{ width:17, height:17, color:"white" }}/>
              </button>
            </div>
          </div>

        ) : recState === "preview-audio" ? (
          /* ── Audio preview — прослушай перед отправкой ── */
          <div className="relative pb-7" style={{ animation:"previewIn 0.3s cubic-bezier(0.34,1.2,0.64,1)" }}>
            <div className="flex items-center justify-between px-4 pt-2 pb-1">
              <span className="text-[11px] font-medium" style={{ color: m.accentColor }}>Предпросмотр записи</span>
              <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.3)" }}>
                {previewDuration > 0 ? `${Math.floor(previewDuration/60)}:${String(previewDuration%60).padStart(2,"0")}` : "0:00"}
              </span>
            </div>

            {/* Waveform player */}
            <div className="mx-3 rounded-[18px] overflow-hidden mb-2"
              style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${m.accentColor}30` }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Circular progress play button */}
                <div className="relative shrink-0" style={{ width:42,height:42 }}>
                  <svg width="42" height="42" style={{ position:"absolute",inset:0,transform:"rotate(-90deg)" }}>
                    <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor+"25"} strokeWidth="2.5"/>
                    <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor} strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2*Math.PI*18}`}
                      strokeDashoffset={`${2*Math.PI*18*(1-previewProgress)}`}
                      style={{ transition:"stroke-dashoffset 0.18s linear" }}/>
                  </svg>
                  <button onClick={() => setPreviewPlaying(p => !p)}
                    className="absolute inset-0 flex items-center justify-center rounded-full transition-all"
                    style={{ background: previewPlaying ? m.accentColor : m.accentColor+"22" }}>
                    {previewPlaying
                      ? <div className="flex gap-[2.5px]">
                          {[0,1,2].map(i=><div key={i} style={{ width:2.5,height:11,borderRadius:2,background:"white",animation:`sndBar 0.55s ease-in-out ${i*0.14}s infinite alternate` }}/>)}
                        </div>
                      : <Play style={{ width:14,height:14,color:"white",marginLeft:2 }}/>}
                  </button>
                </div>

                {/* Waveform scrub */}
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-[2px] h-8 cursor-pointer"
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setPreviewProgress(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
                    }}>
                    {BARS.map((h,i) => {
                      const played = i/BARS.length < previewProgress;
                      return <div key={i} style={{ flex:1,borderRadius:999,
                        height:Math.max(2,(h/15)*28),
                        background: played ? m.accentColor : m.accentColor+"44",
                        transition:"background 0.12s" }}/>;
                    })}
                  </div>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-mono" style={{ color:"rgba(255,255,255,0.3)" }}>
                      {previewDuration>0 ? `${Math.floor(previewProgress*previewDuration)}с` : "0с"}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color:"rgba(255,255,255,0.2)" }}>
                      {previewDuration>0 ? `${Math.floor(previewDuration/60)}:${String(previewDuration%60).padStart(2,"0")}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-2 px-3">
              <button className="flex-1 h-10 rounded-full flex items-center justify-center gap-2 text-[13px] font-medium"
                style={{ background:"rgba(239,68,68,0.14)", border:"1px solid rgba(239,68,68,0.28)", color:"#f87171" }}
                onClick={() => { setPreviewPlaying(false); setPreviewProgress(0); setRecState("idle"); SND.delete(); }}>
                <Trash style={{ width:14,height:14 }}/>
                Удалить
              </button>
              <button className="flex-1 h-10 rounded-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white"
                style={{ background: m.accentColor, boxShadow:`0 0 18px ${m.accentGlow}` }}
                onClick={() => { setPreviewPlaying(false); setPreviewProgress(0); setRecState("idle"); SND.menuOpen(); }}>
                <Send style={{ width:14,height:14 }}/>
                Отправить
              </button>
            </div>
          </div>

        ) : (
          /* ── Video circle preview ── */
          <div className="relative pb-7" style={{ animation:"previewIn 0.3s cubic-bezier(0.34,1.2,0.64,1)" }}>
            <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
              <span className="text-[11px] font-medium" style={{ color: m.accentColor }}>Предпросмотр видеокружка</span>
              <button onClick={() => { setPreviewVideoPlaying(false); setPreviewVideoProgress(0); setRecState("idle"); }}
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background:"rgba(255,255,255,0.07)" }}>
                <X style={{ width:12,height:12,color:"rgba(255,255,255,0.4)" }}/>
              </button>
            </div>

            <div className="flex items-center gap-4 px-3">
              {/* Circle preview */}
              <div className="relative shrink-0" style={{ width:88,height:88 }}>
                {/* Outer progress ring */}
                <svg width="88" height="88" style={{ position:"absolute",inset:0,transform:"rotate(-90deg)",zIndex:2 }}>
                  <circle cx="44" cy="44" r="40" fill="none" stroke={m.accentColor+"28"} strokeWidth="3"/>
                  <circle cx="44" cy="44" r="40" fill="none" stroke={m.accentColor} strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2*Math.PI*40}`}
                    strokeDashoffset={`${2*Math.PI*40*(1-previewVideoProgress)}`}
                    style={{ transition:"stroke-dashoffset 0.18s linear" }}/>
                </svg>
                {/* Circle content */}
                <div className="absolute rounded-full overflow-hidden flex items-center justify-center"
                  style={{ inset:5,
                    background:"radial-gradient(ellipse at 38% 32%,rgba(80,60,180,0.8),rgba(8,6,22,0.97))",
                    border:`2px solid ${m.accentColor}55` }}>
                  {/* Simulated video face glow */}
                  <div className="rounded-full opacity-40" style={{ width:32,height:32,
                    background:`radial-gradient(circle,${m.accentColor},transparent 70%)`,
                    animation: previewVideoPlaying ? "ringPulse 1.2s ease-in-out infinite" : "none" }}/>
                  {/* Duration overlay */}
                  {!previewVideoPlaying && (
                    <span className="absolute font-mono text-[9px] text-white"
                      style={{ bottom:6,right:8,background:"rgba(0,0,0,0.5)",padding:"1px 4px",borderRadius:4 }}>
                      {`0:${String(Math.round(previewVideoProgress*15)).padStart(2,"0")}/0:15`}
                    </span>
                  )}
                </div>
                {/* Play/pause button */}
                <button onClick={() => setPreviewVideoPlaying(p => !p)}
                  className="absolute inset-0 flex items-center justify-center rounded-full z-10 transition-all"
                  style={{ background: previewVideoPlaying ? "transparent" : "rgba(0,0,0,0.28)" }}>
                  {previewVideoPlaying
                    ? null
                    : <Play style={{ width:22,height:22,color:"white",marginLeft:3,opacity:0.9 }}/>}
                </button>
              </div>

              {/* Info + controls */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="text-[12px]" style={{ color:"rgba(255,255,255,0.45)" }}>
                  Видеосообщение · 15 сек
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 h-9 rounded-full flex items-center justify-center gap-1.5 text-[12px] font-medium"
                    style={{ background:"rgba(239,68,68,0.14)", border:"1px solid rgba(239,68,68,0.28)", color:"#f87171" }}
                    onClick={() => { setPreviewVideoPlaying(false); setPreviewVideoProgress(0); setRecState("idle"); SND.delete(); }}>
                    <Trash style={{ width:13,height:13 }}/>
                    Удалить
                  </button>
                  <button className="flex-1 h-9 rounded-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white"
                    style={{ background: m.accentColor, boxShadow:`0 0 14px ${m.accentGlow}` }}
                    onClick={() => { setPreviewVideoPlaying(false); setPreviewVideoProgress(0); setRecState("idle"); SND.menuOpen(); }}>
                    <Send style={{ width:13,height:13 }}/>
                    Отправить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── VIDEO EXPANDED OVERLAY ── */}
      {expandedVideo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background:"rgba(0,0,0,0.88)", backdropFilter:"blur(28px)" }}
          onClick={()=>{ setExpandedVideo(false); setVideoPlaying(false); }}>
          <div className="flex flex-col items-center gap-6" onClick={e=>e.stopPropagation()}>

            {/* Big expandable circle */}
            <div className="relative rounded-full overflow-hidden"
              style={{ width:280, height:280,
                background:"radial-gradient(ellipse at 40% 35%,rgba(80,60,180,0.65),rgba(8,6,22,0.96))",
                border:`3px solid ${m.accentColor}88`,
                animation:"expandCircle 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full opacity-25" style={{ width:130,height:130,
                  background:`radial-gradient(circle,${m.accentColor}88,transparent 70%)` }}/>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={()=>setVideoPlaying(!videoPlaying)}
                  className="rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ width:72,height:72,background:"rgba(0,0,0,0.52)",backdropFilter:"blur(10px)",
                    }}>
                  {videoPlaying
                    ? <Pause style={{ width:26,height:26,color:"white" }}/>
                    : <Play style={{ width:26,height:26,color:"white",marginLeft:4 }}/>}
                </button>
              </div>
              {/* Progress arc suggestion */}
              <svg className="absolute inset-0" viewBox="0 0 280 280" style={{ opacity:0.35 }}>
                <circle cx="140" cy="140" r="136" fill="none" stroke={m.accentColor} strokeWidth="2"
                  strokeDasharray="855" strokeDashoffset={videoPlaying ? "428" : "855"}
                  style={{ transition:"stroke-dashoffset 8s linear", transformOrigin:"center", transform:"rotate(-90deg)" }}/>
              </svg>
              <span className="absolute font-mono"
                style={{ bottom:22,right:24,fontSize:13,color:"rgba(255,255,255,0.85)",
                  background:"rgba(0,0,0,0.55)",padding:"3px 8px",borderRadius:6 }}>
                {videoPlaying ? "0:08" : "0:15"}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={()=>setVideoPlaying(!videoPlaying)}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white transition-all"
                style={{ background: m.accentColor }}>
                {videoPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4 ml-0.5"/>}
                {videoPlaying ? "Пауза" : "Играть"}
              </button>
              <button onClick={()=>{ setExpandedVideo(false); setVideoPlaying(false); }}
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background:"rgba(255,255,255,0.09)", border:"1px solid rgba(255,255,255,0.12)" }}>
                <X style={{ width:18,height:18,color:"rgba(255,255,255,0.7)" }}/>
              </button>
            </div>
            <p className="text-[11px]" style={{ color:"rgba(255,255,255,0.28)" }}>Нажмите на фон, чтобы закрыть</p>
          </div>
        </div>
      )}

      {/* ── CONTEXT MENU OVERLAY ── */}
      {ctxMenu && (
        <ContextMenuOverlay
          menu={ctxMenu} color={m.accentColor} reactions={reactions}
          onReact={handleReact} onAction={handleAction}
          onClose={() => { SND.close(); setCtxMenu(null); }}
        />
      )}

      {/* ── DISSOLVE PARTICLES ── */}
      {dissolvingId && dissolveRect && (
        <DissolveParticles
          x={dissolveRect.x} y={dissolveRect.y}
          w={dissolveRect.w} h={dissolveRect.h}
          color={m.accentColor}
        />
      )}

      </div>{/* end swipeable wrapper */}

      {/* ── SETTINGS OVERLAY ── */}
      {showSettings && (
        <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden"
          style={{ background:"rgba(5,5,15,0.85)", backdropFilter:"blur(20px)", animation:"settingsIn 0.32s cubic-bezier(0.2,0,0,1)" }}>

          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-4 border-b border-white/[0.08]">
            <button onClick={() => { setShowSettings(false); setSettingsTab("main"); }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background:"rgba(255,255,255,0.06)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div>
              <div className="text-[17px] font-bold text-white">Настройки чата</div>
              <div className="text-[12px]" style={{ color:"rgba(255,255,255,0.4)" }}>Фон и цвет сообщений</div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth:"none" }}>

            {/* Media files section */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.05]"
                onClick={() => setSettingsTab(settingsTab === "media" ? "main" : "media")}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background:"rgba(99,102,241,0.2)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#6366f1" strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="#6366f1"/><path d="m21 15-5-5L5 21" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[14px] font-semibold text-white">Медиафайлы и ссылки</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: settingsTab==="media" ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.25s ease" }}>
                  <path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {settingsTab === "media" && (
                <div className="px-3 pb-3 border-t border-white/[0.06]" style={{ animation:"settingsIn 0.22s ease" }}>
                  <div className="grid grid-cols-3 gap-1.5 pt-3">
                    {MEDIA_ITEMS.map((item, i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden flex items-center justify-center text-[28px] relative"
                        style={{ background: item.bg }}>
                        <span style={{ filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>{item.emoji}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-center text-[11px]" style={{ color:"rgba(255,255,255,0.3)" }}>9 общих медиафайлов</div>
                </div>
              )}
            </div>

            {/* Background section */}
            <div className="text-[12px] font-semibold mb-2 px-1" style={{ color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>Фон чата</div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {([
                { key:"matte",    label:"Матовый чёрный",     sub:"Строгий чёрный, слегка матовый",     bg:"#080810",              swatch:"linear-gradient(135deg,#111118,#08080f)" },
                { key:"solid",    label:"Премиум однотонно",   sub:"Глубокий тёмный с фиолетовым",       swatch:"linear-gradient(135deg,#120c28,#06050e)" },
                { key:"gradient", label:"Лёгкий премиум градиент", sub:"Тёплый градиент с фиолетовым",  swatch:"linear-gradient(135deg,#1a0a2e,#0a0818,#060d1c)" },
              ] as const).map(({ key, label, sub, swatch }) => (
                <button key={key} onClick={() => setBgTexture(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 active:bg-white/[0.04]"
                  style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                  <div className="w-12 h-9 rounded-xl shrink-0 border border-white/[0.12]" style={{ background: swatch }} />
                  <div className="flex-1 text-left">
                    <div className="text-[14px] font-medium text-white">{label}</div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color:"rgba(255,255,255,0.38)" }}>{sub}</div>
                  </div>
                  {bgTexture === key && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={m.accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>

            {/* Message color section */}
            <div className="text-[12px] font-semibold mb-2 px-1" style={{ color:"rgba(255,255,255,0.35)", letterSpacing:"0.05em", textTransform:"uppercase" }}>Цвет моих сообщений</div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {([
                { key:"accent", label:"Основной",   dot: m.accentColor },
                { key:"grey",   label:"Серый",       dot:"#606068" },
                { key:"purple", label:"Фиолетовый",  dot:"#9333ea" },
                { key:"blue",   label:"Голубой",     dot:"#3b82f6" },
              ] as const).map(({ key, label, dot }) => (
                <button key={key} onClick={() => setMsgColorKey(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0 active:bg-white/[0.04]"
                  style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-full shrink-0" style={{ background: dot }} />
                  <div className="flex-1 text-left text-[14px] font-medium text-white">{label}</div>
                  {msgColorKey === key && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={m.accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>

            {/* Toggles */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
              {([
                { label:"Проверка орфографии", sub:"Автоисправление в этом чате", val:spellCheck, set:setSpellCheck },
                { label:"Переводить входящие", sub:"На ваш язык автоматически",   val:autoTranslate, set:setAutoTranslate },
              ] as const).map(({ label, sub, val, set }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium text-white">{label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color:"rgba(255,255,255,0.38)" }}>{sub}</div>
                  </div>
                  <button onClick={() => set(!val)}
                    className="shrink-0 w-12 h-7 rounded-full transition-all duration-300 relative"
                    style={{ background: val ? m.accentColor : "rgba(255,255,255,0.15)" }}>
                    <span className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300"
                      style={{ left: val ? "calc(100% - 24px)" : "4px" }} />
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes storyRingSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sndBar      { from{transform:scaleY(0.35)} to{transform:scaleY(1.5)} }
        @keyframes typDot      { 0%,100%{transform:translateY(0);opacity:.35} 50%{transform:translateY(-4px);opacity:.95} }
        @keyframes tensePulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.012)} }
        @keyframes ringPulse   { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.06);opacity:0.15} }
        @keyframes expandCircle{ from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes statusFade  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotsAnim    { 0%{width:0} 25%{width:5px} 50%{width:10px} 75%{width:15px} 100%{width:0} }
        @keyframes patDrift1   { 0%{transform:translate(0,0)} 100%{transform:translate(54px,54px)} }
        @keyframes patDrift2   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-34px,28px)} }
        @keyframes patDrift3   { 0%{transform:translate(0,0)} 100%{transform:translate(-90px,0)} }
        @keyframes moodPatIn    { from{opacity:0} to{opacity:1} }
        @keyframes moodPatOut   { from{opacity:1} to{opacity:0} }
        .mood-tr {
          transition:
            color 5s cubic-bezier(0.4,0,0.2,1),
            background-color 5s cubic-bezier(0.4,0,0.2,1),
            border-color 5s cubic-bezier(0.4,0,0.2,1),
            box-shadow 5s cubic-bezier(0.4,0,0.2,1),
            fill 5s cubic-bezier(0.4,0,0.2,1),
            stroke 5s cubic-bezier(0.4,0,0.2,1) !important;
        }
        @keyframes settingsIn   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ctxIn        { from{opacity:0;transform:scale(0.82) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes emojiPanelIn { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
        @keyframes recPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.65;transform:scale(0.88)} }
        @keyframes slideHint { 0%,100%{opacity:0.3;transform:translateX(0)} 50%{opacity:0.65;transform:translateX(-5px)} }
        @keyframes previewIn { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.18);opacity:.2} }
        @keyframes ctxItem      { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes reactionIn   { from{opacity:0;transform:scale(0.6)} to{opacity:1;transform:scale(1)} }
        @keyframes heartFade  {
          0%,100% { opacity:0;   transform:scale(0.75) }
          25%     { opacity:0.22; transform:scale(1.05) }
          50%     { opacity:0.18; transform:scale(1.0)  }
          75%     { opacity:0.20; transform:scale(1.03) }
        }
        @keyframes floatPath1 {
          0%   { transform:translate(0,0)     scale(0.85); opacity:0 }
          12%  { opacity:0.20 }
          88%  { opacity:0.13 }
          100% { transform:translate(14px,-180px) scale(0.55); opacity:0 }
        }
        @keyframes floatPath2 {
          0%   { transform:translate(0,0)     scale(0.75); opacity:0 }
          14%  { opacity:0.17 }
          86%  { opacity:0.09 }
          100% { transform:translate(-10px,-165px) scale(0.5); opacity:0 }
        }
        @keyframes floatPath3 {
          0%   { transform:translate(0,0)     scale(0.9); opacity:0 }
          16%  { opacity:0.22 }
          84%  { opacity:0.11 }
          100% { transform:translate(20px,-155px) scale(0.52); opacity:0 }
        }
      ` }} />
    </div>
  );
}
