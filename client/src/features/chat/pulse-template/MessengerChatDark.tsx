import React, { useState } from "react";
import {
  Search, Phone, Video, MoreHorizontal, Smile, Paperclip,
  Mic, Play, ChevronDown, Brain,
  Image, Forward, MessageCircle, LayoutList,
  LayoutGrid, Settings, X, Pause,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function ReadTickDD() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[0.4, 1].map((op, i) => (
        <div key={i} style={{
          width: 12, height: 2.5, borderRadius: 99,
          background: "#a5b4fc", opacity: op,
          boxShadow: i === 1 ? "0 0 4px #a5b4fc88" : "none",
        }} />
      ))}
    </div>
  );
}

const CHATS = [
  { id: 1, name: "Алиса Иванова",   init: "АИ", sub: "Видеокружок",           time: "сейчас", unread: 0, online: true,  active: true,  vid: true  },
  { id: 2, name: "Максим Орлов",    init: "МО", sub: "ок понял 👍",            time: "14:22",  unread: 3, online: true,  active: false, vid: false },
  { id: 3, name: "Команда дизайна", init: "КД", sub: "Аня: посмотрите макет", time: "13:11",  unread: 0, online: false, active: false, vid: false },
  { id: 4, name: "Анна Петрова",    init: "АП", sub: "Голосовое сообщение",   time: "вчера",  unread: 1, online: false, active: false, vid: false },
  { id: 5, name: "Денис",           init: "Д",  sub: "📸 Фото",               time: "вчера",  unread: 0, online: false, active: false, vid: false },
];

const BARS = [3,5,8,12,9,14,10,6,11,15,8,5,13,9,4,7,12,10,6,14,9,5,11,8,15,7,4,10,13,6,9,12,5,8,11,7,14,10,4,8,12,6,9,5,13,10,7,4];
const SMART_REPLIES = ["Буду! 🙌", "Уже знаю", "Напомни завтра"];

const NAV = [
  { icon: MessageCircle, label: "Чаты",     active: true  },
  { icon: LayoutList,    label: "Лента",    active: false },
  { icon: null,          label: "PULSE",    active: false, center: true },
  { icon: LayoutGrid,    label: "Борд",     active: false },
  { icon: Settings,      label: "Настройки",active: false },
];

