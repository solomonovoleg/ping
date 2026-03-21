import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft, Phone, Video, MoreVertical, Smile, Paperclip,
  Mic, Play, Pause, Brain, Forward, Image, X, Send, Camera, Lock, Square, Trash,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ─── READ RECEIPT ────────────────────────────────────────────────── */
function ReadTickL({ color }: { color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[0.45, 1].map((op, i) => (
        <div key={i} style={{
          width: 14, height: 3, borderRadius: 99,
          background: color, opacity: op,
          boxShadow: i === 1 ? `0 0 5px ${color}99` : "none",
          transition: "background 0.3s, box-shadow 0.3s",
        }} />
      ))}
    </div>
  );
}

/* ─── STATUS CYCLE ────────────────────────────────────────────────── */
const STATUS_LIST_L = [
  { text: "В сети",                    icon: "" },
  { text: "Печатает...",               icon: "" },
  { text: "Записывает голосовое",      icon: "🎤" },
  { text: "В сети",                    icon: "" },
  { text: "Записывает видео",          icon: "📹" },
  { text: "В сети",                    icon: "" },
];

/* ─── AUDIO ──────────────────────────────────────────────────────── */
let _actxL: AudioContext | null = null;
function getActxL() {
  if (typeof window === "undefined") return null;
  if (!_actxL) _actxL = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_actxL.state === "suspended") _actxL.resume();
  return _actxL;
}
function toneL(f0: number, f1: number, dur: number, vol = 0.10, type: OscillatorType = "sine") {
  try {
    const ctx = getActxL(); if (!ctx) return;
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
function softToneL(freq: number, dur: number, vol = 0.07, delayMs = 0) {
  setTimeout(() => {
    try {
      const ctx = getActxL(); if (!ctx) return;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur + 0.05);
    } catch { /* silent */ }
  }, delayMs);
}
function shushDeleteL() {
  try {
    const ctx = getActxL(); if (!ctx) return;
    const sr = ctx.sampleRate;
    const mkNoise = (dur: number) => {
      const len = Math.ceil(sr * (dur + 0.12));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
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
    const whoosh = () => {
      const src = ctx.createBufferSource();
      src.buffer = mkNoise(0.38);
      const lpf = ctx.createBiquadFilter();
      lpf.type = "bandpass"; lpf.frequency.value = 800; lpf.Q.value = 0.7;
      const gain = ctx.createGain();
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.042, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.016, t0 + 0.20);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      src.start(t0); src.stop(t0 + 0.42);
    };
    const whisper = (startSec: number, dur: number, freq: number) => {
      const src = ctx.createBufferSource();
      src.buffer = mkNoise(dur);
      const bpf = ctx.createBiquadFilter();
      bpf.type = "bandpass"; bpf.frequency.value = freq; bpf.Q.value = 4.5;
      const shelf = ctx.createBiquadFilter();
      shelf.type = "highshelf"; shelf.frequency.value = 5000; shelf.gain.value = -10;
      const gain = ctx.createGain();
      src.connect(bpf); bpf.connect(shelf); shelf.connect(gain); gain.connect(ctx.destination);
      const t0 = ctx.currentTime + startSec;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.038, t0 + 0.055);
      gain.gain.exponentialRampToValueAtTime(0.010, t0 + dur * 0.55);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.start(t0); src.stop(t0 + dur + 0.08);
    };
    whoosh();
    whisper(0.04, 0.24, 2600);
    whisper(0.22, 0.18, 3200);
  } catch { /* silent */ }
}
const SNDL = {
  press:    () => toneL(100, 70, 0.05, 0.06),
  menuOpen: () => { toneL(680, 740, 0.13, 0.08); setTimeout(() => toneL(920, 960, 0.11, 0.055), 55); },
  react:    () => { toneL(1100, 1380, 0.15, 0.09); setTimeout(() => toneL(1720, 1720, 0.07, 0.04), 90); },
  close:    () => toneL(520, 360, 0.10, 0.06),
  delete:   () => shushDeleteL(),
};

/* ─── EMOJI / STICKER DATA ───────────────────────────────────────── */
const EMOJI_ROWS_L = [
  ["😊","😂","🥰","😍","🤩","😎","🥳","😅","😭","😱"],
  ["🤔","🫡","🤫","😤","🙄","😏","🤗","😇","🥺","🫶"],
  ["❤️","🔥","👍","👏","🎉","✨","💫","🙌","💯","⚡"],
  ["🐶","🐱","🦊","🐼","🦋","🌸","🌺","🌈","⭐","🌙"],
  ["🍕","🍔","🌮","🍣","🍦","☕","🎂","🍩","🍓","🥑"],
  ["🎮","🎯","🎸","🎨","📱","🚀","🏆","💎","🔮","🎭"],
];
const STICKERS_L = [
  { bg:"#fce7f3", emoji:"🥰", label:"Влюблён" },
  { bg:"#fee2e2", emoji:"😤", label:"Злой"    },
  { bg:"#d1fae5", emoji:"😎", label:"Крутой"  },
  { bg:"#dbeafe", emoji:"😭", label:"Плачет"  },
  { bg:"#fef3c7", emoji:"🤩", label:"Восторг" },
  { bg:"#f0fdf4", emoji:"🤫", label:"Тихо"    },
  { bg:"#ede9fe", emoji:"🥳", label:"Праздник" },
  { bg:"#f1f5f9", emoji:"😱", label:"Шок"     },
  { bg:"#e0f2fe", emoji:"🤔", label:"Думает"  },
];

/* ─── MOOD CONFIG (light theme) ──────────────────────────────────── */
type MoodKey = "casual"|"romantic"|"business"|"conflict"|"fun"|"relax"|"support"|"gaming";

