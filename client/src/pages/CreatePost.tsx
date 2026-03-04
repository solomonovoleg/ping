import { useState } from "react";
import { ChevronLeft, Image as ImageIcon, Video, Mic, MapPin, Hash, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

import avatarMain from "@/assets/images/avatar-main.png";

export default function CreatePost() {
  const [, setLocation] = useLocation();
  const [text, setText] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = () => {
    if (!text.trim()) return;
    setIsPublishing(true);
    // Имитация загрузки
    setTimeout(() => {
      setLocation("/profile/me");
    }, 800);
  };

  return (
    <div className="flex flex-col h-full bg-background absolute inset-0 z-[100] animate-in slide-in-from-bottom-full duration-300">
      
      {/* Header */}
      <div className="glass px-4 py-3 flex items-center justify-between border-b border-border/50 pt-safe z-10 sticky top-0">
        <button 
          onClick={() => setLocation(-1)}
          className="text-foreground hover:bg-secondary p-2 -ml-2 rounded-full transition-colors font-medium text-[16px]"
        >
          Отмена
        </button>
        
        <span className="font-semibold text-[17px]">Новая запись</span>
        
        <button 
          onClick={handlePublish}
          disabled={!text.trim() || isPublishing}
          className={cn(
            "px-4 py-1.5 rounded-full font-semibold text-[14px] transition-all",
            text.trim() && !isPublishing
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20" 
              : "bg-secondary text-muted-foreground cursor-not-allowed"
          )}
        >
          {isPublishing ? "Публикация..." : "Опубликовать"}
        </button>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex gap-3">
          <img 
            src={avatarMain} 
            alt="My Avatar" 
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border/50"
          />
          <div className="flex-1 pt-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что у вас нового?"
              className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[150px] text-[16px] outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>

        {/* Addons Grid */}
        <div className="mt-auto pt-6 border-t border-border/50 grid grid-cols-2 gap-3 pb-safe-offset-4">
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Фото/Видео</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <Mic className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Аудио</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Локация</span>
          </button>
          
          <button className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors border border-border/30">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Hash className="w-5 h-5" />
            </div>
            <span className="font-medium text-[14px]">Теги</span>
          </button>
        </div>
      </div>
    </div>
  );
}
