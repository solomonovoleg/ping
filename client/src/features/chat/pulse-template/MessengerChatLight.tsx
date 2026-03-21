import React, { useState } from "react";
import {
  Search, Phone, Video, MoreHorizontal, Smile, Paperclip,
  Mic, Play, ChevronDown, Brain, Image, Forward,
  MessageCircle, LayoutList, LayoutGrid, Settings,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function ReadTickDL({ color = "#6366f1" }: { color?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2 }}>
      {[0.4, 1].map((op, i) => (
        <div key={i} style={{
          width: 12, height: 2.5, borderRadius: 99,
          background: color, opacity: op,
          boxShadow: i === 1 ? `0 0 4px ${color}99` : "none",
        }} />
      ))}
    </div>
  );
}

const CHATS = [
  { id: 1, name: "Алиса Иванова",   init: "АИ", sub: "Видеокружок",           time: "сейчас",  unread: 0, online: true,  active: true,  vid: true  },
  { id: 2, name: "Максим Орлов",    init: "МО", sub: "ок понял 👍",             time: "14:22",   unread: 3, online: true,  active: false, vid: false },
  { id: 3, name: "Команда дизайна", init: "КД", sub: "Аня: посмотрите макет", time: "13:11",   unread: 0, online: false, active: false, vid: false },
  { id: 4, name: "Анна Петрова",    init: "АП", sub: "Голосовое сообщение",    time: "вчера",   unread: 1, online: false, active: false, vid: false },
  { id: 5, name: "Денис",           init: "Д",  sub: "📸 Фото",                time: "вчера",   unread: 0, online: false, active: false, vid: false },
];

const BARS = [3,5,8,12,9,14,10,6,11,15,8,5,13,9,4,7,12,10,6,14,9,5,11,8,15,7,4,10,13,6,9,12,5,8,11,7,14,10,4,8,12,6,9,5,13,10,7,4];
const SMART_REPLIES = ["Буду! 🙌", "Уже знаю", "Напомни завтра"];