const MOODS: Record<MoodKey, {
  label: string; emoji: string;
  bg: string; accentColor: string; accentGlow: string;
  bubbleIn: string; bubbleOut: string; bubbleInBorder: string;
  particleType: "none"|"hearts"|"grid"|"dust"|"waves"|"sparks";
  animation: "none"|"tense"|"playful"|"calm";
}> = {
  casual:   { label:"Нейтрал",   emoji:"💬", bg:"radial-gradient(ellipse at 50% 0%,rgba(180,185,255,0.22),transparent 65%)", accentColor:"#6366f1", accentGlow:"rgba(99,102,241,0.3)",  bubbleIn:"#ffffff", bubbleOut:"#6366f1", bubbleInBorder:"rgba(0,0,0,0.07)", particleType:"none",   animation:"none"    },
  romantic: { label:"Романтика", emoji:"💕", bg:"radial-gradient(ellipse at 50% 0%,rgba(255,180,210,0.32),transparent 65%)", accentColor:"#ec4899", accentGlow:"rgba(236,72,153,0.32)", bubbleIn:"#fff5f9", bubbleOut:"#db2777", bubbleInBorder:"rgba(236,72,153,0.12)", particleType:"hearts", animation:"calm"    },
  business: { label:"Деловой",   emoji:"💼", bg:"radial-gradient(ellipse at 50% 0%,rgba(180,205,255,0.25),transparent 65%)", accentColor:"#2563eb", accentGlow:"rgba(37,99,235,0.28)",  bubbleIn:"#f0f5ff", bubbleOut:"#1d4ed8", bubbleInBorder:"rgba(37,99,235,0.10)", particleType:"grid",   animation:"none"    },
  conflict: { label:"Конфликт",  emoji:"⚡", bg:"radial-gradient(ellipse at 50% 0%,rgba(255,180,180,0.28),transparent 65%)", accentColor:"#dc2626", accentGlow:"rgba(220,38,38,0.28)",  bubbleIn:"#fff8f8", bubbleOut:"#b91c1c", bubbleInBorder:"rgba(220,38,38,0.10)", particleType:"none",   animation:"tense"   },
  fun:      { label:"Веселье",   emoji:"🎉", bg:"radial-gradient(ellipse at 50% 0%,rgba(255,220,150,0.28),transparent 65%)", accentColor:"#ea580c", accentGlow:"rgba(234,88,12,0.30)",  bubbleIn:"#fffaf0", bubbleOut:"#c2410c", bubbleInBorder:"rgba(234,88,12,0.10)", particleType:"sparks", animation:"playful" },
  relax:    { label:"Релакс",    emoji:"🌊", bg:"radial-gradient(ellipse at 50% 0%,rgba(150,240,230,0.28),transparent 65%)", accentColor:"#0d9488", accentGlow:"rgba(13,148,136,0.28)", bubbleIn:"#f0fffe", bubbleOut:"#0f766e", bubbleInBorder:"rgba(13,148,136,0.10)", particleType:"waves",  animation:"calm"    },
  support:  { label:"Поддержка", emoji:"🤗", bg:"radial-gradient(ellipse at 50% 0%,rgba(210,170,255,0.28),transparent 65%)", accentColor:"#7c3aed", accentGlow:"rgba(124,58,237,0.28)", bubbleIn:"#faf5ff", bubbleOut:"#6d28d9", bubbleInBorder:"rgba(124,58,237,0.10)", particleType:"waves",  animation:"calm"    },
  gaming:   { label:"Гейминг",   emoji:"🎮", bg:"radial-gradient(ellipse at 50% 0%,rgba(150,255,180,0.22),transparent 65%)", accentColor:"#16a34a", accentGlow:"rgba(22,163,74,0.28)",  bubbleIn:"#f0fff5", bubbleOut:"#15803d", bubbleInBorder:"rgba(22,163,74,0.10)",  particleType:"grid",   animation:"playful" },
};

const BARS = [3,5,8,12,9,14,10,6,11,15,8,5,13,9,4,7,12,10,6,14,9,5,11,8,15,7,4,10,13,6];
const SMART = ["Буду! 🙌","Скоро","Понял 👍","Напомни","Класс! 🔥"];

/* ─── OVERLAYS ─────────────────────────────────────────────────────── */
function HeartsOverlay({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex:1 }}>
      {[...Array(7)].map((_,i)=>(
        <div key={i} className="absolute" style={{ left:`${12+i*13}%`, bottom:"-10%", fontSize:18+(i%3)*6,
          color, opacity:0.18, animation:`floatHeartL ${5+i*0.8}s ease-in-out ${i*0.7}s infinite` }}>♥</div>
      ))}
    </div>
  );
}
function GridOverlay({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex:1 }}>
      <svg width="100%" height="100%" style={{ opacity:0.07 }}>
        <defs><pattern id="grdL" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke={color} strokeWidth="0.7"/>
        </pattern></defs>
        <rect width="100%" height="100%" fill="url(#grdL)"/>
      </svg>
    </div>
  );
}
function WavesOverlay({ color }: { color: string }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height:120,zIndex:1 }}>
      {[0,1].map(i=>(
        <svg key={i} viewBox="0 0 390 60" preserveAspectRatio="none" className="absolute bottom-0 w-full"
          style={{ height:60-i*15, opacity:0.1-i*0.03, animation:`waveMoveL ${8+i*2}s ease-in-out ${i*2}s infinite alternate` }}>
          <path d={`M0,30 C60,${10+i*8} 130,${50-i*8} 195,30 S330,${10+i*8} 390,30 V60 H0Z`} fill={color}/>
        </svg>
      ))}
    </div>
  );
}
function SparksOverlay({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex:1 }}>
      {[...Array(10)].map((_,i)=>(
        <div key={i} className="absolute rounded-full"
          style={{ width:3+(i%3), height:3+(i%3), background:color, opacity:0.2,
            left:`${8+i*9}%`, top:`${15+(i%5)*16}%`,
            animation:`sparkPopL ${2.5+i*0.4}s ease-in-out ${i*0.35}s infinite`,
            boxShadow:`0 0 5px ${color}` }}/>
      ))}
    </div>
  );
}
function MoodParticles({ type, color }: { type: string; color: string }) {
  if (type==="hearts") return <HeartsOverlay color={color}/>;
  if (type==="grid")   return <GridOverlay color={color}/>;
  if (type==="waves")  return <WavesOverlay color={color}/>;
  if (type==="sparks") return <SparksOverlay color={color}/>;
  return null;
}