export function MessengerChatDark() {
  const [input, setInput]                   = useState("");
  const [voicePlaying, setVoicePlaying]     = useState(false);
  const [activeSmartReply, setActiveSmartReply] = useState<string | null>(null);
  const [expandedVideo, setExpandedVideo]   = useState(false);
  const [videoPlaying, setVideoPlaying]     = useState(false);

  return (
    <div className="flex h-screen w-full text-white overflow-hidden select-none"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", background: "#080810" }}>

      {/* ── SIDEBAR ── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r h-full"
        style={{ background: "rgba(10,10,22,0.97)", borderColor: "rgba(255,255,255,0.05)" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-[11px] font-black text-white leading-none">P</span>
            </div>
            <span className="text-[14px] font-semibold text-white/80 tracking-widest">PULSE</span>
            <div className="ml-auto w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.07] transition-colors cursor-pointer">
              <MoreHorizontal className="w-4 h-4 text-white/35" />
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input placeholder="Поиск..." readOnly
              className="w-full h-9 rounded-xl pl-9 pr-3 text-[12px] text-white/60 placeholder:text-white/25 outline-none border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }} />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {CHATS.map(c => (
            <div key={c.id}
              className={cn("flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative",
                !c.active && "hover:bg-white/[0.03]")}
              style={c.active ? { background: "rgba(99,102,241,0.12)" } : {}}>
              {c.active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-indigo-400" />}
              <div className="relative shrink-0">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="text-[11px] font-semibold"
                    style={{ background: c.active ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)", color: c.active ? "#a5b4fc" : "rgba(255,255,255,0.55)" }}>
                    {c.init}
                  </AvatarFallback>
                </Avatar>
                {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2" style={{ borderColor: "#0a0a16" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-white/85 truncate">{c.name}</span>
                  <span className="text-[10px] text-white/28 shrink-0 ml-1">{c.time}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {c.vid && <Video className="w-3 h-3 text-white/30 shrink-0" />}
                  <span className="text-[11px] text-white/35 truncate">{c.sub}</span>
                </div>
              </div>
              {c.unread > 0 && (
                <span className="shrink-0 min-w-[18px] px-1 h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: "#6366f1" }}>{c.unread}</span>
              )}
            </div>
          ))}
        </div>

        {/* ── BOTTOM NAV (like screenshot) ── */}
        <div className="shrink-0 border-t px-2 py-2"
          style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(8,8,16,0.98)" }}>
          <div className="flex items-center justify-around">
            {NAV.map(({ icon: Icon, label, active, center }) => (
              <button key={label}
                className={cn("flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all",
                  active ? "" : "hover:bg-white/[0.05]")}
                style={{ minWidth: 44 }}>
                {center ? (
                  /* Bird / logo center button */
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                    </svg>
                  </div>
                ) : Icon ? (
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                    active ? "" : "")}
                    style={active ? { background: "rgba(99,102,241,0.20)" } : {}}>
                    <Icon className="w-[18px] h-[18px]"
                      style={{ color: active ? "#818cf8" : "rgba(255,255,255,0.32)" }} />
                  </div>
                ) : null}
                <span className="text-[9px] font-medium leading-none"
                  style={{ color: active ? "#818cf8" : "rgba(255,255,255,0.28)" }}>
                  {center ? "" : label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CHAT ── */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">

        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
          style={{ background: "rgba(10,10,22,0.7)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.05)" }}>
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="text-[11px] font-semibold" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-white/90">Алиса Иванова</div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              В сети
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[Phone, Video, Search, MoreHorizontal].map((Icon, i) => (
              <button key={i} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.07] transition-colors">
                <Icon className="w-4 h-4 text-white/40" />
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1.5" style={{ scrollbarWidth: "none" }}>

          <div className="flex items-center justify-center my-2">
            <span className="text-[10px] text-white/28 px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>Сегодня</span>
          </div>

          {/* Incoming */}
          <div className="flex items-end gap-2 max-w-[65%]">
            <Avatar className="w-6 h-6 shrink-0 mb-1">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-[13px] leading-relaxed text-white/80"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Привет! Смотри, я тут набросала макеты для новой фичи 🎨
              </div>
              <span className="text-[10px] text-white/25 ml-2 mt-0.5 block">14:01</span>
            </div>
          </div>

          {/* Outgoing */}
          <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-[13px] leading-relaxed text-white"
                style={{ background: "rgba(99,102,241,0.88)" }}>
                О, покажи! Сейчас гляну 👀
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
                <span className="text-[10px] text-white/25">14:02</span>
                <ReadTickDD />
              </div>
            </div>
          </div>

          {/* Voice */}
          <div className="flex items-end gap-2 max-w-[70%]">
            <Avatar className="w-6 h-6 shrink-0 mb-4">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-bl-sm"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => setVoicePlaying(!voicePlaying)}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{ background: voicePlaying ? "#6366f1" : "rgba(255,255,255,0.10)" }}>
                  {voicePlaying
                    ? <div className="flex gap-0.5">{[0,1,2].map(i => <div key={i} className="w-0.5 h-4 rounded-full bg-white" style={{ animation: `soundBar 0.6s ease-in-out ${i*0.15}s infinite alternate` }} />)}</div>
                    : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
                </button>
                <div className="flex items-center gap-[2px] h-8">
                  {BARS.map((h, i) => (
                    <div key={i} className="w-[3px] rounded-full"
                      style={{ height: `${(h/15)*28}px`, background: voicePlaying && i < 18 ? "#818cf8" : "rgba(255,255,255,0.22)" }} />
                  ))}
                </div>
                <span className="text-[11px] text-white/40 shrink-0 font-mono">0:42</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 ml-1">
                <Brain className="w-2.5 h-2.5 text-violet-400/60" />
                <span className="text-[10px] text-violet-400/50 italic">«Хотела рассказать о макетах...»</span>
              </div>
              <span className="text-[10px] text-white/25 ml-2 mt-0.5 block">14:05</span>
            </div>
          </div>

          {/* Outgoing VIDEO CIRCLE — bigger, clickable */}
          <div className="flex items-end gap-2 max-w-[55%] ml-auto flex-row-reverse">
            <div>
              <button onClick={() => { setExpandedVideo(true); setVideoPlaying(true); }}
                className="relative rounded-full overflow-hidden cursor-pointer group block transition-transform hover:scale-[1.03] active:scale-95"
                style={{ width: 160, height: 160, background: "linear-gradient(135deg,#1a1a2e,#3a3060)", border: "2.5px solid rgba(99,102,241,0.5)", boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}>
                {/* Simulated video gradient */}
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 35%, rgba(80,60,180,0.5) 0%, rgba(15,10,40,0.9) 70%)" }} />
                {/* Subtle face silhouette */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full opacity-20" style={{ width: 80, height: 80, background: "radial-gradient(circle, rgba(200,180,255,0.6), transparent 70%)" }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ width: 48, height: 48, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}>
                    <Play style={{ width: 20, height: 20, color: "white", marginLeft: 3 }} />
                  </div>
                </div>
                <span className="absolute font-mono"
                  style={{ bottom: 14, right: 16, fontSize: 10, color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 4 }}>0:15</span>
                {/* Ring animation on hover */}
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ boxShadow: "inset 0 0 0 2px rgba(99,102,241,0.7)" }} />
              </button>
              <div className="flex items-center justify-end gap-1 mt-2 mr-1">
                <span className="text-[10px] text-white/25">14:07</span>
                <ReadTickDD />
              </div>
            </div>
          </div>

          {/* Incoming + reactions */}
          <div className="flex items-end gap-2 max-w-[65%]">
            <Avatar className="w-6 h-6 shrink-0 mb-5">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-[13px] text-white/80"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Класс! Выглядит очень современно 🔥
              </div>
              <div className="flex gap-1 mt-1 ml-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>❤️ <span className="text-white/45">2</span></span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>🔥 <span className="text-indigo-300/70">1</span></span>
              </div>
              <span className="text-[10px] text-white/25 ml-2 mt-0.5 block">14:09</span>
            </div>
          </div>

          {/* AI Summary */}
          <div className="flex justify-center my-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl max-w-[420px] w-full cursor-pointer"
              style={{ background: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(139,92,246,0.25)", boxShadow: "0 0 10px rgba(139,92,246,0.3)" }}>
                <Brain className="w-4 h-4 text-violet-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-violet-300 mb-0.5">AI сжал 24 сообщения за 3 дня</div>
                <div className="text-[11px] text-white/40 truncate">Обсуждали дизайн, встречу в пятницу и фото из Питера</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-violet-400/50 shrink-0 -rotate-90" />
            </div>
          </div>

          {/* Forwarded */}
          <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-[13px] text-white"
                style={{ background: "rgba(99,102,241,0.88)" }}>
                <div className="flex items-center gap-1.5 mb-1.5 opacity-70">
                  <Forward className="w-3 h-3" />
                  <span className="text-[10px]">Переслано · Максим Орлов</span>
                </div>
                Кстати, не забудь про встречу в пятницу в 18:00 🗓
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
                <span className="text-[10px] text-white/25">14:12</span>
                <ReadTickDD />
              </div>
            </div>
          </div>

          {/* Link preview */}
          <div className="flex items-end gap-2 max-w-[68%]">
            <Avatar className="w-6 h-6 shrink-0 mb-1">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="rounded-2xl rounded-bl-sm overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="h-24 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))" }}>
                  <Image className="w-8 h-8 text-white/20" />
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[10px] text-indigo-400/70 mb-0.5">medium.com</div>
                  <div className="text-[12px] font-medium text-white/80 leading-snug">Дизайн интерфейсов 2040: тренды будущего</div>
                  <div className="text-[11px] text-white/35 mt-1 line-clamp-2">Как изменится UX в эпоху пространственных вычислений...</div>
                </div>
              </div>
              <span className="text-[10px] text-white/25 ml-2 mt-0.5 block">14:15</span>
            </div>
          </div>

          {/* Typing */}
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}>АИ</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/35"
                  style={{ animation: `typingBounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Smart replies */}
        <div className="shrink-0 px-5 pb-2 flex gap-2">
          {SMART_REPLIES.map(r => (
            <button key={r} onClick={() => setActiveSmartReply(r)}
              className={cn("px-3 py-1.5 rounded-full text-[12px] transition-all border", activeSmartReply === r ? "text-white" : "text-white/55 hover:text-white/80")}
              style={activeSmartReply === r ? { background: "#6366f1", borderColor: "transparent" } : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }}>
              {r}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t flex items-center gap-2"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0">
            <Paperclip className="w-4 h-4 text-white/35" />
          </button>
          <div className="flex-1">
            <input value={activeSmartReply ?? input}
              onChange={e => { setInput(e.target.value); setActiveSmartReply(null); }}
              placeholder="Сообщение..."
              className="w-full h-10 rounded-2xl px-4 text-[13px] text-white placeholder:text-white/25 outline-none border"
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.07)" }} />
          </div>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.07] shrink-0">
            <Video className="w-4 h-4 text-white/35" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/[0.07] shrink-0">
            <Smile className="w-4 h-4 text-white/35" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(99,102,241,0.85)", boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
            <Mic className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── VIDEO EXPANDED OVERLAY ── */}
        {expandedVideo && (
          <div className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(24px)" }}
            onClick={() => { setExpandedVideo(false); setVideoPlaying(false); }}>
            <div className="flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
              {/* Big circle */}
              <div className="relative rounded-full overflow-hidden"
                style={{ width: 320, height: 320, background: "radial-gradient(ellipse at 40% 35%, rgba(80,60,180,0.6) 0%, rgba(10,6,30,0.95) 70%)", border: "3px solid rgba(99,102,241,0.6)", boxShadow: "0 0 80px rgba(99,102,241,0.35)" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full opacity-25" style={{ width: 160, height: 160, background: "radial-gradient(circle, rgba(200,180,255,0.7), transparent 70%)" }} />
                </div>
                {!videoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full flex items-center justify-center"
                      style={{ width: 72, height: 72, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                      <Play style={{ width: 28, height: 28, color: "white", marginLeft: 4 }} />
                    </div>
                  </div>
                )}
                {videoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button onClick={() => setVideoPlaying(false)}
                      className="rounded-full flex items-center justify-center"
                      style={{ width: 72, height: 72, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                      <Pause style={{ width: 28, height: 28, color: "white" }} />
                    </button>
                  </div>
                )}
                <span className="absolute font-mono"
                  style={{ bottom: 24, right: 28, fontSize: 13, color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.55)", padding: "3px 8px", borderRadius: 6 }}>
                  {videoPlaying ? "0:08" : "0:15"}
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button onClick={() => setVideoPlaying(!videoPlaying)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium text-white transition-all"
                  style={{ background: "#6366f1", boxShadow: "0 0 20px rgba(99,102,241,0.5)" }}>
                  {videoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  {videoPlaying ? "Пауза" : "Играть"}
                </button>
                <button onClick={() => { setExpandedVideo(false); setVideoPlaying(false); }}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>

              <p className="text-[11px] text-white/30">Нажмите на фон, чтобы закрыть</p>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes soundBar    { from{transform:scaleY(0.4)}to{transform:scaleY(1.4)} }
        @keyframes typingBounce{ 0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-4px);opacity:.9} }
      ` }} />
    </div>
  );
}