export function MessengerChatLight() {
  const [input, setInput] = useState("");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [activeSmartReply, setActiveSmartReply] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden select-none"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif", background: "#eef1fb", color: "#1a1a2e" }}>

      {/* ── SIDEBAR ── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r h-full"
        style={{ background: "#ffffff", borderColor: "rgba(0,0,0,0.07)" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "#6366f1" }}>
              <span className="text-[11px] font-black text-white leading-none">P</span>
            </div>
            <span className="text-[14px] font-semibold tracking-widest" style={{ color: "#1a1a2e" }}>PULSE</span>
            <div className="ml-auto w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/[0.05] transition-colors cursor-pointer">
              <MoreHorizontal className="w-4 h-4" style={{ color: "#94a3b8" }} />
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#c0c8d8" }} />
            <input placeholder="Поиск..." readOnly
              className="w-full h-9 rounded-xl pl-9 pr-3 text-[12px] outline-none border"
              style={{ background: "#f1f4fc", borderColor: "rgba(0,0,0,0.06)", color: "#6b7280" }} />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {CHATS.map(c => (
            <div key={c.id}
              className={cn("flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative")}
              style={c.active ? { background: "rgba(99,102,241,0.07)" } : { background: "transparent" }}
              onMouseEnter={e => !c.active && ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.03)")}
              onMouseLeave={e => !c.active && ((e.currentTarget as HTMLElement).style.background = "transparent")}>
              {c.active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full" style={{ background: "#6366f1" }} />}
              <div className="relative shrink-0">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="text-[11px] font-semibold"
                    style={{ background: c.active ? "rgba(99,102,241,0.15)" : "#eef1fb", color: c.active ? "#6366f1" : "#94a3b8" }}>
                    {c.init}
                  </AvatarFallback>
                </Avatar>
                {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium truncate" style={{ color: "#1a1a2e" }}>{c.name}</span>
                  <span className="text-[10px] shrink-0 ml-1" style={{ color: "#c0c8d8" }}>{c.time}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {c.vid && <Video className="w-3 h-3 shrink-0" style={{ color: "#c0c8d8" }} />}
                  <span className="text-[11px] truncate" style={{ color: "#94a3b8" }}>{c.sub}</span>
                </div>
              </div>
              {c.unread > 0 && (
                <span className="shrink-0 min-w-[18px] px-1 h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: "#6366f1" }}>{c.unread}</span>
              )}
            </div>
          ))}
        </div>

        {/* Bottom nav — 5 items */}
        <div className="border-t px-2 py-2.5 flex items-end justify-around shrink-0"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.95)" }}>

          {/* Чаты */}
          <button className="flex flex-col items-center gap-0.5 w-11 py-1 rounded-xl transition-colors"
            style={{ background: "rgba(99,102,241,0.07)" }}>
            <MessageCircle className="w-[18px] h-[18px]" style={{ color: "#6366f1" }} />
            <span className="text-[8px] font-semibold" style={{ color: "#6366f1" }}>Чаты</span>
          </button>

          {/* Лента */}
          <button className="flex flex-col items-center gap-0.5 w-11 py-1 rounded-xl transition-colors hover:bg-black/[0.03]">
            <LayoutList className="w-[18px] h-[18px]" style={{ color: "#c0c8d8" }} />
            <span className="text-[8px] font-medium" style={{ color: "#c0c8d8" }}>Лента</span>
          </button>

          {/* PULSE bird — centre CTA */}
          <button className="relative -mt-3 flex items-center justify-center w-12 h-12 rounded-[14px] shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 18px rgba(99,102,241,0.35)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 3C8 3 5 6 5 9c0 2.5 1.5 4.5 3.5 5.5L7 20l5-2 5 2-1.5-5.5C17.5 13.5 19 11.5 19 9c0-3-3-6-7-6z"
                fill="url(#birdGradL)" />
              <defs>
                <linearGradient id="birdGradL" x1="5" y1="3" x2="19" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ffffff" />
                  <stop offset="1" stopColor="rgba(255,255,255,0.75)" />
                </linearGradient>
              </defs>
            </svg>
          </button>

          {/* Борд */}
          <button className="flex flex-col items-center gap-0.5 w-11 py-1 rounded-xl transition-colors hover:bg-black/[0.03]">
            <LayoutGrid className="w-[18px] h-[18px]" style={{ color: "#c0c8d8" }} />
            <span className="text-[8px] font-medium" style={{ color: "#c0c8d8" }}>Борд</span>
          </button>

          {/* Настройки */}
          <button className="flex flex-col items-center gap-0.5 w-11 py-1 rounded-xl transition-colors hover:bg-black/[0.03]">
            <Settings className="w-[18px] h-[18px]" style={{ color: "#c0c8d8" }} />
            <span className="text-[8px] font-medium" style={{ color: "#c0c8d8" }}>Настройки</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CHAT ── */}
      <div className="flex-1 flex flex-col h-full min-w-0">

        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b"
          style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderColor: "rgba(0,0,0,0.06)" }}>
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="text-[11px] font-semibold"
              style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold" style={{ color: "#1a1a2e" }}>Алиса Иванова</div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#34d399" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              В сети
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[Phone, Video, Search, MoreHorizontal].map((Icon, i) => (
              <button key={i} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ color: "#94a3b8" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.05)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1.5"
          style={{ scrollbarWidth: "none" }}>

          {/* Date separator */}
          <div className="flex items-center justify-center my-2">
            <span className="text-[10px] px-3 py-1 rounded-full border"
              style={{ color: "#94a3b8", background: "rgba(255,255,255,0.7)", borderColor: "rgba(0,0,0,0.06)" }}>
              Сегодня
            </span>
          </div>

          {/* Incoming */}
          <div className="flex items-end gap-2 max-w-[65%]">
            <Avatar className="w-6 h-6 shrink-0 mb-1">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-[13px] leading-relaxed shadow-sm"
                style={{ background: "#ffffff", color: "#1a1a2e", border: "1px solid rgba(0,0,0,0.06)" }}>
                Привет! Смотри, я тут набросала макеты для новой фичи 🎨
              </div>
              <span className="text-[10px] ml-2 mt-0.5 block" style={{ color: "#c0c8d8" }}>14:01</span>
            </div>
          </div>

          {/* Outgoing */}
          <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-[13px] leading-relaxed text-white"
                style={{ background: "#6366f1", boxShadow: "0 2px 12px rgba(99,102,241,0.3)" }}>
                О, покажи! Сейчас гляну 👀
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
                <span className="text-[10px]" style={{ color: "#c0c8d8" }}>14:02</span>
                <ReadTickDL />
              </div>
            </div>
          </div>

          {/* Voice message */}
          <div className="flex items-end gap-2 max-w-[70%]">
            <Avatar className="w-6 h-6 shrink-0 mb-4">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm"
                style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}>
                <button onClick={() => setVoicePlaying(!voicePlaying)}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{ background: voicePlaying ? "#6366f1" : "#eef1fb" }}>
                  {voicePlaying
                    ? <div className="flex gap-0.5">{[0,1,2].map(i => <div key={i} className="w-0.5 h-4 rounded-full bg-white" style={{ animation: `soundBar 0.6s ease-in-out ${i * 0.15}s infinite alternate` }} />)}</div>
                    : <Play className="w-3.5 h-3.5 ml-0.5" style={{ color: "#6366f1" }} />}
                </button>
                <div className="flex items-center gap-[2px] h-8">
                  {BARS.map((h, i) => (
                    <div key={i} className="w-[3px] rounded-full"
                      style={{ height: `${(h / 15) * 28}px`, background: voicePlaying && i < 18 ? "#818cf8" : "#d1d9f0" }} />
                  ))}
                </div>
                <span className="text-[11px] shrink-0 font-mono" style={{ color: "#94a3b8" }}>0:42</span>
              </div>
              {/* AI transcript */}
              <div className="flex items-center gap-1.5 mt-1 ml-1">
                <Brain className="w-2.5 h-2.5" style={{ color: "#a78bfa" }} />
                <span className="text-[10px] italic" style={{ color: "#a78bfa" }}>«Хотела рассказать о макетах...»</span>
              </div>
              <span className="text-[10px] ml-2 mt-0.5 block" style={{ color: "#c0c8d8" }}>14:05</span>
            </div>
          </div>

          {/* Outgoing video circle */}
          <div className="flex items-end gap-2 max-w-[60%] ml-auto flex-row-reverse">
            <div>
              <div className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group shadow-lg"
                style={{ background: "linear-gradient(135deg,#c7d2fe,#818cf8)", border: "3px solid #6366f1", boxShadow: "0 4px 20px rgba(99,102,241,0.25)" }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2.5 text-[9px] font-mono text-white bg-black/30 px-1 rounded">0:15</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-1 mr-1">
                <span className="text-[10px]" style={{ color: "#c0c8d8" }}>14:07</span>
                <ReadTickDL />
              </div>
            </div>
          </div>

          {/* Incoming with reactions */}
          <div className="flex items-end gap-2 max-w-[65%]">
            <Avatar className="w-6 h-6 shrink-0 mb-5">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-[13px] shadow-sm"
                style={{ background: "#ffffff", color: "#1a1a2e", border: "1px solid rgba(0,0,0,0.06)" }}>
                Класс! Выглядит очень современно 🔥
              </div>
              <div className="flex gap-1 mt-1 ml-2">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] cursor-pointer border shadow-sm"
                  style={{ background: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>❤️ <span style={{ color: "#94a3b8" }}>2</span></span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] cursor-pointer border"
                  style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>🔥 <span style={{ color: "#6366f1" }}>1</span></span>
              </div>
              <span className="text-[10px] ml-2 mt-0.5 block" style={{ color: "#c0c8d8" }}>14:09</span>
            </div>
          </div>

          {/* AI Summary card */}
          <div className="flex justify-center my-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl max-w-[420px] w-full cursor-pointer shadow-sm border"
              style={{ background: "rgba(99,102,241,0.06)", borderColor: "rgba(99,102,241,0.15)", backdropFilter: "blur(8px)" }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(99,102,241,0.15)" }}>
                <Brain className="w-4 h-4" style={{ color: "#6366f1" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold mb-0.5" style={{ color: "#6366f1" }}>AI сжал 24 сообщения за 3 дня</div>
                <div className="text-[11px] truncate" style={{ color: "#94a3b8" }}>Обсуждали дизайн, встречу в пятницу и фото из Питера</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 shrink-0 -rotate-90" style={{ color: "#a5b4fc" }} />
            </div>
          </div>

          {/* Forwarded outgoing */}
          <div className="flex items-end gap-2 max-w-[65%] ml-auto flex-row-reverse">
            <div>
              <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-[13px] text-white"
                style={{ background: "#6366f1", boxShadow: "0 2px 12px rgba(99,102,241,0.3)" }}>
                <div className="flex items-center gap-1.5 mb-1.5 opacity-70">
                  <Forward className="w-3 h-3" />
                  <span className="text-[10px]">Переслано · Максим Орлов</span>
                </div>
                Кстати, не забудь про встречу в пятницу в 18:00 🗓
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5 mr-1">
                <span className="text-[10px]" style={{ color: "#c0c8d8" }}>14:12</span>
                <ReadTickDL />
              </div>
            </div>
          </div>

          {/* Link preview */}
          <div className="flex items-end gap-2 max-w-[68%]">
            <Avatar className="w-6 h-6 shrink-0 mb-1">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
            </Avatar>
            <div>
              <div className="rounded-2xl rounded-bl-sm overflow-hidden shadow-sm border"
                style={{ background: "#ffffff", borderColor: "rgba(0,0,0,0.06)" }}>
                <div className="h-24 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))" }}>
                  <Image className="w-8 h-8" style={{ color: "#c7d2fe" }} />
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[10px] mb-0.5" style={{ color: "#6366f1" }}>medium.com</div>
                  <div className="text-[12px] font-medium leading-snug" style={{ color: "#1a1a2e" }}>Дизайн интерфейсов 2040: тренды будущего</div>
                  <div className="text-[11px] mt-1 leading-snug line-clamp-2" style={{ color: "#94a3b8" }}>Как изменится пользовательский опыт в эпоху пространственных вычислений...</div>
                </div>
              </div>
              <span className="text-[10px] ml-2 mt-0.5 block" style={{ color: "#c0c8d8" }}>14:15</span>
            </div>
          </div>

          {/* Typing */}
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarFallback className="text-[9px]" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>АИ</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border shadow-sm"
              style={{ background: "#ffffff", borderColor: "rgba(0,0,0,0.06)" }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#c0c8d8", animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Smart replies */}
        <div className="shrink-0 px-5 pb-2 flex gap-2">
          {SMART_REPLIES.map(r => (
            <button key={r} onClick={() => setActiveSmartReply(r)}
              className="px-3 py-1.5 rounded-full text-[12px] transition-all border"
              style={activeSmartReply === r
                ? { background: "#6366f1", color: "#fff", borderColor: "transparent", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }
                : { background: "#ffffff", color: "#6b7280", borderColor: "rgba(0,0,0,0.07)" }}>
              {r}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="shrink-0 px-4 py-3 border-t flex items-center gap-2"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)" }}>
          <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ color: "#94a3b8" }}>
            <Paperclip className="w-4 h-4" />
          </button>
          <div className="flex-1 relative">
            <input value={activeSmartReply ?? input}
              onChange={e => { setInput(e.target.value); setActiveSmartReply(null); }}
              placeholder="Сообщение..."
              className="w-full h-10 rounded-2xl px-4 text-[13px] outline-none border"
              style={{ background: "#f1f4fc", borderColor: "rgba(0,0,0,0.06)", color: "#1a1a2e" }} />
          </div>
          <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#94a3b8" }}>
            <Video className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#94a3b8" }}>
            <Smile className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: "#6366f1", boxShadow: "0 2px 12px rgba(99,102,241,0.4)" }}>
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes soundBar { from { transform: scaleY(0.4); } to { transform: scaleY(1.4); } }
        @keyframes typingBounce { 0%,100% { transform: translateY(0); opacity:0.4; } 50% { transform: translateY(-4px); opacity:1; } }
      ` }} />
    </div>
  );
}