function MoodBar({ current, onChange }: { current: MoodKey; onChange: (m: MoodKey) => void }) {
  const keys = Object.keys(MOODS) as MoodKey[];
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-1.5" style={{ scrollbarWidth:"none" }}>
      {keys.map(k=>{
        const m = MOODS[k];
        const active = k===current;
        return (
          <button key={k} onClick={()=>onChange(k)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border mood-tr-l"
            style={active
              ? { background: m.accentColor+"18", borderColor: m.accentColor+"55", color: m.accentColor, boxShadow:`0 0 10px ${m.accentGlow}` }
              : { background:"rgba(0,0,0,0.04)", borderColor:"rgba(0,0,0,0.08)", color:"#94a3b8" }}>
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── MAIN ────────────────────────────────────────────────────────── */
export function MobileChatLight() {
  const [mood, setMood]               = useState<MoodKey>("casual");
  const [prevMood, setPrevMood]       = useState<MoodKey|null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [activeSR, setActiveSR]       = useState<string|null>(null);
  const [expandedVideo, setExpandedVideo] = useState(false);
  const [inlineExpanded, setInlineExpanded] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [statusIdx, setStatusIdx]     = useState(0);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* settings */
  const [showSettings, setShowSettings]   = useState(false);
  const [settingsTab, setSettingsTab]     = useState<"main"|"media">("main");
  const [bgTexture, setBgTexture]         = useState<"matte"|"solid"|"gradient">("matte");
  const [msgColorKey, setMsgColorKey]     = useState<"accent"|"grey"|"purple"|"blue">("accent");
  const [spellCheck, setSpellCheck]       = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  /* swipe */
  const [swipeX, setSwipeX]               = useState(0);
  const swipeTouchRef                     = useRef(0);
  const swipingRef                        = useRef(false);
  /* input + emoji */
  const [inputText, setInputText]     = useState("");
  const [showEmoji, setShowEmoji]     = useState(false);
  const [emojiTab, setEmojiTab]       = useState<"emoji"|"sticker"|"gif">("emoji");
  const inputRef                      = useRef<HTMLInputElement>(null);
  /* recording */
  const [recState, setRecState]       = useState<"idle"|"rec"|"locked">("idle");
  const [recSec, setRecSec]           = useState(0);
  /* voice playback */
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceSpeed, setVoiceSpeed]   = useState<1|1.5|2>(1);

  useEffect(() => {
    const t = setInterval(() => setStatusIdx(i => (i + 1) % STATUS_LIST_L.length), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (recState === "idle") { setRecSec(0); return; }
    const t = setInterval(() => setRecSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recState]);

  useEffect(() => {
    if (!voicePlaying) return;
    const t = setInterval(() => setVoiceProgress(p => p >= 1 ? (setVoicePlaying(false), 0) : p + 0.012), 200);
    return () => clearInterval(t);
  }, [voicePlaying]);

  const statusItem = STATUS_LIST_L[statusIdx];

  const m = MOODS[mood];

  const changeMood = (newMood: MoodKey) => {
    if (newMood === mood) return;
    setPrevMood(mood);
    setMood(newMood);
    setTimeout(() => setPrevMood(null), 5500);
  };

  /* bg textures */
  const BG_TEXTURES_L = {
    matte:    "#eef1fb",
    solid:    "linear-gradient(170deg,#f0ecfb 0%,#edf0fb 100%)",
    gradient: "linear-gradient(160deg,#ede8fb 0%,#eef1fb 45%,#e8f0fb 100%)",
  };
  const chatBg = BG_TEXTURES_L[bgTexture];

  /* outgoing bubble color override */
  const MSG_COLORS_L: Record<string,string|null> = {
    accent: null, grey:"rgba(90,95,115,0.90)", purple:"rgba(118,47,230,0.90)", blue:"rgba(37,99,235,0.88)",
  };
  const outBubble = MSG_COLORS_L[msgColorKey] ?? m.bubbleOut;

  /* swipe handlers */
  const onSwipeStart = (e: React.TouchEvent) => {
    swipeTouchRef.current = e.touches[0].clientX;
    swipingRef.current = true;
  };
  const onSwipeMove = (e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    setSwipeX(Math.max(-280, Math.min(280, e.touches[0].clientX - swipeTouchRef.current)));
  };
  const onSwipeEnd = () => {
    swipingRef.current = false;
    if (swipeX > 90) {
      setSwipeX(420);
      setTimeout(() => setSwipeX(0), 520);
    } else if (swipeX < -90) {
      setSwipeX(-420);
      setTimeout(() => setSwipeX(0), 520);
    } else {
      setSwipeX(0);
    }
  };

  /* media thumbnails */
  const MEDIA_ITEMS_L = [
    { bg:"linear-gradient(135deg,#ddd6fe,#818cf8)", emoji:"🌆" },
    { bg:"linear-gradient(135deg,#a7f3d0,#34d399)", emoji:"🌿" },
    { bg:"linear-gradient(135deg,#fecaca,#f87171)", emoji:"🔥" },
    { bg:"linear-gradient(135deg,#bae6fd,#38bdf8)", emoji:"🌊" },
    { bg:"linear-gradient(135deg,#e9d5ff,#c084fc)", emoji:"✨" },
    { bg:"linear-gradient(135deg,#fde68a,#fbbf24)", emoji:"🌅" },
    { bg:"linear-gradient(135deg,#cbd5e1,#94a3b8)", emoji:"🏙️" },
    { bg:"linear-gradient(135deg,#bbf7d0,#4ade80)", emoji:"🌲" },
    { bg:"linear-gradient(135deg,#f3e8ff,#a855f7)", emoji:"🎆" },
  ];

  const handleVideoClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current;
      clickCountRef.current = 0;
      if (count >= 3) {
        setExpandedVideo(true);
        setVideoPlaying(true);
      } else {
        setInlineExpanded(prev => !prev);
        setVideoPlaying(v => !v);
      }
    }, 320);
  };

  const tensePulse = m.animation==="tense"
    ? { animation:"tensePulseL 2.5s ease-in-out infinite" } : {};

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden select-none relative"
      style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Inter',sans-serif", background: chatBg, color:"#1a1a2e",
        transition:"background 5s cubic-bezier(0.4,0,0.2,1)" }}>

      {/* MOOD BG base */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: m.bg, zIndex:0, transition:"background 5s ease" }}/>

      {/* Old pattern — fades out */}
      {prevMood && (
        <div key={`prev-${prevMood}`} className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex:1, animation:"moodPatOutL 5s cubic-bezier(0.4,0,0.6,1) forwards" }}>
          <MoodParticles type={MOODS[prevMood].particleType} color={MOODS[prevMood].accentColor}/>
        </div>
      )}
      {/* New pattern — fades in */}
      <div key={`new-${mood}`} className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex:2, animation:"moodPatInL 5s cubic-bezier(0.4,0,0.6,1) forwards" }}>
        <MoodParticles type={m.particleType} color={m.accentColor}/>
      </div>

      {/* ── LEFT SCREEN — swipe right reveals chat list ── */}
      {swipeX > 8 && (
        <div className="absolute inset-0 flex flex-col overflow-hidden" style={{
          zIndex:9, transform:`translateX(${swipeX - 400}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)",
          background:"#f5f7ff" }}>
          <div className="shrink-0 flex items-center justify-between px-5 pt-12 pb-3 border-b border-black/[0.06]">
            <span className="text-[18px] font-bold" style={{ color:"#1a1a2e" }}>Чаты</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"rgba(99,102,241,0.12)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-white" style={{ scrollbarWidth:"none" }}>
            {[
              { name:"Алиса Иванова", msg:"Смотри что нашла 👀", time:"14:07", unread:2, online:true, color:"#6366f1" },
              { name:"Команда PULSE", msg:"Вы: Принял, завтра обсудим", time:"13:55", unread:0, online:false, color:"#8b5cf6" },
              { name:"Макс Ветров", msg:"ок всё понял!", time:"12:30", unread:0, online:true, color:"#06b6d4" },
              { name:"Лена Ким", msg:"Посмотри на дизайн 🎨", time:"11:18", unread:5, online:false, color:"#ec4899" },
              { name:"AI Ассистент", msg:"Готово! Вот результат:", time:"Вчера", unread:0, online:true, color:"#10b981" },
            ].map((c,i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.04]">
                <div className="relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-bold text-white"
                  style={{ background:`${c.color}22`, border:`2px solid ${c.color}44`, color: c.color }}>
                  {c.name[0]}
                  {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[14px] font-semibold" style={{ color:"#1a1a2e" }}>{c.name}</span>
                    <span className="text-[11px]" style={{ color:"#c0c8d8" }}>{c.time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[12px] truncate" style={{ color:"#94a3b8" }}>{c.msg}</span>
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

      {/* ── RIGHT SCREEN — swipe left reveals profile ── */}
      {swipeX < -8 && (
        <div className="absolute inset-0 flex flex-col overflow-hidden" style={{
          zIndex:9, transform:`translateX(${swipeX + 400}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)",
          background:"#f5f7ff" }}>
          <div className="shrink-0 flex items-center gap-2 px-4 pt-12 pb-4 border-b border-black/[0.06] bg-white">
            <span className="text-[18px] font-bold" style={{ color:"#1a1a2e" }}>Профиль</span>
          </div>
          <div className="flex flex-col items-center gap-3 pt-8 w-full px-6 bg-white flex-1">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-[32px] font-bold"
              style={{ background:`${m.accentColor}18`, border:`3px solid ${m.accentColor}55`, color: m.accentColor }}>
              АИ
            </div>
            <div className="text-center">
              <div className="text-[18px] font-bold" style={{ color:"#1a1a2e" }}>Алиса Иванова</div>
              <div className="text-[12px] mt-0.5" style={{ color: m.accentColor }}>● В сети</div>
            </div>
            {[["Уведомления","🔔"],["Поиск в чате","🔍"],["Общие файлы","📁"],["Заблокировать","🚫"]].map(([label,icon]) => (
              <div key={label} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background:"#f1f4fc" }}>
                <span className="text-[18px]">{icon}</span>
                <span className="text-[14px]" style={{ color:"#1a1a2e" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SWIPEABLE MAIN CHAT CONTENT ── */}
      <div className="absolute inset-0 flex flex-col z-10"
        style={{ transform:`translateX(${swipeX}px)`,
          transition: swipingRef.current ? "none" : "transform 0.42s cubic-bezier(0.2,0,0,1)" }}
        onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}>

      {/* iOS STATUS BAR */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-0.5 relative" style={{ zIndex:10 }}>
        <span className="text-[13px] font-semibold" style={{ color:"#1a1a2e" }}>9:41</span>
        <div className="absolute left-1/2 -translate-x-1/2 top-2 rounded-full"
          style={{ width:110,height:30,background:"#000",zIndex:20 }}/>
        <div className="flex items-center gap-[5px]">
          <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
            {[0,1,2,3].map(i=><rect key={i} x={i*4.3} y={11-(i+1)*2.5} width="3" height={(i+1)*2.5} rx="0.7" fill="#1a1a2e" opacity={0.3+i*0.18}/>)}
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
            <circle cx="7.5" cy="9.5" r="1.3" fill="#1a1a2e" opacity="0.9"/>
            <path d="M3 6a6 6 0 019 0" stroke="#1a1a2e" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.85"/>
            <path d="M0.5 3.5a10 10 0 0114 0" stroke="#1a1a2e" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55"/>
          </svg>
          <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
            <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke="#1a1a2e" strokeOpacity="0.35"/>
            <rect x="2" y="2" width="15" height="7" rx="1.5" fill="#1a1a2e"/>
            <path d="M22 3.5v4a2 2 0 000-4z" fill="#1a1a2e" opacity="0.35"/>
          </svg>
        </div>
      </div>

      {/* TOP BAR */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 relative" style={{ zIndex:10 }}>
        <div className="absolute inset-0" style={{ background:"rgba(255,255,255,0.82)", backdropFilter:"blur(24px)", borderBottom:`1px solid ${m.accentColor}18` }}/>
        <button className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ zIndex:1 }}>
          <ChevronLeft style={{ width:24,height:24,color: m.accentColor }}/>
        </button>
        <div className="relative shrink-0" style={{ zIndex:1 }}>
          {/* Story ring — aurora spinning gradient */}
          <div style={{ position:'absolute', inset:-3, borderRadius:'50%',
            background:'conic-gradient(#818cf8 0%,#c084fc 25%,#f472b6 50%,#38bdf8 75%,#818cf8 100%)',
            animation:'storyRingSpinL 3s linear infinite', zIndex:0 }} />
          {/* Gap ring — light background separator */}
          <div style={{ position:'absolute', inset:-1, borderRadius:'50%', background:'#eef1fb', zIndex:1 }} />
          {/* Mood-colored inner ring */}
          <div className="relative rounded-full p-[2px] transition-all duration-500"
            style={{ background:`linear-gradient(135deg,${m.accentColor}88,${m.accentColor}22)`, boxShadow:`0 0 12px ${m.accentGlow}`, zIndex:2 }}>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-[10px] font-semibold"
                style={{ background: m.accentColor+"18", color: m.accentColor }}>АИ</AvatarFallback>
            </Avatar>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" style={{ zIndex:3 }}/>
        </div>
        <div className="flex-1 min-w-0 relative" style={{ zIndex:1 }}>
          <div className="text-[15px] font-semibold leading-tight" style={{ color:"#1a1a2e" }}>Алиса Иванова</div>
          <div className="flex items-center gap-1.5 text-[11px] overflow-hidden" style={{ color: m.accentColor }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.accentColor }} />
            <span className="truncate font-medium" key={statusIdx} style={{ animation:"statusFadeL 0.35s ease" }}>
              {statusItem.icon && <span className="mr-0.5">{statusItem.icon}</span>}
              {statusItem.text}
            </span>
            <span className="text-[10px] shrink-0" style={{ color:"#c0c8d8" }}>
              · {m.emoji} {m.label}
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 relative" style={{ zIndex:1 }}>
          {([Phone,Video] as const).map((Icon,i)=>(
            <button key={i} className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0.05)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
              <Icon style={{ width:18,height:18,color:"#94a3b8" }}/>
            </button>
          ))}
          <button onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(0,0,0,0.05)"}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
            <MoreVertical style={{ width:18,height:18,color:"#94a3b8" }}/>
          </button>
        </div>
      </div>

      {/* MOOD SWITCHER — hidden, moods run in background */}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 relative" style={{ scrollbarWidth:"none", zIndex:5 }}>

        <div className="flex justify-center mb-2">
          <span className="text-[11px] px-3 py-1 rounded-full border"
            style={{ background:"rgba(255,255,255,0.7)", borderColor:"rgba(0,0,0,0.07)", color:"#94a3b8" }}>Сегодня</span>
        </div>

        {/* Incoming */}
        <div className="flex items-end gap-1.5 max-w-[82%]">
          <Avatar className="w-7 h-7 shrink-0 mb-4">
            <AvatarFallback className="text-[9px] font-semibold mood-tr-l" style={{ background: m.accentColor+"18", color: m.accentColor }}>АИ</AvatarFallback>
          </Avatar>
          <div>
            <div className="px-4 py-2.5 rounded-[20px] rounded-bl-[6px] text-[14px] leading-relaxed shadow-sm mood-tr-l"
              style={{ background: m.bubbleIn, border:`1px solid ${m.bubbleInBorder}`, color:"#1a1a2e", ...tensePulse }}>
              Привет! Набросала макеты для новой фичи 🎨
            </div>
            <span className="text-[10px] ml-2 mt-0.5 block" style={{ color:"#c0c8d8" }}>14:01</span>
          </div>
        </div>

        {/* Outgoing */}
        <div className="flex items-end gap-1.5 max-w-[80%] ml-auto flex-row-reverse">
          <div>
            <div className="px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-[14px] leading-relaxed text-white mood-tr-l"
              style={{ background: outBubble, boxShadow:`0 4px 18px ${m.accentGlow}` }}>
              О, покажи! 👀
            </div>
            <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
              <span className="text-[10px]" style={{ color:"#c0c8d8" }}>14:02</span>
              <ReadTickL color={m.accentColor} />
            </div>
          </div>
        </div>

        {/* Voice — Telegram style */}
        <div className="flex items-end gap-1.5" style={{ maxWidth:300 }}>
          <Avatar className="w-8 h-8 shrink-0 mb-5">
            <AvatarFallback className="text-[10px] font-semibold" style={{ background: m.accentColor+"18", color: m.accentColor }}>АИ</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="rounded-[20px] rounded-bl-[6px] shadow-sm transition-all duration-500 overflow-hidden"
              style={{ background: m.bubbleIn, border:`1px solid ${m.bubbleInBorder}` }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                {/* Play/pause with circular progress ring */}
                <div className="relative shrink-0" style={{ width:42, height:42 }}>
                  <svg width="42" height="42" style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }}>
                    <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor+"28"} strokeWidth="2.5"/>
                    <circle cx="21" cy="21" r="18" fill="none" stroke={m.accentColor} strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2*Math.PI*18}`}
                      strokeDashoffset={`${2*Math.PI*18*(1-voiceProgress)}`}
                      style={{ transition:"stroke-dashoffset 0.2s linear" }}/>
                  </svg>
                  <button onClick={() => setVoicePlaying(!voicePlaying)}
                    className="absolute inset-0 flex items-center justify-center rounded-full transition-all"
                    style={{ background: voicePlaying ? m.accentColor : m.accentColor+"18" }}>
                    {voicePlaying
                      ? <div className="flex gap-[2.5px]">
                          {[0,1,2].map(i=><div key={i} style={{ width:2.5,height:11,borderRadius:2,background:"white",animation:`sndBarL 0.55s ease-in-out ${i*0.14}s infinite alternate` }}/>)}
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
                          height: Math.max(3,(h/15)*28),
                          background: played ? m.accentColor : m.accentColor+"44",
                          transition:"background 0.15s",
                        }}/>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-mono" style={{ color:"#94a3b8" }}>
                      {voiceProgress>0 ? `${Math.floor(voiceProgress*42)}с / 0:42` : "0:42"}
                    </span>
                    <button onClick={() => setVoiceSpeed(s => s===1 ? 1.5 : s===1.5 ? 2 : 1)}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all"
                      style={{ background: m.accentColor+"18", color: m.accentColor }}>
                      ×{voiceSpeed}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI transcript strip */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 border-t"
                style={{ borderColor: m.accentColor+"20", background: m.accentColor+"08" }}>
                <Brain style={{ width:10,height:10,color: m.accentColor+"99" }}/>
                <span className="text-[10px] italic leading-tight" style={{ color: m.accentColor+"aa" }}>«Хотела рассказать о макетах...»</span>
              </div>
            </div>
            <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"#c0c8d8" }}>14:05</span>
          </div>
        </div>

        {/* ── VIDEO CIRCLE — tap=inline expand, 3×tap=fullscreen ── */}
        <div className="flex items-end ml-auto">
          <div className="flex flex-col items-end">
            {!inlineExpanded && (
              <span className="text-[9px] mb-1 mr-1" style={{ color: m.accentColor+"66" }}>
                3× для полного экрана
              </span>
            )}
            <button onClick={handleVideoClick}
              className="relative rounded-full overflow-hidden block"
              style={{
                width: inlineExpanded ? 230 : 140,
                height: inlineExpanded ? 230 : 140,
                transition:"width 0.45s cubic-bezier(0.34,1.4,0.64,1), height 0.45s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.4s",
                background:`linear-gradient(135deg,${m.accentColor}44,${m.accentColor}11)`,
                border:`2.5px solid ${m.accentColor}66`,
                boxShadow: inlineExpanded
                  ? `0 16px 56px ${m.accentGlow}, 0 0 0 6px ${m.accentColor}18`
                  : `0 8px 32px ${m.accentGlow}, 0 0 0 4px ${m.accentColor}14`,
              }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full opacity-15"
                  style={{ width: inlineExpanded ? 110 : 70, height: inlineExpanded ? 110 : 70,
                    background:`radial-gradient(circle,${m.accentColor},transparent 70%)`,
                    transition:"width 0.45s,height 0.45s" }}/>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full flex items-center justify-center transition-all"
                  style={{ width: inlineExpanded ? 68 : 46, height: inlineExpanded ? 68 : 46,
                    background:"rgba(255,255,255,0.55)", backdropFilter:"blur(8px)",
                    boxShadow:`0 0 18px ${m.accentGlow}`,
                    transition:"width 0.45s,height 0.45s" }}>
                  {videoPlaying
                    ? <Pause style={{ width: inlineExpanded ? 26 : 18, height: inlineExpanded ? 26 : 18, color: m.accentColor, transition:"width 0.3s,height 0.3s" }}/>
                    : <Play  style={{ width: inlineExpanded ? 26 : 18, height: inlineExpanded ? 26 : 18, color: m.accentColor, marginLeft: inlineExpanded ? 4 : 3, transition:"width 0.3s,height 0.3s" }}/>}
                </div>
              </div>
              <span className="absolute font-mono"
                style={{ bottom: inlineExpanded ? 18 : 12, right: inlineExpanded ? 20 : 14,
                  fontSize: inlineExpanded ? 12 : 10, color:"white",
                  background:"rgba(0,0,0,0.32)", padding:"2px 6px", borderRadius:4,
                  transition:"all 0.3s" }}>
                {videoPlaying ? "0:08" : "0:15"}
              </span>
              {inlineExpanded && (
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 230 230" style={{ opacity:0.45 }}>
                  <circle cx="115" cy="115" r="111" fill="none" stroke={m.accentColor} strokeWidth="2.5"
                    strokeDasharray="697" strokeDashoffset={videoPlaying ? "349" : "697"}
                    style={{ transition:"stroke-dashoffset 8s linear", transformOrigin:"center", transform:"rotate(-90deg)" }}/>
                </svg>
              )}
              {!inlineExpanded && (
                <div className="absolute inset-[-4px] rounded-full pointer-events-none"
                  style={{ border:`1.5px solid ${m.accentColor}44`, animation:"ringPulseL 2.5s ease-in-out infinite" }}/>
              )}
            </button>
            {inlineExpanded && (
              <span className="text-[9px] mt-1 mr-1" style={{ color: m.accentColor+"66" }}>
                нажмите чтобы свернуть · 3× полный экран
              </span>
            )}
            <div className="flex items-center justify-end gap-1 mt-1.5 mr-0.5">
              <span className="text-[10px]" style={{ color:"#c0c8d8" }}>14:07</span>
              <ReadTickL color={m.accentColor} />
            </div>
          </div>
        </div>

        {/* Incoming + reactions */}
        <div className="flex items-end gap-1.5 max-w-[82%]">
          <Avatar className="w-7 h-7 shrink-0 mb-6">
            <AvatarFallback className="text-[9px] font-semibold" style={{ background: m.accentColor+"18", color: m.accentColor }}>АИ</AvatarFallback>
          </Avatar>
          <div>
            <div className="px-4 py-2.5 rounded-[20px] rounded-bl-[6px] text-[14px] shadow-sm transition-all duration-500"
              style={{ background: m.bubbleIn, border:`1px solid ${m.bubbleInBorder}`, color:"#1a1a2e" }}>
              Класс! Очень современно 🔥
            </div>
            <div className="flex gap-1.5 mt-1 ml-1.5">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border shadow-sm"
                style={{ background:"#fff",borderColor:"rgba(0,0,0,0.08)" }}>❤️ <span style={{ color:"#94a3b8",fontSize:11 }}>2</span></span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-500"
                style={{ background: m.accentColor+"14", borderColor: m.accentColor+"33" }}>🔥 <span style={{ color: m.accentColor,fontSize:11 }}>1</span></span>
            </div>
            <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"#c0c8d8" }}>14:09</span>
          </div>
        </div>

        {/* AI Summary */}
        <div className="flex justify-center my-1">
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl w-full shadow-sm mood-tr-l"
            style={{ background: m.accentColor+"10", border:`1px solid ${m.accentColor}28`, backdropFilter:"blur(8px)" }}>
            <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: m.accentColor+"20" }}>
              <Brain style={{ width:14,height:14,color: m.accentColor }}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold" style={{ color: m.accentColor }}>AI сжал 24 сообщения за 3 дня</div>
              <div className="text-[11px] truncate" style={{ color:"#94a3b8" }}>Дизайн, встреча в пятницу, фото из Питера</div>
            </div>
          </div>
        </div>

        {/* Forwarded */}
        <div className="flex items-end gap-1.5 max-w-[80%] ml-auto flex-row-reverse">
          <div>
            <div className="px-4 py-2.5 rounded-[20px] rounded-br-[6px] text-[14px] leading-relaxed text-white mood-tr-l"
              style={{ background: outBubble, boxShadow:`0 4px 18px ${m.accentGlow}` }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ opacity:0.7 }}>
                <Forward style={{ width:11,height:11 }}/>
                <span className="text-[10px]">Максим Орлов</span>
              </div>
              Не забудь встречу в пятницу 18:00 🗓
            </div>
            <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
              <span className="text-[10px]" style={{ color:"#c0c8d8" }}>14:12</span>
              <ReadTickL color={m.accentColor} />
            </div>
          </div>
        </div>

        {/* Link preview */}
        <div className="flex items-end gap-1.5 max-w-[85%]">
          <Avatar className="w-7 h-7 shrink-0 mb-1">
            <AvatarFallback className="text-[9px] font-semibold" style={{ background: m.accentColor+"18", color: m.accentColor }}>АИ</AvatarFallback>
          </Avatar>
          <div>
            <div className="rounded-[20px] rounded-bl-[6px] overflow-hidden shadow-sm transition-all duration-500"
              style={{ background: m.bubbleIn, border:`1px solid ${m.bubbleInBorder}` }}>
              <div className="h-20 flex items-center justify-center"
                style={{ background:`linear-gradient(135deg,${m.accentColor}14,${m.accentColor}06)` }}>
                <Image style={{ width:28,height:28,color: m.accentColor+"55" }}/>
              </div>
              <div className="px-3 py-2">
                <div className="text-[10px] mb-0.5" style={{ color: m.accentColor }}>medium.com</div>
                <div className="text-[12px] font-medium leading-snug" style={{ color:"#1a1a2e" }}>Дизайн 2040: интерфейсы будущего</div>
              </div>
            </div>
            <span className="text-[10px] ml-1.5 mt-0.5 block" style={{ color:"#c0c8d8" }}>14:15</span>
          </div>
        </div>

      </div>

      {/* SMART REPLIES — hide during recording */}
      {recState === "idle" && (
        <div className="shrink-0 px-3 pb-1.5 flex gap-2 overflow-x-auto relative" style={{ scrollbarWidth:"none",zIndex:10 }}>
          {["Буду! 🙌","Скоро","Понял 👍","Напомни","Класс! 🔥"].map(r=>(
            <button key={r} onClick={() => { setActiveSR(r); setInputText(r); }}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-300 border whitespace-nowrap"
              style={activeSR===r
                ? { background: m.accentColor+"18", color: m.accentColor, borderColor: m.accentColor+"44" }
                : { background:"#ffffff", color:"#6b7280", borderColor:"rgba(0,0,0,0.07)" }}>
              {r}
            </button>
          ))}
        </div>
      )}

      {/* EMOJI PANEL */}
      {showEmoji && recState === "idle" && (
        <div className="shrink-0 relative" style={{ zIndex:11, background:"rgba(255,255,255,0.98)", borderTop:`1px solid ${m.accentColor}22`, animation:"emojiPanelInL 0.28s cubic-bezier(0.34,1.2,0.64,1)" }}>
          <div className="flex items-center gap-1 px-3 pt-2 pb-1">
            {(["emoji","sticker","gif"] as const).map(tab => (
              <button key={tab} onClick={() => setEmojiTab(tab)}
                className="px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border"
                style={{ background: emojiTab===tab ? m.accentColor+"18" : "transparent",
                  borderColor: emojiTab===tab ? m.accentColor+"44" : "transparent",
                  color: emojiTab===tab ? m.accentColor : "#94a3b8" }}>
                {tab==="emoji" ? "😊 Эмодзи" : tab==="sticker" ? "🎭 Стикеры" : "GIF"}
              </button>
            ))}
            <button onClick={() => setShowEmoji(false)} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center" style={{ background:"rgba(0,0,0,0.05)" }}>
              <X style={{ width:13,height:13,color:"#94a3b8" }}/>
            </button>
          </div>

          {emojiTab==="emoji" && (
            <div style={{ height:196, overflowY:"auto", scrollbarWidth:"none", padding:"4px 12px 8px" }}>
              {EMOJI_ROWS_L.map((row,ri) => (
                <div key={ri} className="flex gap-1 mb-1">
                  {row.map(emj => (
                    <button key={emj} onClick={() => { setInputText(t=>t+emj); inputRef.current?.focus(); }}
                      style={{ flex:1, fontSize:22, padding:"4px 0", borderRadius:10, background:"transparent", border:"none", cursor:"pointer", lineHeight:1.2, transition:"transform 0.1s" }}
                      onPointerDown={e=>(e.currentTarget.style.transform="scale(1.3)")}
                      onPointerUp={e=>(e.currentTarget.style.transform="scale(1)")}>
                      {emj}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {emojiTab==="sticker" && (
            <div style={{ height:196, overflowY:"auto", scrollbarWidth:"none", padding:"8px 12px" }}>
              <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                {STICKERS_L.map((s,i) => (
                  <button key={i} onClick={() => setInputText(t=>t+s.emoji+" ")}
                    style={{ borderRadius:16, overflow:"hidden", background:s.bg, border:`1px solid rgba(0,0,0,0.06)`,
                      aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
                      cursor:"pointer", transition:"transform 0.12s" }}
                    onPointerDown={e=>(e.currentTarget.style.transform="scale(0.92)")}
                    onPointerUp={e=>(e.currentTarget.style.transform="scale(1)")}>
                    <span style={{ fontSize:36, lineHeight:1 }}>{s.emoji}</span>
                    <span style={{ fontSize:9, color:"#6b7280" }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {emojiTab==="gif" && (
            <div style={{ height:196, padding:"8px 12px" }}>
              <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
                {["🎬","🎥","📽️","🎞️","🎦","🎠","🌊","🌋","🎆"].map((g,i) => (
                  <div key={i} style={{ borderRadius:12, aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center",
                    background:`linear-gradient(135deg,${m.accentColor}15,rgba(0,0,0,0.03))`,
                    border:`1px solid ${m.accentColor}18`, fontSize:28 }}>
                    {g}
                  </div>
                ))}
              </div>
              <p className="text-center text-[10px] mt-2" style={{ color:"#c0c8d8" }}>GIF-поиск · PULSE 2040</p>
            </div>
          )}
        </div>
      )}

      {/* INPUT BAR */}
      <div className="shrink-0 relative" style={{ zIndex:10 }}>
        <div className="absolute inset-0" style={{
          background:"rgba(255,255,255,0.92)", backdropFilter:"blur(24px)",
          borderTop:`1px solid ${recState!=="idle" ? "rgba(239,68,68,0.3)" : showEmoji ? m.accentColor+"44" : m.accentColor+"18"}`,
          transition:"border-color 0.3s" }}/>

        {recState === "idle" ? (
          <div className="relative flex items-center gap-2 px-3 py-2 pb-7">
            <button className="w-9 h-9 rounded-full flex items-center justify-center">
              <Paperclip style={{ width:19,height:19,color:"#94a3b8" }}/>
            </button>

            <div className="flex-1 flex items-center gap-2 px-4 h-11 rounded-full border mood-tr-l"
              style={{ background: inputText ? "#ffffff" : "#f1f4fc",
                borderColor: (showEmoji||inputText) ? m.accentColor+"55" : m.accentColor+"33" }}>
              <input ref={inputRef} value={inputText} onChange={e=>setInputText(e.target.value)}
                placeholder="Сообщение..."
                className="flex-1 bg-transparent outline-none text-[14px]"
                style={{ color:"#1a1a2e", caretColor: m.accentColor }}
                onFocus={() => setShowEmoji(false)}
              />
              <button onClick={() => { setShowEmoji(s=>!s); if (!showEmoji) SNDL.menuOpen(); }}
                style={{ flexShrink:0, lineHeight:1 }}>
                <Smile style={{ width:18,height:18,color: showEmoji ? m.accentColor : m.accentColor+"77",
                  transition:"color 0.2s,transform 0.2s", transform: showEmoji ? "rotate(15deg) scale(1.15)":"scale(1)" }}/>
              </button>
            </div>

            {!inputText && (
              <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{ background: m.accentColor+"12", border:`1px solid ${m.accentColor}22` }}>
                <Camera style={{ width:18,height:18,color: m.accentColor+"99" }}/>
              </button>
            )}

            <button
              className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 text-white"
              style={{ background: inputText ? m.accentColor : "rgba(239,68,68,0.85)", transform: inputText?"scale(1.05)":"scale(1)" }}
              onClick={() => {
                if (inputText) { SNDL.menuOpen(); setInputText(""); setActiveSR(null); setShowEmoji(false); }
                else { setRecState("rec"); setShowEmoji(false); toneL(220,280,0.12,0.07); }
              }}>
              <div style={{ transition:"all 0.2s", transform: inputText?"rotate(0deg) scale(1)":"rotate(-30deg) scale(0.85)", opacity:inputText?1:0, position:"absolute" }}>
                <Send style={{ width:17,height:17,color:"white",marginRight:2,marginBottom:1 }}/>
              </div>
              <div style={{ transition:"all 0.2s", transform: inputText?"rotate(30deg) scale(0.85)":"rotate(0deg) scale(1)", opacity:inputText?0:1, position:"absolute" }}>
                <Mic style={{ width:18,height:18 }}/>
              </div>
            </button>
          </div>

        ) : recState === "rec" ? (
          <div className="relative pb-7">
            <div className="flex justify-end pr-4 pt-1 pb-0.5">
              <div className="flex flex-col items-center gap-1 animate-bounce" style={{ animationDuration:"1.8s" }}>
                <Lock style={{ width:14,height:14,color:"#94a3b8" }}/>
                <div style={{ width:1,height:10,background:"rgba(0,0,0,0.1)" }}/>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <button className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background:"rgba(0,0,0,0.05)" }} onClick={() => setRecState("idle")}>
                <Trash style={{ width:16,height:16,color:"#94a3b8" }}/>
              </button>
              <div className="flex-1 flex items-center gap-3 h-11 px-4 rounded-full"
                style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.18)" }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#ef4444",animation:"recPulseL 1s ease-in-out infinite" }}/>
                <span className="text-[13px] font-mono font-medium" style={{ color:"#1a1a2e",minWidth:36 }}>
                  {`${Math.floor(recSec/60)}:${String(recSec%60).padStart(2,"0")}`}
                </span>
                <div className="flex-1 flex items-center gap-[2.5px] h-5 overflow-hidden">
                  {BARS.slice(0,20).map((h,i) => (
                    <div key={i} style={{ flex:1,borderRadius:999,height:Math.max(2,(h/15)*18),
                      background:"rgba(239,68,68,0.5)",animation:`sndBarL ${0.5+i*0.04}s ease-in-out ${i*0.07}s infinite alternate` }}/>
                  ))}
                </div>
                <span className="text-[10px] shrink-0" style={{ color:"#c0c8d8",animation:"slideHintL 1.2s ease-in-out infinite" }}>←</span>
              </div>
              <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
                style={{ background:"#ef4444",animation:"recPulseL 1.2s ease-in-out infinite" }}
                onClick={() => { setRecState("idle"); SNDL.menuOpen(); }}>
                <Mic style={{ width:18,height:18 }}/>
              </button>
            </div>
            <p className="text-center text-[9.5px] pb-1" style={{ color:"#c0c8d8" }}>
              Удержите для блокировки · Отпустите для отправки
            </p>
          </div>

        ) : (
          <div className="relative pb-7">
            <div className="flex items-center gap-2 px-3 py-2">
              <button className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)" }}
                onClick={() => setRecState("idle")}>
                <Trash style={{ width:16,height:16,color:"#f87171" }}/>
              </button>
              <div className="flex-1 flex items-center gap-2 h-11 px-3 rounded-full"
                style={{ background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.18)" }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#ef4444",animation:"recPulseL 1s ease-in-out infinite" }}/>
                <span className="text-[13px] font-mono font-medium" style={{ color:"#1a1a2e" }}>
                  {`${Math.floor(recSec/60)}:${String(recSec%60).padStart(2,"0")}`}
                </span>
                <div className="flex-1 flex items-center gap-[2.5px] h-5">
                  {BARS.slice(0,20).map((h,i) => (
                    <div key={i} style={{ flex:1,borderRadius:999,height:Math.max(2,(h/15)*18),
                      background:"rgba(239,68,68,0.5)",animation:`sndBarL ${0.5+i*0.04}s ease-in-out ${i*0.07}s infinite alternate`}}/>
                  ))}
                </div>
              </div>
              <button className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background:"rgba(0,0,0,0.05)",border:"1px solid rgba(0,0,0,0.08)" }}
                onClick={() => setRecState("idle")}>
                <Square style={{ width:14,height:14,color:"#6b7280" }}/>
              </button>
              <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
                style={{ background: m.accentColor }}
                onClick={() => { setRecState("idle"); SNDL.menuOpen(); }}>
                <Send style={{ width:17,height:17 }}/>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>{/* end swipeable wrapper */}

      {/* VIDEO EXPANDED OVERLAY */}
      {expandedVideo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background:"rgba(0,0,0,0.78)", backdropFilter:"blur(28px)" }}
          onClick={()=>{ setExpandedVideo(false); setVideoPlaying(false); }}>
          <div className="flex flex-col items-center gap-6" onClick={e=>e.stopPropagation()}>
            <div className="relative rounded-full overflow-hidden"
              style={{ width:280,height:280,
                background:`linear-gradient(135deg,${m.accentColor}55,${m.accentColor}18)`,
                border:`3px solid ${m.accentColor}99`,
                boxShadow:`0 0 80px ${m.accentGlow}, 0 0 0 8px ${m.accentColor}14`,
                animation:"expandCircleL 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full opacity-20" style={{ width:130,height:130,
                  background:`radial-gradient(circle,${m.accentColor},transparent 70%)` }}/>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={()=>setVideoPlaying(!videoPlaying)}
                  className="rounded-full flex items-center justify-center"
                  style={{ width:72,height:72,background:"rgba(255,255,255,0.6)",backdropFilter:"blur(10px)",
                    boxShadow:`0 0 24px ${m.accentGlow}` }}>
                  {videoPlaying
                    ? <Pause style={{ width:26,height:26,color: m.accentColor }}/>
                    : <Play style={{ width:26,height:26,color: m.accentColor,marginLeft:4 }}/>}
                </button>
              </div>
              <svg className="absolute inset-0" viewBox="0 0 280 280" style={{ opacity:0.4 }}>
                <circle cx="140" cy="140" r="136" fill="none" stroke={m.accentColor} strokeWidth="2"
                  strokeDasharray="855" strokeDashoffset={videoPlaying ? "428" : "855"}
                  style={{ transition:"stroke-dashoffset 8s linear",transformOrigin:"center",transform:"rotate(-90deg)" }}/>
              </svg>
              <span className="absolute font-mono"
                style={{ bottom:22,right:24,fontSize:13,color:"white",
                  background:"rgba(0,0,0,0.42)",padding:"3px 8px",borderRadius:6 }}>
                {videoPlaying ? "0:08" : "0:15"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={()=>setVideoPlaying(!videoPlaying)}
                className="flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white"
                style={{ background: m.accentColor, boxShadow:`0 0 24px ${m.accentGlow}` }}>
                {videoPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4 ml-0.5"/>}
                {videoPlaying ? "Пауза" : "Играть"}
              </button>
              <button onClick={()=>{ setExpandedVideo(false); setVideoPlaying(false); }}
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.25)" }}>
                <X style={{ width:18,height:18,color:"white" }}/>
              </button>
            </div>
            <p className="text-[11px]" style={{ color:"rgba(255,255,255,0.4)" }}>Нажмите на фон, чтобы закрыть</p>
          </div>
        </div>
      )}

      {/* ── SETTINGS OVERLAY (light) ── */}
      {showSettings && (
        <div className="absolute inset-0 z-[60] flex flex-col overflow-hidden"
          style={{ background:"rgba(238,241,251,0.96)", backdropFilter:"blur(24px)", animation:"settingsInL 0.32s cubic-bezier(0.2,0,0,1)" }}>

          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-4 border-b border-black/[0.07]" style={{ background:"rgba(255,255,255,0.85)" }}>
            <button onClick={() => { setShowSettings(false); setSettingsTab("main"); }}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background:"rgba(0,0,0,0.06)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/></svg>
            </button>
            <div>
              <div className="text-[17px] font-bold" style={{ color:"#1a1a2e" }}>Настройки чата</div>
              <div className="text-[12px]" style={{ color:"#94a3b8" }}>Фон и цвет сообщений</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth:"none" }}>

            {/* Media section */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"#ffffff", border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
              <button className="w-full flex items-center gap-3 px-4 py-3.5"
                onClick={() => setSettingsTab(settingsTab === "media" ? "main" : "media")}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background:"rgba(99,102,241,0.1)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#6366f1" strokeWidth="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="#6366f1"/><path d="m21 15-5-5L5 21" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[14px] font-semibold" style={{ color:"#1a1a2e" }}>Медиафайлы и ссылки</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: settingsTab==="media" ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.25s ease" }}>
                  <path d="M9 18l6-6-6-6" stroke="#c0c8d8" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {settingsTab === "media" && (
                <div className="px-3 pb-3 border-t border-black/[0.06]" style={{ animation:"settingsInL 0.22s ease" }}>
                  <div className="grid grid-cols-3 gap-1.5 pt-3">
                    {MEDIA_ITEMS_L.map((item,i) => (
                      <div key={i} className="aspect-square rounded-xl overflow-hidden flex items-center justify-center text-[28px]"
                        style={{ background: item.bg }}>
                        <span style={{ filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.15))" }}>{item.emoji}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-center text-[11px]" style={{ color:"#94a3b8" }}>9 общих медиафайлов</div>
                </div>
              )}
            </div>

            {/* Background section */}
            <div className="text-[11px] font-semibold mb-2 px-1" style={{ color:"#94a3b8", letterSpacing:"0.05em", textTransform:"uppercase" }}>Фон чата</div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"#ffffff", border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
              {([
                { key:"matte",    label:"Матовый белый",         sub:"Чистый светлый, слегка матовый",   swatch:"linear-gradient(135deg,#f0f3ff,#eef1fb)" },
                { key:"solid",    label:"Премиум однотонно",     sub:"Тёплый лавандовый тон",            swatch:"linear-gradient(135deg,#ede8fb,#edf0fb)" },
                { key:"gradient", label:"Лёгкий премиум градиент", sub:"Мягкий фиолетово-голубой",      swatch:"linear-gradient(135deg,#ede8fb,#eef1fb,#e8f0fb)" },
              ] as const).map(({ key, label, sub, swatch }) => (
                <button key={key} onClick={() => setBgTexture(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0"
                  style={{ borderColor:"rgba(0,0,0,0.06)" }}>
                  <div className="w-12 h-9 rounded-xl shrink-0 border border-black/[0.08]" style={{ background: swatch }} />
                  <div className="flex-1 text-left">
                    <div className="text-[14px] font-medium" style={{ color:"#1a1a2e" }}>{label}</div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color:"#94a3b8" }}>{sub}</div>
                  </div>
                  {bgTexture === key && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={m.accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>

            {/* Message color */}
            <div className="text-[11px] font-semibold mb-2 px-1" style={{ color:"#94a3b8", letterSpacing:"0.05em", textTransform:"uppercase" }}>Цвет моих сообщений</div>
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"#ffffff", border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
              {([
                { key:"accent", label:"Основной",  dot: m.accentColor },
                { key:"grey",   label:"Серый",     dot:"#6b7280" },
                { key:"purple", label:"Фиолетовый",dot:"#9333ea" },
                { key:"blue",   label:"Голубой",   dot:"#3b82f6" },
              ] as const).map(({ key, label, dot }) => (
                <button key={key} onClick={() => setMsgColorKey(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0"
                  style={{ borderColor:"rgba(0,0,0,0.06)" }}>
                  <div className="w-8 h-8 rounded-full shrink-0" style={{ background: dot }} />
                  <div className="flex-1 text-left text-[14px] font-medium" style={{ color:"#1a1a2e" }}>{label}</div>
                  {msgColorKey === key && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke={m.accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              ))}
            </div>

            {/* Toggles */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"#ffffff", border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
              {([
                { label:"Проверка орфографии", sub:"Автоисправление в этом чате", val:spellCheck,     set:setSpellCheck     },
                { label:"Переводить входящие", sub:"На ваш язык автоматически",   val:autoTranslate,  set:setAutoTranslate  },
              ] as const).map(({ label, sub, val, set }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor:"rgba(0,0,0,0.06)" }}>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium" style={{ color:"#1a1a2e" }}>{label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color:"#94a3b8" }}>{sub}</div>
                  </div>
                  <button onClick={() => set(!val)}
                    className="shrink-0 w-12 h-7 rounded-full relative transition-all duration-300"
                    style={{ background: val ? m.accentColor : "rgba(0,0,0,0.15)" }}>
                    <span className="absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
                      style={{ left: val ? "calc(100% - 24px)" : "4px" }} />
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes storyRingSpinL { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sndBarL      { from{transform:scaleY(0.35)} to{transform:scaleY(1.5)} }
        @keyframes typDotL      { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }
        @keyframes floatHeartL  { 0%{transform:translateY(0) scale(1);opacity:.18} 50%{opacity:.32} 100%{transform:translateY(-80vh) scale(0.7);opacity:0} }
        @keyframes waveMoveL    { 0%{transform:translateX(0)} 100%{transform:translateX(-6%)} }
        @keyframes sparkPopL    { 0%,100%{transform:scale(1);opacity:.2} 50%{transform:scale(2.2);opacity:.4} }
        @keyframes tensePulseL  { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0)} 50%{box-shadow:0 0 12px 3px rgba(220,38,38,0.18)} }
        @keyframes ringPulseL   { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.06);opacity:.15} }
        @keyframes expandCircleL{ from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes statusFadeL  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotsAnimL    { 0%{width:0} 25%{width:5px} 50%{width:10px} 75%{width:15px} 100%{width:0} }
        @keyframes emojiPanelInL{ from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
        @keyframes recPulseL    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.65;transform:scale(0.88)} }
        @keyframes slideHintL   { 0%,100%{opacity:0.3;transform:translateX(0)} 50%{opacity:0.65;transform:translateX(-5px)} }
        @keyframes moodPatInL   { from{opacity:0} to{opacity:1} }
        @keyframes moodPatOutL  { from{opacity:1} to{opacity:0} }
        @keyframes settingsInL  { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .mood-tr-l {
          transition:
            color 5s cubic-bezier(0.4,0,0.2,1),
            background-color 5s cubic-bezier(0.4,0,0.2,1),
            border-color 5s cubic-bezier(0.4,0,0.2,1),
            box-shadow 5s cubic-bezier(0.4,0,0.2,1),
            fill 5s cubic-bezier(0.4,0,0.2,1),
            stroke 5s cubic-bezier(0.4,0,0.2,1) !important;
        }
      ` }} />
    </div>
  );
}
